import AppError from '../utils/appError.js';

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.keyValue ? Object.values(err.keyValue).join(', ') : 'value';
  const message = `Duplicate value: "${value}". Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

/** Map known library errors to safe, operational AppErrors. */
function normalizeError(err) {
  if (err instanceof AppError || err.isOperational) return err;
  if (err.name === 'CastError') return handleCastErrorDB(err);
  if (err.code === 11000) return handleDuplicateFieldsDB(err);
  if (err.name === 'ValidationError' && err.errors) return handleValidationErrorDB(err);
  if (err.name === 'JsonWebTokenError') return handleJWTError();
  if (err.name === 'TokenExpiredError') return handleJWTExpiredError();
  // Prisma known request errors
  if (err.code === 'P2002') return new AppError('A record with these details already exists', 409);
  if (err.code === 'P2025') return new AppError('Record not found', 404);
  // body-parser (malformed JSON, payload too large) — client errors with expose=true
  if (err.expose && Number(err.status) >= 400 && Number(err.status) < 500) {
    return new AppError(
      err.type === 'entity.parse.failed' ? 'Malformed JSON body' : err.message,
      Number(err.status)
    );
  }
  if (typeof err.message === 'string' && err.message.startsWith('CORS blocked')) {
    return new AppError('Origin not allowed', 403);
  }
  return err;
}

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
    });
  }
};

// eslint-disable-next-line no-unused-vars
const globalErrorHandler = (rawErr, req, res, next) => {
  const err = normalizeError(rawErr);
  err.statusCode = err.statusCode || 500;
  err.status = err.status || (String(err.statusCode).startsWith('4') ? 'fail' : 'error');

  if (err.statusCode >= 500) {
    console.error(
      `[error] ${req.method} ${req.originalUrl} → ${err.statusCode}:`,
      err.isOperational ? err.message : err
    );
  }

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    // production, test, or unset — never leak stacks
    sendErrorProd(err, res);
  }
};

export default globalErrorHandler;
