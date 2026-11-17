const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = error.statusCode || 500;
  let message = statusCode === 500 ? 'An unexpected server error occurred.' : error.message;

  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = error.message;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource identifier.';
  } else if (error.code === 11000) {
    statusCode = 409;
    message = 'A record with that value already exists.';
  } else if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body contains invalid JSON.';
  } else if (error.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large.';
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  return res.status(statusCode).json({ message });
}

module.exports = { notFound, errorHandler };
