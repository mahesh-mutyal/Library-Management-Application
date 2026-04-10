const moment = require('moment');
const Book = require('../models/Book');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const PaymentHistory = require('../models/PaymentHistory');

exports.getDashboard = async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();
    const monthStart = moment().startOf('month').toDate();

    const threeDaysFromNow = moment().add(3, 'days').endOf('day').toDate();

    const [
      totalBooks,
      totalCustomers,
      activeTransactions,
      overdueTransactions,
      todayCheckouts,
      todayCheckins,
      newestBooks,
      topBooks,
      dueSoonList,
      overdueList,
    ] = await Promise.all([
      Book.countDocuments(),
      Customer.countDocuments({ isActive: true }),
      Transaction.countDocuments({ status: 'active' }),
      Transaction.countDocuments({ status: 'overdue' }),
      Transaction.countDocuments({ checkoutDate: { $gte: today } }),
      Transaction.countDocuments({ checkinDate: { $gte: today } }),
      Book.find().sort({ createdAt: -1 }).limit(5).select('title author category image status'),
      Book.find().sort({ checkoutCount: -1 }).limit(5).select('title author checkoutCount availableCopies totalCopies'),
      // Due within next 3 days (active only)
      Transaction.find({ status: 'active', dueDate: { $lte: threeDaysFromNow } })
        .populate('book', 'title bookNumber')
        .populate('customer', 'name mobile')
        .sort({ dueDate: 1 })
        .limit(10),
      // Already overdue
      Transaction.find({ status: 'overdue' })
        .populate('book', 'title bookNumber')
        .populate('customer', 'name mobile')
        .sort({ dueDate: 1 })
        .limit(10),
    ]);

    // Monthly checkout trend (last 6 months)
    const sixMonthsAgo = moment().subtract(5, 'months').startOf('month').toDate();
    const checkoutTrend = await Transaction.aggregate([
      { $match: { checkoutDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$checkoutDate' },
            month: { $month: '$checkoutDate' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const availableBooks = await Book.countDocuments({ status: 'available', availableCopies: { $gt: 0 } });

    res.render('dashboard/index', {
      title: 'Dashboard',
      stats: {
        totalBooks,
        totalCustomers,
        activeTransactions,
        overdueTransactions,
        availableBooks,
        borrowedBooks: totalBooks - availableBooks,
        todayCheckouts,
        todayCheckins,
      },
      newestBooks,
      topBooks,
      dueSoonList,
      overdueList,
      checkoutTrend: JSON.stringify(checkoutTrend),
      moment,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load dashboard.');
    res.redirect('/');
  }
};
