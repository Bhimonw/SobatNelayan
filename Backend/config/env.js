// Centralized environment loader for backend
require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  JWT_SECRET: process.env.JWT_SECRET || 'sobatnelayan_secret_key',
  REFRESH_SECRET: process.env.REFRESH_SECRET || 'sobatnelayan_refresh_secret',
  ACCESS_TOKEN_EXPIRES: process.env.ACCESS_TOKEN_EXPIRES || '15m',
  REFRESH_TOKEN_EXPIRES: process.env.REFRESH_TOKEN_EXPIRES || '7d',
  DB_DIALECT: process.env.DB_DIALECT || 'mysql',
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: process.env.DB_PORT || 3306,
  DB_NAME: process.env.DB_NAME || 'db_sobatnelayan',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASS: process.env.DB_PASS || '',
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || null,
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || null,
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || null,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || null,
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || null,
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || null,
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || null,
  SOCKET_PATH: process.env.SOCKET_PATH || '/socket.io'
};

module.exports = env;
