/**
 * Calculate fine for an overdue book.
 * @param {Date} dueDate
 * @param {Date} returnDate  (defaults to today)
 * @param {number} finePerDay  (default ₹2)
 * @returns {number} fine amount in ₹
 */
const calculateFine = (dueDate, returnDate = new Date(), finePerDay = 2) => {
  const due = new Date(dueDate);
  const ret = new Date(returnDate);
  if (ret <= due) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLate = Math.ceil((ret - due) / msPerDay);
  return daysLate * finePerDay;
};

module.exports = { calculateFine };
