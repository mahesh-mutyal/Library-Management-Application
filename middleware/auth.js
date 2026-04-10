const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Attach current user to res.locals from JWT cookie
const setCurrentUser = async (req, res, next) => {
  const token = req.cookies?.token;
  res.locals.currentUser = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        req.user = user;
        res.locals.currentUser = user;
      }
    } catch (err) {
      res.clearCookie('token');
    }
  }
  next();
};

// Require login
const requireAuth = (req, res, next) => {
  if (!req.user) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/login');
  }
  next();
};

// Require admin role
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/login');
  }
  if (req.user.role !== 'admin') {
    req.flash('error', 'Access denied. Admin only.');
    return res.redirect('/dashboard');
  }
  next();
};

// Require admin or employee
const requireStaff = (req, res, next) => {
  if (!req.user) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/login');
  }
  if (!['admin', 'employee'].includes(req.user.role)) {
    req.flash('error', 'Access denied.');
    return res.redirect('/dashboard');
  }
  next();
};

module.exports = { setCurrentUser, requireAuth, requireAdmin, requireStaff };
