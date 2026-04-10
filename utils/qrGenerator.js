const QRCode = require('qrcode');

/**
 * Generate a QR code data URL for a given book number.
 * @param {string} bookNumber
 * @returns {Promise<string>} base64 data URL
 */
const generateQR = async (bookNumber) => {
  try {
    const url = `${process.env.APP_URL || 'http://localhost:3000'}/api/transactions/by-book/${bookNumber}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: '#1e1b4b', light: '#ffffff' },
    });
    return dataUrl;
  } catch (err) {
    console.error('QR generation error:', err.message);
    return '';
  }
};

module.exports = { generateQR };
