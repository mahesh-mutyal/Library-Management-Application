const Book = require('../models/Book');
const Transaction = require('../models/Transaction');
const { generateQR } = require('../utils/qrGenerator');
const { parseExcel } = require('../utils/excelParser');
const path = require('path');
const fs = require('fs');

// GET /books
exports.index = async (req, res) => {
  try {
    const { q, category, status, page = 1 } = req.query;
    const limit = 12;
    const skip = (page - 1) * limit;

    const filter = {};
    if (q) filter.$text = { $search: q };
    if (category) filter.category = category;
    if (status) filter.status = status;

    const [books, total] = await Promise.all([
      Book.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Book.countDocuments(filter),
    ]);

    res.render('books/index', {
      title: 'Books',
      books,
      query: { q, category, status },
      pagination: { page: parseInt(page), totalPages: Math.ceil(total / limit), total },
      categories: Book.schema.path('category').enumValues,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load books.');
    res.redirect('/dashboard');
  }
};

// GET /books/add
exports.getAdd = (req, res) => {
  res.render('books/add', {
    title: 'Add Book',
    categories: Book.schema.path('category').enumValues,
    book: {},
  });
};

// POST /books/add
exports.postAdd = async (req, res) => {
  try {
    const { title, author, description, bookNumber, isbn, category, language,
            publisher, publishYear, totalCopies, tags, customFieldsJson } = req.body;

    // Parse dynamic custom fields
    let customFields = [];
    if (customFieldsJson) {
      try { customFields = JSON.parse(customFieldsJson); } catch (e) {}
    }

    const imagePath = req.file ? `/uploads/books/${req.file.filename}` : '';
    const copies = parseInt(totalCopies) || 1;

    const book = await Book.create({
      title, author, description, bookNumber, isbn, category, language,
      publisher, publishYear: parseInt(publishYear) || undefined,
      totalCopies: copies, availableCopies: copies,
      image: imagePath,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      customFields,
    });

    // Generate QR code
    const qr = await generateQR(book.bookNumber);
    book.qrCode = qr;
    await book.save();

    req.flash('success', 'Book added successfully!');
    res.redirect(`/books/${book._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', err.code === 11000 ? 'Book number already exists.' : err.message);
    res.redirect('/books/add');
  }
};

// GET /books/:id
exports.getDetail = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) { req.flash('error', 'Book not found.'); return res.redirect('/books'); }

    const transactions = await Transaction.find({ book: book._id })
      .populate('customer', 'name email mobile')
      .populate('checkedOutBy', 'name')
      .sort({ checkoutDate: -1 })
      .limit(10);

    res.render('books/detail', { title: book.title, book, transactions });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load book.');
    res.redirect('/books');
  }
};

// GET /books/:id/edit
exports.getEdit = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) { req.flash('error', 'Book not found.'); return res.redirect('/books'); }
    res.render('books/edit', {
      title: 'Edit Book',
      book,
      categories: Book.schema.path('category').enumValues,
    });
  } catch (err) {
    req.flash('error', 'Failed to load book.');
    res.redirect('/books');
  }
};

// PUT /books/:id
exports.update = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) { req.flash('error', 'Book not found.'); return res.redirect('/books'); }

    const { title, author, description, isbn, category, language, publisher,
            publishYear, totalCopies, tags, customFieldsJson } = req.body;

    let customFields = book.customFields;
    if (customFieldsJson) {
      try { customFields = JSON.parse(customFieldsJson); } catch (e) {}
    }

    const newTotal = parseInt(totalCopies) || book.totalCopies;
    const diff = newTotal - book.totalCopies;

    book.title = title;
    book.author = author;
    book.description = description;
    book.isbn = isbn;
    book.category = category;
    book.language = language;
    book.publisher = publisher;
    book.publishYear = parseInt(publishYear) || undefined;
    book.totalCopies = newTotal;
    book.availableCopies = Math.max(0, book.availableCopies + diff);
    book.tags = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    book.customFields = customFields;

    if (req.file) {
      // Remove old image
      if (book.image) {
        const oldPath = path.join(__dirname, '../', book.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      book.image = `/uploads/books/${req.file.filename}`;
    }

    await book.save();
    req.flash('success', 'Book updated successfully!');
    res.redirect(`/books/${book._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', err.message);
    res.redirect(`/books/${req.params.id}/edit`);
  }
};

// DELETE /books/:id
exports.delete = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) { req.flash('error', 'Book not found.'); return res.redirect('/books'); }

    const activeTransaction = await Transaction.findOne({ book: book._id, status: 'active' });
    if (activeTransaction) {
      req.flash('error', 'Cannot delete a book that is currently checked out.');
      return res.redirect(`/books/${book._id}`);
    }

    if (book.image) {
      const imgPath = path.join(__dirname, '../', book.image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await book.deleteOne();
    req.flash('success', 'Book deleted.');
    res.redirect('/books');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete book.');
    res.redirect('/books');
  }
};

// GET /books/:id/qr — return QR code image
exports.getQR = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).select('bookNumber qrCode title');
    if (!book) return res.status(404).json({ error: 'Book not found' });

    if (!book.qrCode) {
      book.qrCode = await generateQR(book.bookNumber);
      await book.save();
    }
    res.render('books/qr', { title: `QR – ${book.title}`, book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /books/import — Excel bulk import
exports.importExcel = async (req, res) => {
  try {
    if (!req.file) { req.flash('error', 'Please upload an Excel file.'); return res.redirect('/books'); }
    const rows = parseExcel(req.file.path);
    let created = 0, skipped = 0;

    for (const row of rows) {
      try {
        const copies = parseInt(row.totalCopies) || 1;
        const book = await Book.create({
          title: row.title || row.Title,
          author: row.author || row.Author,
          bookNumber: row.bookNumber || row['Book Number'],
          isbn: row.isbn || row.ISBN,
          category: row.category || row.Category || 'Other',
          description: row.description || row.Description,
          language: row.language || 'English',
          publisher: row.publisher || row.Publisher,
          publishYear: parseInt(row.publishYear || row['Publish Year']) || undefined,
          totalCopies: copies,
          availableCopies: copies,
        });
        book.qrCode = await generateQR(book.bookNumber);
        await book.save();
        created++;
      } catch (e) {
        skipped++;
      }
    }

    // Cleanup temp file
    fs.unlinkSync(req.file.path);
    req.flash('success', `Import complete: ${created} added, ${skipped} skipped.`);
    res.redirect('/books');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to import: ' + err.message);
    res.redirect('/books');
  }
};
