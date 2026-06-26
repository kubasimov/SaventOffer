const express = require('express');
const { jwtSecret } = require('../config');

function notFound(req, res, next) {
  const err = new Error(`Not Found: ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

function errorHandler(err, req, res, next) {
  const status = typeof err.status === 'number' ? err.status : 500;
  const message = typeof err.message === 'string' ? err.message : 'Internal Server Error';

  if (process.env.NODE_ENV !== 'test' && !res.headersSent) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${status} ${message}`);
  }

  res.status(status).json({ error: message });
}

function asyncWrap(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { notFound, errorHandler, asyncWrap };
