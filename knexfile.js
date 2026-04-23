require('dotenv').config();

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {

  // Cấu hình dùng khi chạy ở máy cá nhân (Localhost)
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'footfield'
    },
    migrations: {
      directory: './src/db/migrations' // Đường dẫn thư mục chứa file tạo bảng
    },
    seeds: {
      directory: './src/db/seeds' // Đường dẫn thư mục chứa dữ liệu mẫu
    }
  },

  // Cấu hình dùng khi deploy lên Render/Vercel (Production)
  production: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      // SSL là bắt buộc khi kết nối đến MySQL trên Aiven để tránh lỗi ETIMEDOUT
      ssl: {
        rejectUnauthorized: false
      }
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './src/db/migrations'
    },
    seeds: {
      directory: './src/db/seeds'
    }
  }

};