const express = require('express');
const cors = require('cors');
const path = require('path'); // Đưa lên đầu
require('dotenv').config();
const db = require('./config/database');

const packageRoutes = require('./routes/packageRoutes');
const authRoutes = require('./routes/authRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const fieldRoutes = require('./routes/fieldRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const cacheRoutes = require('./routes/cacheRoutes');
const staffRoutes = require('./routes/staffRoutes');
const customerRoutes = require('./routes/customerRoutes');
const financeRoutes = require('./routes/financeRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const initCronJobs = require('./jobs/cronJobs');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- PHẦN QUAN TRỌNG: PHỤC VỤ FILE TĨNH ---
// Vì index.js nằm trong thư mục src/, nên ta dùng '../public' để nhảy ra ngoài thư mục gốc
app.use(express.static(path.join(__dirname, '../public'))); 

// Routes API
app.use('/api/packages', packageRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chatbot', chatbotRoutes);

// --- CẤU HÌNH TRANG CHỦ ---
// Xóa bỏ app.get('/') cũ trả về JSON, thay bằng cái này:
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/tenant-admin.html'));
});

// Test DB Connection
app.get('/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.json({ message: 'Database connected successfully!', result: rows[0].result });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ message: 'Database connection failed!', error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  initCronJobs();
});

const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// Tự động chạy migration khi khởi động server
knex.migrate.latest()
  .then(() => {
    console.log('Database migrated successfully!');
    // Sau khi migrate xong mới chạy server (tùy chọn)
  })
  .catch((err) => {
    console.error('Migration error:', err);
  });