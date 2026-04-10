const express = require('express');
const router = express.Router();
const { requireAuth, requireStaff } = require('../middleware/auth');
const ctrl = require('../controllers/transactionController');

router.get('/',                requireAuth, ctrl.index);
router.get('/checkout',        requireStaff, ctrl.getCheckout);
router.post('/checkout',       requireStaff, ctrl.postCheckout);
router.get('/checkin',         requireStaff, ctrl.getCheckin);
router.post('/checkin',        requireStaff, ctrl.postCheckin);
router.get('/:id',             requireAuth, ctrl.getDetail);
router.post('/:id/pay-fine',   requireStaff, ctrl.payFine);
router.post('/:id/extend',     requireStaff, ctrl.extendDueDate);

module.exports = router;
