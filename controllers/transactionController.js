const moment = require('moment');
const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const Customer = require('../models/Customer');
const { sendEmail, checkoutEmailHtml, checkinEmailHtml } = require('../config/email');
const { calculateFine } = require('../utils/fineCalculator');

// GET /transactions
exports.index = async (req, res) => {
  try {
    const { status, page = 1 } = req.query;
    const limit = 15;
    const skip = (page - 1) * limit;
    const filter = {};
    if (status) filter.status = status;

    // Auto-mark overdue
    await Transaction.updateMany(
      { status: 'active', dueDate: { $lt: new Date() } },
      { status: 'overdue' }
    );

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('book', 'title bookNumber')
        .populate('customer', 'name mobile')
        .populate('checkedOutBy', 'name')
        .sort({ checkoutDate: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(filter),
    ]);

    res.render('transactions/index', {
      title: 'Transactions',
      transactions,
      query: { status },
      pagination: { page: parseInt(page), totalPages: Math.ceil(total / limit), total },
      moment,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load transactions.');
    res.redirect('/dashboard');
  }
};

// GET /transactions/checkout
exports.getCheckout = async (req, res) => {
  const { customerId, bookNumber } = req.query;
  let selectedCustomer = null, selectedBook = null;

  if (customerId) selectedCustomer = await Customer.findById(customerId).catch(() => null);
  if (bookNumber) selectedBook = await Book.findOne({ bookNumber }).catch(() => null);

  res.render('transactions/checkout', {
    title: 'Checkout Book',
    selectedCustomer,
    selectedBook,
  });
};

// POST /transactions/checkout
exports.postCheckout = async (req, res) => {
  try {
    const { customerId, bookId, dueDays = 14, notes } = req.body;

    const [customer, book] = await Promise.all([
      Customer.findById(customerId),
      Book.findById(bookId),
    ]);

    if (!customer) { req.flash('error', 'Customer not found.'); return res.redirect('/transactions/checkout'); }
    if (!book) { req.flash('error', 'Book not found.'); return res.redirect('/transactions/checkout'); }
    if (!book.isBorrowable) { req.flash('error', 'Book is not available for checkout.'); return res.redirect('/transactions/checkout'); }

    const existing = await Transaction.findOne({ book: bookId, customer: customerId, status: { $in: ['active', 'overdue'] } });
    if (existing) { req.flash('error', 'Customer already has this book checked out.'); return res.redirect('/transactions/checkout'); }

    const dueDate = moment().add(parseInt(dueDays), 'days').toDate();

    const transaction = await Transaction.create({
      book: bookId,
      customer: customerId,
      checkedOutBy: req.user._id,
      dueDate,
      notes,
    });

    // Update book
    book.availableCopies = Math.max(0, book.availableCopies - 1);
    book.checkoutCount += 1;
    if (book.availableCopies === 0) book.status = 'checked_out';
    await book.save();

    // Update customer stats
    customer.totalBorrowed += 1;
    await customer.save();

    // Send email
    const emailResult = await sendEmail({
      to: customer.email,
      subject: `Book Checked Out: ${book.title}`,
      html: checkoutEmailHtml({
        customerName: customer.name,
        bookTitle: book.title,
        dueDate: moment(dueDate).format('DD MMM YYYY'),
      }),
    });
    if (emailResult.success) {
      transaction.emailSent = true;
      await transaction.save();
    }

    req.flash('success', `"${book.title}" checked out to ${customer.name}. Due: ${moment(dueDate).format('DD MMM YYYY')}`);
    res.redirect(`/transactions/${transaction._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Checkout failed: ' + err.message);
    res.redirect('/transactions/checkout');
  }
};

// GET /transactions/checkin
exports.getCheckin = async (req, res) => {
  const { bookNumber } = req.query;
  let transaction = null;

  if (bookNumber) {
    const book = await Book.findOne({ bookNumber }).catch(() => null);
    if (book) {
      transaction = await Transaction.findOne({ book: book._id, status: { $in: ['active', 'overdue'] } })
        .populate('book', 'title bookNumber')
        .populate('customer', 'name email mobile')
        .catch(() => null);
    }
  }

  res.render('transactions/checkin', {
    title: 'Check-in Book',
    transaction,
    bookNumber,
    moment,
    calculateFine,
  });
};

// POST /transactions/checkin
exports.postCheckin = async (req, res) => {
  try {
    const { transactionId } = req.body;

    const transaction = await Transaction.findById(transactionId)
      .populate('book')
      .populate('customer');

    if (!transaction || transaction.status === 'returned') {
      req.flash('error', 'Invalid or already returned transaction.');
      return res.redirect('/transactions/checkin');
    }

    const checkinDate = new Date();
    const fine = calculateFine(transaction.dueDate, checkinDate, transaction.finePerDay);

    transaction.checkinDate = checkinDate;
    transaction.status = 'returned';
    transaction.checkedInBy = req.user._id;
    transaction.fineAmount = fine;
    transaction.fineStatus = fine > 0 ? 'pending' : 'none';
    await transaction.save();

    // Update book
    const book = transaction.book;
    book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
    if (book.status === 'checked_out') book.status = 'available';
    await book.save();

    // Send email
    await sendEmail({
      to: transaction.customer.email,
      subject: `Book Returned: ${book.title}`,
      html: checkinEmailHtml({
        customerName: transaction.customer.name,
        bookTitle: book.title,
        fine,
      }),
    });

    req.flash('success', `Book returned successfully.${fine > 0 ? ` Fine: ₹${fine}` : ''}`);
    res.redirect(`/transactions/${transaction._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Check-in failed: ' + err.message);
    res.redirect('/transactions/checkin');
  }
};

// GET /transactions/:id
exports.getDetail = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('book')
      .populate('customer')
      .populate('checkedOutBy', 'name')
      .populate('checkedInBy', 'name');

    if (!transaction) { req.flash('error', 'Transaction not found.'); return res.redirect('/transactions'); }

    res.render('transactions/detail', { title: 'Transaction Detail', transaction, moment, calculateFine });
  } catch (err) {
    req.flash('error', 'Failed to load transaction.');
    res.redirect('/transactions');
  }
};

// POST /transactions/:id/pay-fine
exports.payFine = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) { req.flash('error', 'Transaction not found.'); return res.redirect('/transactions'); }

    transaction.fineStatus = 'paid';
    await transaction.save();
    req.flash('success', 'Fine marked as paid.');
    res.redirect(`/transactions/${transaction._id}`);
  } catch (err) {
    req.flash('error', 'Failed to update fine status.');
    res.redirect('/transactions');
  }
};

