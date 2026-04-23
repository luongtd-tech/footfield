const express = require('express');
const cors = require('cors');
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
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve frontend files

// Routes
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

// Basic Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to FootField Backend API' });
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


const path = require('path');
// Khai báo thư mục public chứa file html, css, js
app.use(express.static(path.join(__dirname, '../public'))); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/tenant-admin.html'));
});