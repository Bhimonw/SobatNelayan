'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
let config = require(__dirname + '/../config/config.json')[env];
// Allow overriding sequelize config via explicit environment variables to avoid hardcoded 'root'.
// If env vars exist use them; otherwise fallback to config.json
const envDb = {
    username: process.env.DB_USER || config.username,
    password: (process.env.DB_PASS !== undefined ? process.env.DB_PASS : config.password),
    database: process.env.DB_NAME || config.database,
    host: process.env.DB_HOST || config.host,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : config.port,
    dialect: process.env.DB_DIALECT || config.dialect
};
config = { ...config, ...envDb };
const db = {};

let sequelize;
if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Security warning for production if defaults are still in place
if (env === 'production') {
    if (config.username === 'root') {
        console.warn('[SECURITY] Database user is still "root" in production. Set DB_USER to a dedicated least-privilege user.');
    }
    if (!config.password || config.password === 'password' || config.password === 'root') {
        console.warn('[SECURITY] Weak or empty database password in production. Set a strong DB_PASS.');
    }
}

fs
    .readdirSync(__dirname)
    .filter(file => {
        return (
            file.indexOf('.') !== 0 &&
            file !== basename &&
            file.slice(-3) === '.js'
        );
    })
    .forEach(file => {
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
    });

Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
