const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
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
const paymentRoutes = require('./routes/paymentRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const initCronJobs = require('./jobs/cronJobs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 10000;

// Socket.io Signaling Logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
    socket.to(roomId).emit('user-joined', { userId: socket.id, roomId });
  });

  socket.on('offer', (payload) => {
    io.to(payload.target).emit('offer', {
      sdp: payload.sdp,
      sender: socket.id,
      roomId: payload.roomId
    });
  });

  socket.on('answer', (payload) => {
    io.to(payload.target).emit('answer', {
      sdp: payload.sdp,
      sender: socket.id
    });
  });

  socket.on('ice-candidate', (payload) => {
    io.to(payload.target).emit('ice-candidate', {
      candidate: payload.candidate,
      sender: socket.id
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

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
app.use('/api/payment', paymentRoutes);
app.use('/api/services', serviceRoutes);

// --- CẤU HÌNH CÁC TRANG HTML (Routes) ---
// Trang chủ: Dành cho Chủ sân (Tenant Admin)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/tenant-admin.html'));
});

// Trang Quản trị hệ thống: Dành cho Provider (Provider Admin)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/provider-admin.html'));
});

// Trang đặt sân: Dành cho khách hàng (Customer)
app.get('/booking', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/customer.html'));
});

// Debug DB structure & Emergency Fix
app.get('/api/debug-db', async (req, res) => {
  try {
    // Thử sửa bảng trực tiếp tại đây
    let fixLog = [];
    try {
      await db.query("ALTER TABLE notifications ADD COLUMN tenant_id VARCHAR(50) AFTER id");
      fixLog.push("Added tenant_id");
    } catch (e) { fixLog.push("tenant_id error: " + e.message); }

    try {
      await db.query("ALTER TABLE notifications ADD COLUMN is_read TINYINT(1) DEFAULT 0 AFTER type");
      fixLog.push("Added is_read");
    } catch (e) { fixLog.push("is_read error: " + e.message); }

    const [columns] = await db.query('DESCRIBE notifications');
    const [tables] = await db.query('SHOW TABLES');
    res.json({ 
      message: 'Database checked and fix applied', 
      fix_log: fixLog,
      tables: tables.map(t => Object.values(t)[0]),
      notifications_columns: columns 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test DB Connection

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  initCronJobs();
});

const knex = require('knex')(require('../knexfile')[process.env.NODE_ENV || 'development']);

// Tự động chạy migration và seed khi khởi động server
knex.migrate.latest()
  .then(async () => {
    console.log('Database migrated successfully!');
    
    // HARD FIX: Đảm bảo bảng notifications có đủ cột bằng SQL thuần (MySQL 8.0 syntax)
    try {
      await db.query("ALTER TABLE notifications ADD COLUMN tenant_id VARCHAR(50) AFTER id");
    } catch (err) {
      console.log('Column tenant_id might already exist, skipping...');
    }

    try {
      await db.query("ALTER TABLE notifications ADD COLUMN is_read TINYINT(1) DEFAULT 0 AFTER type");
      console.log('Notifications table hard-fixed successfully!');
    } catch (err) {
      console.log('Column is_read might already exist, skipping...');
    }

    // Kiểm tra nếu chưa có admin thì mới chạy seed
    return knex('admins').count('id as count');
  })
  .then((rows) => {
    const count = rows[0].count || rows[0]['count(*)'] || 0;
    if (count === 0) {
      console.log('Database is empty, seeding initial data...');
      return knex.seed.run();
    }
  })
  .catch((err) => {
    console.error('Migration error:', err);
  });