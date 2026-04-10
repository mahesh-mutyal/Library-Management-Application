const express = require('express');
const router = express.Router();
const { requireAuth, requireStaff } = require('../middleware/auth');
const { uploadBookImage, uploadExcel } = require('../middleware/upload');
const ctrl = require('../controllers/bookController');

router.get('/',                requireAuth, ctrl.index);
router.get('/add',             requireStaff, ctrl.getAdd);
router.post('/add',            requireStaff, uploadBookImage.single('image'), ctrl.postAdd);
router.post('/import',         requireStaff, uploadExcel.single('excelFile'), ctrl.importExcel);
router.get('/:id',             requireAuth, ctrl.getDetail);
router.get('/:id/edit',        requireStaff, ctrl.getEdit);
router.put('/:id',             requireStaff, uploadBookImage.single('image'), ctrl.update);
router.delete('/:id',          requireStaff, ctrl.delete);
router.get('/:id/qr',          requireAuth, ctrl.getQR);

module.exports = router;
