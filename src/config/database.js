const mysql = require('mysql2');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Thêm cấu hình SSL nếu chạy trên Production hoặc khi bật DB_SSL=true (Aiven yêu cầu SSL)
if (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production') {
  config.ssl = {
    rejectUnauthorized: false
  };
}

const pool = mysql.createPool(config);

module.exports = pool.promise();
