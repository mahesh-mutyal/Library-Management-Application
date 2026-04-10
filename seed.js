require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Book = require('./models/Book');
const Customer = require('./models/Customer');
const { generateQR } = require('./utils/qrGenerator');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'librarydb' });
  console.log('Connected to MongoDB');

  // Clear existing data and drop stale indexes
  await Promise.all([
    User.deleteMany({}),
    Book.deleteMany({}),
    Customer.deleteMany({}),
  ]);
  // Drop all text indexes on books to avoid language override conflicts
  try { await Book.collection.dropIndexes(); } catch (e) { /* no indexes yet */ }
  await Book.syncIndexes();
  console.log('Cleared existing data');

  // ─── Users ────────────────────────────────────────────────────────────────
  const users = await User.create([
    { name: 'Suresh Admin', email: 'admin@library.com', password: 'Admin@123', role: 'admin' },
    { name: 'Ravi Sharma', email: 'ravi@library.com', password: 'Emp@123', role: 'employee' },
    { name: 'Priya Desai', email: 'priya@library.com', password: 'Emp@123', role: 'employee' },
  ]);
  console.log(`✅ Created ${users.length} users`);
  console.log('   Admin  → admin@library.com / Admin@123');
  console.log('   Emp 1  → ravi@library.com  / Emp@123');
  console.log('   Emp 2  → priya@library.com / Emp@123');

  // ─── Books ────────────────────────────────────────────────────────────────
  const booksData = [
    { title: 'Mrutyunjay', author: 'Shivaji Sawant', bookNumber: 'BK-0001', category: 'Fiction', language: 'Marathi', publisher: 'Mehta Publishing House', publishYear: 1967, totalCopies: 3, description: 'Karna narrates his own life in this mythological masterpiece.' },
    { title: 'Yayati', author: 'V.S. Khandekar', bookNumber: 'BK-0002', category: 'Fiction', language: 'Marathi', publisher: 'Continental Prakashan', publishYear: 1959, totalCopies: 2, description: 'A retelling of the mythological king Yayati\'s story.' },
    { title: 'Discovery of India', author: 'Jawaharlal Nehru', bookNumber: 'BK-0003', category: 'History', language: 'English', publisher: 'Penguin Books', publishYear: 1946, totalCopies: 2 },
    { title: 'Wings of Fire', author: 'A.P.J. Abdul Kalam', bookNumber: 'BK-0004', category: 'Biography', language: 'English', publisher: 'Universities Press', publishYear: 1999, totalCopies: 4, description: 'Autobiography of Dr. A.P.J. Abdul Kalam.' },
    { title: 'The God of Small Things', author: 'Arundhati Roy', bookNumber: 'BK-0005', category: 'Fiction', language: 'English', publisher: 'IndiaInk', publishYear: 1997, totalCopies: 2 },
    { title: 'Shyamchi Aai', author: 'Sane Guruji', bookNumber: 'BK-0006', category: 'Fiction', language: 'Marathi', publisher: 'Sadhana Prakashan', publishYear: 1935, totalCopies: 5, description: 'A heartwarming story of a mother\'s love and values.' },
    { title: 'Aamhi Saare Arjun', author: 'V.P. Kale', bookNumber: 'BK-0007', category: 'Fiction', language: 'Marathi', publisher: 'Majestic Books', publishYear: 1980, totalCopies: 2 },
    { title: 'Brief History of Time', author: 'Stephen Hawking', bookNumber: 'BK-0008', category: 'Science', language: 'English', publisher: 'Bantam Books', publishYear: 1988, totalCopies: 2 },
    { title: 'Sapiens', author: 'Yuval Noah Harari', bookNumber: 'BK-0009', category: 'History', language: 'English', publisher: 'Harper Collins', publishYear: 2011, totalCopies: 3 },
    { title: 'Panchatantra', author: 'Vishnu Sharma', bookNumber: 'BK-0010', category: 'Children', language: 'Marathi', publisher: 'Saraswati Prakashan', publishYear: 2000, totalCopies: 6, description: 'Ancient Indian collection of animal fables with moral lessons.' },
  ];

  const books = [];
  for (const b of booksData) {
    const book = await Book.create({ ...b, availableCopies: b.totalCopies });
    book.qrCode = await generateQR(book.bookNumber);
    await book.save();
    books.push(book);
  }
  console.log(`✅ Created ${books.length} books`);

  // ─── Customers ────────────────────────────────────────────────────────────
  const customersData = [
    {
      name: 'Rajesh Patil', email: 'rajesh.patil@gmail.com', mobile: '9876543210',
      address: { street: '14 Shivaji Nagar', city: 'Pune', state: 'Maharashtra', pincode: '411005' },
      govtIdType: 'Aadhaar', monthlyFee: 150,
    },
    {
      name: 'Sunita Kulkarni', email: 'sunita.kulkarni@yahoo.com', mobile: '8765432109',
      address: { street: '3B Laxmi Road', city: 'Nashik', state: 'Maharashtra', pincode: '422001' },
      govtIdType: 'PAN', monthlyFee: 100,
    },
    {
      name: 'Anil Bhosale', email: 'anil.bhosale@hotmail.com', mobile: '7654321098',
      address: { street: '27 Prabhat Road', city: 'Pune', state: 'Maharashtra', pincode: '411004' },
      govtIdType: 'Voter ID', monthlyFee: 100,
    },
    {
      name: 'Meena Joshi', email: 'meena.joshi@gmail.com', mobile: '9543210987',
      address: { street: '8 Tilak Road', city: 'Aurangabad', state: 'Maharashtra', pincode: '431001' },
      govtIdType: 'Aadhaar', monthlyFee: 200,
    },
    {
      name: 'Santosh Kamble', email: 'santosh.kamble@gmail.com', mobile: '9432109876',
      address: { street: '55 MG Road', city: 'Kolhapur', state: 'Maharashtra', pincode: '416001' },
      govtIdType: 'Driving License', monthlyFee: 100,
    },
  ];

  const customers = await Customer.insertMany(customersData);
  console.log(`✅ Created ${customers.length} customers`);

  console.log('\n🎉 Seed complete! Start the app with: npm run dev\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
