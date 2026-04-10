const mongoose = require('mongoose');

// ─── Dynamic custom field schema ─────────────────────────────────────────────
const customFieldSchema = new mongoose.Schema({
  fieldName: { type: String, required: true },
  fieldType: { type: String, enum: ['text', 'number', 'date', 'boolean'], default: 'text' },
  fieldValue: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, index: true },
  author: { type: String, required: true, trim: true, index: true },
  description: { type: String, trim: true },
  bookNumber: { type: String, required: true, unique: true, trim: true, index: true },
  isbn: { type: String, trim: true },
  category: {
    type: String,
    enum: ['Fiction', 'Non-Fiction', 'Science', 'History', 'Biography', 'Children', 'Religion', 'Poetry', 'Drama', 'Other'],
    default: 'Other',
  },
  language: { type: String, default: 'English' },
  publisher: { type: String, trim: true },
  publishYear: { type: Number },
  totalCopies: { type: Number, default: 1, min: 1 },
  availableCopies: { type: Number, default: 1, min: 0 },
  image: { type: String, default: '' },  // stored path relative to /uploads/books/
  qrCode: { type: String, default: '' }, // base64 data URL
  status: { type: String, enum: ['available', 'checked_out', 'maintenance'], default: 'available' },
  tags: [{ type: String }],
  customFields: [customFieldSchema], // dynamic schema fields
  checkoutCount: { type: Number, default: 0 },  // for popularity tracking
}, { timestamps: true });

// Virtual: isBorrowable
bookSchema.virtual('isBorrowable').get(function () {
  return this.availableCopies > 0 && this.status !== 'maintenance';
});

// Full-text search index — language_override prevents conflict with our 'language' field
bookSchema.index(
  { title: 'text', author: 'text', bookNumber: 'text', isbn: 'text' },
  { language_override: 'search_lang' }
);

module.exports = mongoose.model('Book', bookSchema);
