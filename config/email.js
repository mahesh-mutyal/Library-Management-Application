const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email.
 * @param {Object} options - { to, subject, html, text }
 */
const sendEmail = async (options) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    console.log(`📧 Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { success: false, error: err.message };
  }
};

// ─── Email Templates ─────────────────────────────────────────────────────────

const checkoutEmailHtml = ({ customerName, bookTitle, dueDate }) => `
<div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
  <div style="background:#4f46e5;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0">📚 Library Management</h1>
  </div>
  <div style="padding:24px">
    <p>Dear <strong>${customerName}</strong>,</p>
    <p>You have successfully checked out the following book:</p>
    <div style="background:#f3f4f6;border-left:4px solid #4f46e5;padding:16px;border-radius:4px;margin:16px 0">
      <strong>Book:</strong> ${bookTitle}<br/>
      <strong>Due Date:</strong> ${dueDate}
    </div>
    <p>Please return the book by the due date to avoid late fines.</p>
    <p style="color:#6b7280;font-size:12px;margin-top:32px">This is an automated notification. Please do not reply.</p>
  </div>
</div>`;

const checkinEmailHtml = ({ customerName, bookTitle, fine }) => `
<div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
  <div style="background:#059669;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0">📚 Library Management</h1>
  </div>
  <div style="padding:24px">
    <p>Dear <strong>${customerName}</strong>,</p>
    <p>Thank you for returning:</p>
    <div style="background:#f3f4f6;border-left:4px solid #059669;padding:16px;border-radius:4px;margin:16px 0">
      <strong>Book:</strong> ${bookTitle}<br/>
      ${fine > 0 ? `<strong style="color:#dc2626">Fine:</strong> ₹${fine}` : '<strong style="color:#059669">No fine — returned on time!</strong>'}
    </div>
    <p style="color:#6b7280;font-size:12px;margin-top:32px">This is an automated notification. Please do not reply.</p>
  </div>
</div>`;

const monthlyFeeReminderHtml = ({ customerName, amount, month, year }) => `
<div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
  <div style="background:#d97706;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0">📚 Library Management</h1>
  </div>
  <div style="padding:24px">
    <p>Dear <strong>${customerName}</strong>,</p>
    <p>This is a friendly reminder that your monthly membership fee is due:</p>
    <div style="background:#fffbeb;border-left:4px solid #d97706;padding:16px;border-radius:4px;margin:16px 0">
      <strong>Amount:</strong> ₹${amount}<br/>
      <strong>Month:</strong> ${month} ${year}
    </div>
    <p>Please visit the library or contact us to make your payment.</p>
    <p style="color:#6b7280;font-size:12px;margin-top:32px">This is an automated notification.</p>
  </div>
</div>`;

module.exports = { sendEmail, checkoutEmailHtml, checkinEmailHtml, monthlyFeeReminderHtml };
