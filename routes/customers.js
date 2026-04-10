const express = require('express');
const router = express.Router();
const { requireAuth, requireStaff } = require('../middleware/auth');
const { uploadGovtId, uploadExcel } = require('../middleware/upload');
const ctrl = require('../controllers/customerController');

router.get('/',                requireAuth, ctrl.index);
router.get('/add',             requireStaff, ctrl.getAdd);
router.post('/add',            requireStaff, uploadGovtId.single('govtIdFile'), ctrl.postAdd);
router.post('/import',         requireStaff, uploadExcel.single('excelFile'), ctrl.importExcel);
router.get('/:id',             requireAuth, ctrl.getDetail);
router.get('/:id/edit',        requireStaff, ctrl.getEdit);
router.put('/:id',             requireStaff, uploadGovtId.single('govtIdFile'), ctrl.update);
router.delete('/:id',          requireStaff, ctrl.delete);
router.post('/:id/payment',    requireStaff, ctrl.recordPayment);

module.exports = router;
