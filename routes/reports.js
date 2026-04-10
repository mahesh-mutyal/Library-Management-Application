const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

router.get('/',        requireAuth, ctrl.index);
router.get('/export',  requireAuth, ctrl.exportExcel);

module.exports = router;
