require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const morgan = require('morgan');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const i18nextMiddleware = require('i18next-http-middleware');

const connectDB = require('./config/database');
const { scheduleJobs } = require('./jobs/scheduler');

// ─── Connect Database ────────────────────────────────────────────────────────
connectDB();

// ─── i18n Setup ──────────────────────────────────────────────────────────────
i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    backend: { loadPath: path.join(__dirname, 'locales/{{lng}}/translation.json') },
    fallbackLng: 'en',
    preload: ['en', 'mr'],
    detection: {
      order: ['querystring', 'cookie', 'header'],
      caches: ['cookie'],
      lookupQuerystring: 'lang',
      lookupCookie: 'i18next',
    },
    ns: ['translation'],
    defaultNS: 'translation',
  });

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();

// Security & performance
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
}));
app.use(compression());
app.use(mongoSanitize());

// Logging
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(flash());

// i18n middleware
app.use(i18nextMiddleware.handle(i18next));

// Static files — NOTE: /uploads/ids is NOT served publicly (security)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads/books', express.static(path.join(__dirname, 'uploads/books')));

// ─── View Engine ─────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(require('./middleware/auth').setCurrentUser);
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.t = req.t;
  res.locals.currentLang = req.language || 'en';
  res.locals.appName = process.env.APP_NAME || 'Library';
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/books', require('./routes/books'));
app.use('/customers', require('./routes/customers'));
app.use('/transactions', require('./routes/transactions'));
app.use('/reports', require('./routes/reports'));
app.use('/api', require('./routes/api'));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('errors/404', { layout: 'layouts/main', title: '404 – Page Not Found' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('errors/500', { layout: 'layouts/main', title: 'Server Error', error: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n📚 Library Management App running at http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV}`);
  scheduleJobs();
});

module.exports = app;
