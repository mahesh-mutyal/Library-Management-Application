const cron = require('node-cron');
const moment = require('moment');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const PaymentHistory = require('../models/PaymentHistory');
const Book = require('../models/Book');
const { sendEmail, monthlyFeeReminderHtml } = require('../config/email');

const scheduleJobs = () => {
  // ─── 1. Mark overdue transactions (every hour) ─────────────────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await Transaction.updateMany(
        { status: 'active', dueDate: { $lt: new Date() } },
        { status: 'overdue' }
      );
      if (result.modifiedCount > 0) console.log(`⏰ Marked ${result.modifiedCount} transactions as overdue`);
    } catch (err) {
      console.error('Overdue job error:', err.message);
    }
  });

  // ─── 2. Monthly fee reminder (1st of every month at 9 AM) ─────────────────
  cron.schedule('0 9 1 * *', async () => {
    try {
      const customers = await Customer.find({ isActive: true });
      const month = moment().month() + 1; // 1-indexed
      const year  = moment().year();
      const monthName = moment().format('MMMM');

      let sent = 0;
      for (const customer of customers) {
        const existing = await PaymentHistory.findOne({ customer: customer._id, month, year });
        if (!existing || existing.status === 'pending') {
          // Upsert pending record
          await PaymentHistory.findOneAndUpdate(
            { customer: customer._id, month, year },
            { amount: customer.monthlyFee, status: 'pending' },
            { upsert: true }
          );
          // Send reminder email
          await sendEmail({
            to: customer.email,
            subject: `Library Monthly Fee Reminder – ${monthName} ${year}`,
            html: monthlyFeeReminderHtml({ customerName: customer.name, amount: customer.monthlyFee, month: monthName, year }),
          });
          sent++;
        }
      }
      console.log(`📧 Monthly fee reminders sent: ${sent}`);
    } catch (err) {
      console.error('Monthly fee job error:', err.message);
    }
  });

  // ─── 3. Inventory alert (every day at 8 AM) ────────────────────────────────
  cron.schedule('0 8 * * *', async () => {
    try {
      const outOfStock = await Book.find({ availableCopies: 0 }).select('title bookNumber');
      if (outOfStock.length > 0) {
        console.log(`📦 Inventory alert: ${outOfStock.length} book(s) out of stock:`);
        outOfStock.forEach(b => console.log(`   – [${b.bookNumber}] ${b.title}`));
      }
    } catch (err) {
      console.error('Inventory alert job error:', err.message);
    }
  });

  console.log('⏰ Cron jobs scheduled: overdue check (hourly), monthly reminders (1st/month), inventory alerts (daily 8AM)');
};

module.exports = { scheduleJobs };