// POST /transactions/:id/extend — extend due date on customer request
exports.extendDueDate = async (req, res) => {
  try {
    const { extraDays } = req.body;
    const days = parseInt(extraDays);
    if (!days || days < 1 || days > 90) {
      req.flash('error', 'Extension must be between 1 and 90 days.');
      return res.redirect(`/transactions/${req.params.id}`);
    }

    const transaction = await Transaction.findById(req.params.id)
      .populate('book', 'title')
      .populate('customer', 'name');

    if (!transaction) { req.flash('error', 'Transaction not found.'); return res.redirect('/transactions'); }
    if (transaction.status === 'returned') {
      req.flash('error', 'Cannot extend a returned transaction.');
      return res.redirect(`/transactions/${req.params.id}`);
    }

    const oldDue = moment(transaction.dueDate).format('DD MMM YYYY');
    transaction.dueDate = moment(transaction.dueDate).add(days, 'days').toDate();
    // If it was overdue, reset to active now that due date is extended
    if (transaction.status === 'overdue' && new Date(transaction.dueDate) > new Date()) {
      transaction.status = 'active';
    }
    await transaction.save();

    req.flash('success',
      `Due date extended by ${days} day(s) for "${transaction.book?.title}". ` +
      `New due date: ${moment(transaction.dueDate).format('DD MMM YYYY')} (was ${oldDue}).`
    );
    const redirectTo = req.headers.referer?.includes('/dashboard') ? '/dashboard' : `/transactions/${transaction._id}`;
    res.redirect(redirectTo);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to extend due date.');
    res.redirect(`/transactions/${req.params.id}`);
  }
};
