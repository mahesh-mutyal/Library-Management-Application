const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  month: { type: Number, required: true },   // 1–12
  year: { type: Number, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['paid', 'pending', 'waived'], default: 'pending' },
  paidDate: { type: Date },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true },
}, { timestamps: true });

// Ensure one record per customer per month-year
paymentHistorySchema.index({ customer: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('PaymentHistory', paymentHistorySchema);
