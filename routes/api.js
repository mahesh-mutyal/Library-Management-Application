const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const Book = require('../models/Book');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { generateBookTemplate, generateCustomerTemplate } = require('../utils/excelParser');

// Search books by title/author/bookNumber (for barcode/typeahead)
router.get('/books/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const books = await Book.find({
      $or: [
        { bookNumber: { $regex: q, $options: 'i' } },
        { title: { $regex: q, $options: 'i' } },
        { author: { $regex: q, $options: 'i' } },
      ],
    }).limit(10).select('title author bookNumber category status availableCopies image');
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search customers (for typeahead)
router.get('/customers/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const customers = await Customer.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { mobile: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    }).limit(10).select('name email mobile address totalBorrowed');
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get active transaction for a book number (for barcode scan)
router.get('/transactions/by-book/:bookNumber', requireAuth, async (req, res) => {
  try {
    const book = await Book.findOne({ bookNumber: req.params.bookNumber });
    if (!book) return res.status(404).json({ error: 'Book not found' });
    const transaction = await Transaction.findOne({ book: book._id, status: { $in: ['active', 'overdue'] } })
      .populate('customer', 'name email mobile')
      .populate('book', 'title bookNumber');
    res.json({ book, transaction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inventory alert: low-stock books (availableCopies === 0)
router.get('/inventory/alerts', requireAuth, async (req, res) => {
  try {
    const outOfStock = await Book.find({ availableCopies: 0, status: { $ne: 'maintenance' } })
      .select('title author bookNumber checkoutCount');
    res.json(outOfStock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download Excel templates
router.get('/template/books', requireAuth, (req, res) => {
  const buffer = generateBookTemplate();
  res.setHeader('Content-Disposition', 'attachment; filename="books-template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

router.get('/template/customers', requireAuth, (req, res) => {
  const buffer = generateCustomerTemplate();
  res.setHeader('Content-Disposition', 'attachment; filename="customers-template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

module.exports = router;
