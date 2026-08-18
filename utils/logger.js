const winston = require('winston');
const path = require('path');

// Vercel and other serverless platforms use a read-only filesystem.
// Attempting to write log files (e.g. mkdir 'logs/') will throw EROFS.
// Detect serverless environment and fall back to console-only logging.
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.simple()
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Always include a Console transport so logs are visible in Vercel's log viewer
const transports = [
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'development'
      ? winston.format.combine(winston.format.colorize(), consoleFormat)
      : jsonFormat
  })
];

// Only add file transports when running on a writable filesystem (e.g. local dev / VPS)
if (!isServerless) {
  const DailyRotateFile = require('winston-daily-rotate-file');
  const logDir = 'logs';

  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  );
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  defaultMeta: { service: 'bootble-fitness-backend' },
  transports
});

module.exports = logger;