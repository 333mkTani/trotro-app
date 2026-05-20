const { ApiError } = require('../utils/ApiError');

const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  if (err && err.name === 'ZodError') {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Invalid request payload',
      details: err.issues,
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.name,
      message: err.message,
      details: err.details,
    });
  }

  // pg unique violation
  if (err && err.code === '23505') {
    return res.status(409).json({ error: 'Conflict', message: 'Resource already exists' });
  }
  // pg foreign key violation
  if (err && err.code === '23503') {
    return res.status(400).json({ error: 'BadRequest', message: 'Invalid reference' });
  }

  console.error('[trotro-api] unhandled error', err);
  return res.status(500).json({ error: 'InternalServerError', message: 'Something went wrong' });
};

module.exports = { notFound, errorHandler };
