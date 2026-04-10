const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const PaymentHistory = require('../models/PaymentHistory');
const { parseExcel } = require('../utils/excelParser');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

// GET /customers
exports.index = async (req, res) => {
  try {
    const { q, page = 1 } = req.query;
    const limit = 12;
    const skip = (page - 1) * limit;
    const filter = {};
    if (q) filter.$text = { $search: q };

    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(filter),
    ]);

    res.render('customers/index', {
      title: 'Customers',
      customers,
      query: q,
      pagination: { page: parseInt(page), totalPages: Math.ceil(total / limit), total },
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load customers.');
    res.redirect('/dashboard');
  }
};

// GET /customers/add
exports.getAdd = (req, res) => {
  res.render('customers/add', { title: 'Add Customer', customer: {} });
};

// POST /customers/add
exports.postAdd = async (req, res) => {
  try {
    const { name, email, mobile, street, city, state, pincode,
            govtIdType, govtIdNumber, monthlyFee, customFieldsJson } = req.body;

    let customFields = [];
    if (customFieldsJson) {
      try { customFields = JSON.parse(customFieldsJson); } catch (e) {}
    }

    const govtIdFile = req.file ? req.file.filename : '';

    const customer = await Customer.create({
      name, email, mobile,
      address: { street, city, state: state || 'Maharashtra', pincode },
      govtIdType, govtIdNumber,
      govtIdFile,
      monthlyFee: parseFloat(monthlyFee) || 100,
      customFields,
    });

    req.flash('success', 'Customer added successfully!');
    res.redirect(`/customers/${customer._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', err.code === 11000 ? 'Email already registered.' : err.message);
    res.redirect('/customers/add');
  }
};

// GET /customers/:id
exports.getDetail = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) { req.flash('error', 'Customer not found.'); return res.redirect('/customers'); }

    const [transactions, paymentHistory] = await Promise.all([
      Transaction.find({ customer: customer._id })
        .populate('book', 'title bookNumber')
        .sort({ checkoutDate: -1 })
        .limit(20),
      PaymentHistory.find({ customer: customer._id })
        .sort({ year: -1, month: -1 })
        .limit(24),
    ]);

    res.render('customers/detail', {
      title: customer.name,
      customer,
      transactions,
      paymentHistory,
      moment,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load customer.');
    res.redirect('/customers');
  }
};

// GET /customers/:id/edit
exports.getEdit = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) { req.flash('error', 'Customer not found.'); return res.redirect('/customers'); }
    res.render('customers/edit', { title: 'Edit Customer', customer });
  } catch (err) {
    req.flash('error', 'Failed to load customer.');
    res.redirect('/customers');
  }
};

// PUT /customers/:id
exports.update = async (req, res) => {
  try {
    const { name, email, mobile, street, city, state, pincode,
            govtIdType, govtIdNumber, monthlyFee, customFieldsJson } = req.body;

    const customer = await Customer.findById(req.params.id);
    if (!customer) { req.flash('error', 'Customer not found.'); return res.redirect('/customers'); }

    let customFields = customer.customFields;
    if (customFieldsJson) {
      try { customFields = JSON.parse(customFieldsJson); } catch (e) {}
    }

    customer.name = name;
    customer.email = email;
    customer.mobile = mobile;
    customer.address = { street, city, state: state || 'Maharashtra', pincode };
    customer.govtIdType = govtIdType;
    customer.govtIdNumber = govtIdNumber;
    customer.monthlyFee = parseFloat(monthlyFee) || customer.monthlyFee;
    customer.customFields = customFields;

    if (req.file) {
      if (customer.govtIdFile) {
        const oldPath = path.join(__dirname, '../uploads/ids', customer.govtIdFile);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      customer.govtIdFile = req.file.filename;
    }

    await customer.save();
    req.flash('success', 'Customer updated!');
    res.redirect(`/customers/${customer._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', err.message);
    res.redirect(`/customers/${req.params.id}/edit`);
  }
};

// DELETE /customers/:id
exports.delete = async (req, res) => {
  try {
    const active = await Transaction.findOne({ customer: req.params.id, status: 'active' });
    if (active) {
      req.flash('error', 'Cannot delete customer with active checkouts.');
      return res.redirect(`/customers/${req.params.id}`);
    }
    await Customer.findByIdAndDelete(req.params.id);
    req.flash('success', 'Customer deleted.');
    res.redirect('/customers');
  } catch (err) {
    req.flash('error', 'Failed to delete customer.');
    res.redirect('/customers');
  }
};

// POST /customers/:id/payment — record a monthly payment
exports.recordPayment = async (req, res) => {
  try {
    const { month, year, amount, status, notes } = req.body;
    await PaymentHistory.findOneAndUpdate(
      { customer: req.params.id, month: parseInt(month), year: parseInt(year) },
      {
        amount: parseFloat(amount),
        status,
        notes,
        paidDate: status === 'paid' ? new Date() : undefined,
        recordedBy: req.user._id,
      },
      { upsert: true, new: true }
    );
    req.flash('success', 'Payment recorded.');
    res.redirect(`/customers/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to record payment.');
    res.redirect(`/customers/${req.params.id}`);
  }
};

// POST /customers/import — Excel bulk import
exports.importExcel = async (req, res) => {
  try {
    if (!req.file) { req.flash('error', 'Please upload an Excel file.'); return res.redirect('/customers'); }
    const rows = parseExcel(req.file.path);
    let created = 0, skipped = 0;

    for (const row of rows) {
      try {
        await Customer.create({
          name: row.name || row.Name,
          email: (row.email || row.Email || '').toLowerCase(),
          mobile: String(row.mobile || row.Mobile || ''),
          address: {
            street: row.street || row.Street,
            city: row.city || row.City,
            state: row.state || row.State || 'Maharashtra',
            pincode: String(row.pincode || row.Pincode || ''),
          },
          monthlyFee: parseFloat(row.monthlyFee || row['Monthly Fee']) || 100,
        });
        created++;
      } catch (e) {
        skipped++;
      }
    }

    fs.unlinkSync(req.file.path);
    req.flash('success', `Import complete: ${created} added, ${skipped} skipped.`);
    res.redirect('/customers');
  } catch (err) {
    req.flash('error', 'Failed to import: ' + err.message);
    res.redirect('/customers');
  }
};
