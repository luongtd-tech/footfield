const admin = require('firebase-admin');
const db = require('../config/database');

const path = require('path');

// Initialize Firebase Admin
let serviceAccount;

try {
  // Thử đọc từ file JSON ở thư mục gốc dự án
  serviceAccount = require(path.join(__dirname, '../../firebase-service-account.json'));
} catch (e) {
  // Nếu không có file, thử lấy từ biến môi trường
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const normalized = process.env.FIREBASE_SERVICE_ACCOUNT.replace(/\\n/g, '\n');
      serviceAccount = JSON.parse(normalized);
    } catch (parseError) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseError.message);
    }
  }
}

if (serviceAccount) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized successfully');
    }
  } catch (err) {
    console.error('Failed to initialize Firebase Admin:', err.message);
  }
} else {
  console.log('Firebase Service Account not found. Push notifications disabled.');
}

const pushNotifier = {
  sendToTenant: async (tenantId, title, body, data = {}) => {
    try {
      const [rows] = await db.query('SELECT fcm_token FROM tenants WHERE id = ?', [tenantId]);
      if (rows.length > 0 && rows[0].fcm_token) {
        const message = {
          notification: { title, body },
          data: data,
          token: rows[0].fcm_token
        };
        const response = await admin.messaging().send(message);
        console.log('Successfully sent push to tenant:', response);
        return response;
      }
    } catch (error) {
      console.error('Error sending push to tenant:', error);
    }
  },

  sendToAdmin: async (title, body, data = {}) => {
    try {
      const [rows] = await db.query('SELECT fcm_token FROM admins WHERE fcm_token IS NOT NULL');
      const tokens = rows.map(r => r.fcm_token).filter(t => t);
      if (tokens.length > 0) {
        const message = {
          notification: { title, body },
          data: data,
          tokens: tokens
        };
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log('Successfully sent push to admins:', response.successCount);
        return response;
      }
    } catch (error) {
      console.error('Error sending push to admin:', error);
    }
  },

  sendToCustomer: async (customerId, title, body, data = {}) => {
    try {
      const [rows] = await db.query('SELECT fcm_token FROM customers WHERE id = ?', [customerId]);
      if (rows.length > 0 && rows[0].fcm_token) {
        const message = {
          notification: { title, body },
          data: data,
          token: rows[0].fcm_token
        };
        const response = await admin.messaging().send(message);
        console.log('Successfully sent push to customer:', response);
        return response;
      }
    } catch (error) {
      console.error('Error sending push to customer:', error);
    }
  }
};

module.exports = pushNotifier;
