const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// ─── Book image storage ───────────────────────────────────────────────────────
const bookStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/books');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `book-${Date.now()}${ext}`);
  },
});

// ─── Govt ID storage (protected — not publicly served) ───────────────────────
const idStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/ids');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `id-${Date.now()}${ext}`);
  },
});

// ─── Excel upload storage ─────────────────────────────────────────────────────
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/excel');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `import-${Date.now()}.xlsx`);
  },
});

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

const pdfImageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only image/PDF files are allowed'), false);
};

const excelFilter = (req, file, cb) => {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
};

const uploadBookImage = multer({ storage: bookStorage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadGovtId    = multer({ storage: idStorage,   fileFilter: pdfImageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadExcel     = multer({ storage: excelStorage, fileFilter: excelFilter, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { uploadBookImage, uploadGovtId, uploadExcel };
