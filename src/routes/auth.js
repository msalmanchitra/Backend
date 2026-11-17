const express = require('express');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    throw new ApiError(400, 'Name must be between 2 and 80 characters.');
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new ApiError(400, 'A valid email address is required.');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new ApiError(400, 'Password must be between 8 and 128 characters.');
  }

  const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password });
  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token: createToken(user),
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new ApiError(400, 'Email and password are required.');
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Email or password is incorrect.');
  }

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token: createToken(user),
  });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.auth.userId).select('name email role createdAt');
  if (!user) {
    throw new ApiError(401, 'User account no longer exists.');
  }
  res.json({ user });
});

module.exports = router;
