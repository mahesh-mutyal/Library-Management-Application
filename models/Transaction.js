const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  checkoutDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  checkinDate: { type: Date },
  status: { type: String, enum: ['active', 'returned', 'overdue'], default: 'active' },
  finePerDay: { type: Number, default: 2 },   // ₹2 per day overdue
  fineAmount: { type: Number, default: 0 },
  fineStatus: { type: String, enum: ['none', 'pending', 'paid'], default: 'none' },
  notes: { type: String, trim: true },
  emailSent: { type: Boolean, default: false },
}, { timestamps: true });

// Virtual: calculate fine dynamically
transactionSchema.virtual('calculatedFine').get(function () {
  if (this.status === 'returned' && this.checkinDate) {
    const returnDate = new Date(this.checkinDate);
    const due = new Date(this.dueDate);
    if (returnDate > due) {
      const daysLate = Math.ceil((returnDate - due) / (1000 * 60 * 60 * 24));
      return daysLate * this.finePerDay;
    }
    return 0;
  }
  if (this.status === 'active' || this.status === 'overdue') {
    const today = new Date();
    const due = new Date(this.dueDate);
    if (today > due) {
      const daysLate = Math.ceil((today - due) / (1000 * 60 * 60 * 24));
      return daysLate * this.finePerDay;
    }
  }
  return 0;
});

transactionSchema.set('toObject', { virtuals: true });
transactionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Transaction', transactionSchema);
