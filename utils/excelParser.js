const XLSX = require('xlsx');

/**
 * Parse an Excel file and return an array of row objects.
 * @param {string} filePath
 * @returns {Array<Object>}
 */
const parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
};

/**
 * Generate a sample Excel template for books.
 * @returns {Buffer}
 */
const generateBookTemplate = () => {
  const sampleData = [
    {
      title: 'Sample Book Title',
      author: 'Author Name',
      bookNumber: 'BK-0001',
      isbn: '978-0000000000',
      category: 'Fiction',
      description: 'Book description',
      language: 'English',
      publisher: 'Publisher Name',
      publishYear: 2023,
      totalCopies: 2,
    },
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, ws, 'Books');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * Generate a sample Excel template for customers.
 * @returns {Buffer}
 */
const generateCustomerTemplate = () => {
  const sampleData = [
    {
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      mobile: '9876543210',
      street: '123 Main St',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      monthlyFee: 100,
    },
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, ws, 'Customers');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = { parseExcel, generateBookTemplate, generateCustomerTemplate };
