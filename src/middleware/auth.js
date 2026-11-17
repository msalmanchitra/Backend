const jwt = require('jsonwebtoken');

const ApiError = require('../utils/ApiError');

function authenticate(req, res, next) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Please sign in to continue.'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = { userId: payload.sub, role: payload.role };
    return next();
  } catch (error) {
    return next(new ApiError(401, 'Your session is invalid or has expired.'));
  }
}

function requireAdmin(req, res, next) {
  if (req.auth.role !== 'admin') {
    return next(new ApiError(403, 'Administrator access is required.'));
  }
  return next();
}

module.exports = { authenticate, requireAdmin };
