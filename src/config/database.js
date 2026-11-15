const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
    console.log('🔗 Kết nối thành công tới PostgreSQL!');
});

pool.on('error', error => {
    console.error('Lỗi kết nối PostgreSQL khi client đang rảnh:', error.message);
});

module.exports = pool;
