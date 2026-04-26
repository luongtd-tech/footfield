const admin = require('firebase-admin');
const db = require('../config/database');

// Initialize Firebase Admin
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin:', err.message);
  }
} else {
  console.log('FIREBASE_SERVICE_ACCOUNT not found in environment');
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
      const tokens = rows.map(r => r.fcm_token);
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
  }
};

module.exports = pushNotifier;
