const moment = require('moment');
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const Book = require('../models/Book');
const PaymentHistory = require('../models/PaymentHistory');
const XLSX = require('xlsx');

// GET /reports
exports.index = async (req, res) => {
  try {
    const { from, to } = req.query;
    const startDate = from ? moment(from).startOf('day').toDate() : moment().subtract(30, 'days').startOf('day').toDate();
    const endDate   = to   ? moment(to).endOf('day').toDate()     : moment().endOf('day').toDate();

    const [
      checkouts,
      overdueList,
      finesPending,
      revenueData,
    ] = await Promise.all([
      Transaction.find({ checkoutDate: { $gte: startDate, $lte: endDate } })
        .populate('book', 'title bookNumber category')
        .populate('customer', 'name email mobile')
        .sort({ checkoutDate: -1 }),
      Transaction.find({ status: 'overdue' })
        .populate('book', 'title bookNumber')
        .populate('customer', 'name email mobile'),
      Transaction.find({ fineStatus: 'pending' })
        .populate('book', 'title bookNumber')
        .populate('customer', 'name email mobile'),
      PaymentHistory.aggregate([
        { $match: { status: 'paid', paidDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { month: '$month', year: '$year' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    const totalFinesPending = finesPending.reduce((s, t) => s + t.fineAmount, 0);

    res.render('reports/index', {
      title: 'Reports',
      checkouts,
      overdueList,
      finesPending,
      totalFinesPending,
      revenueData,
      dateRange: {
        from: moment(startDate).format('YYYY-MM-DD'),
        to: moment(endDate).format('YYYY-MM-DD'),
      },
      moment,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load reports.');
    res.redirect('/dashboard');
  }
};

// GET /reports/export?type=checkouts|customers|fines
exports.exportExcel = async (req, res) => {
  try {
    const { type = 'checkouts', from, to } = req.query;
    const startDate = from ? moment(from).startOf('day').toDate() : moment().subtract(30, 'days').toDate();
    const endDate   = to   ? moment(to).endOf('day').toDate()     : moment().endOf('day').toDate();

    let data = [], sheetName = 'Report', filename = 'report';

    if (type === 'checkouts') {
      const txns = await Transaction.find({ checkoutDate: { $gte: startDate, $lte: endDate } })
        .populate('book', 'title bookNumber category')
        .populate('customer', 'name mobile');
      data = txns.map(t => ({
        'Book Title': t.book?.title || '',
        'Book Number': t.book?.bookNumber || '',
        'Category': t.book?.category || '',
        'Customer': t.customer?.name || '',
        'Mobile': t.customer?.mobile || '',
        'Checkout Date': moment(t.checkoutDate).format('DD/MM/YYYY'),
        'Due Date': moment(t.dueDate).format('DD/MM/YYYY'),
        'Return Date': t.checkinDate ? moment(t.checkinDate).format('DD/MM/YYYY') : '',
        'Status': t.status,
        'Fine (₹)': t.fineAmount || 0,
        'Fine Status': t.fineStatus,
      }));
      sheetName = 'Checkouts'; filename = 'checkouts';
    } else if (type === 'customers') {
      const customers = await Customer.find().sort({ createdAt: -1 });
      data = customers.map(c => ({
        'Name': c.name,
        'Email': c.email,
        'Mobile': c.mobile,
        'City': c.address?.city || '',
        'State': c.address?.state || '',
        'Membership Date': moment(c.membershipDate).format('DD/MM/YYYY'),
        'Monthly Fee (₹)': c.monthlyFee,
        'Total Borrowed': c.totalBorrowed,
        'Active': c.isActive ? 'Yes' : 'No',
      }));
      sheetName = 'Customers'; filename = 'customers';
    } else if (type === 'fines') {
      const txns = await Transaction.find({ fineAmount: { $gt: 0 } })
        .populate('book', 'title bookNumber')
        .populate('customer', 'name mobile');
      data = txns.map(t => ({
        'Book': t.book?.title || '',
        'Customer': t.customer?.name || '',
        'Mobile': t.customer?.mobile || '',
        'Due Date': moment(t.dueDate).format('DD/MM/YYYY'),
        'Return Date': t.checkinDate ? moment(t.checkinDate).format('DD/MM/YYYY') : 'Not returned',
        'Fine (₹)': t.fineAmount,
        'Fine Status': t.fineStatus,
      }));
      sheetName = 'Fines'; filename = 'fines';
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="${filename}-${moment().format('YYYYMMDD')}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to export.');
    res.redirect('/reports');
  }
};
