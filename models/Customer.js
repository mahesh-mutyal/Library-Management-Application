const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema({
  fieldName: { type: String, required: true },
  fieldType: { type: String, enum: ['text', 'number', 'date', 'boolean'], default: 'text' },
  fieldValue: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobile: {
    type: String,
    required: true,
    trim: true,
    match: [/^[6-9]\d{9}$/, 'Enter a valid Indian mobile number'],
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true, default: 'Maharashtra' },
    pincode: { type: String, trim: true },
  },
  govtIdType: {
    type: String,
    enum: ['Aadhaar', 'PAN', 'Voter ID', 'Passport', 'Driving License'],
    default: 'Aadhaar',
  },
  govtIdFile: { type: String, default: '' }, // stored in protected uploads/ids/ folder
  govtIdNumber: { type: String, trim: true },
  membershipDate: { type: Date, default: Date.now },
  membershipExpiry: { type: Date },
  monthlyFee: { type: Number, required: true, default: 100 },
  isActive: { type: Boolean, default: true },
  totalBorrowed: { type: Number, default: 0 },
  customFields: [customFieldSchema],
}, { timestamps: true });

// Auto-set expiry 1 year from membership date
customerSchema.pre('save', function (next) {
  if (!this.membershipExpiry) {
    const expiry = new Date(this.membershipDate);
    expiry.setFullYear(expiry.getFullYear() + 1);
    this.membershipExpiry = expiry;
  }
  next();
});

customerSchema.index({ name: 'text', email: 'text', mobile: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
