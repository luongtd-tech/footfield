const Notification = require('../models/Notification');
const db = require('../config/database');

const notificationController = {
  getTenantNotifications: async (req, res) => {
    try {
      const { tenantId } = req.params;
      const notifications = await Notification.findByTenant(tenantId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving notifications', error: error.message });
    }
  },

  markAsRead: async (req, res) => {
    try {
      const { tenantId } = req.params;
      await Notification.markAllAsRead(tenantId);
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error marking notifications as read', error: error.message });
    }
  },

  getAllNotifications: async (req, res) => {
    try {
      const notifications = await Notification.getAll();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving notifications', error: error.message });
    }
  },

  updateFCMToken: async (req, res) => {
    try {
      const { type, id, token } = req.body; // type: 'tenant' or 'admin'
      if (!id || !token) return res.status(400).json({ success: false, message: 'Missing id or token' });

      if (type === 'tenant') {
        await db.query('UPDATE tenants SET fcm_token = ? WHERE id = ?', [token, id]);
      } else {
        await db.query('UPDATE admins SET fcm_token = ? WHERE id = ?', [token, id]);
      }
      res.json({ success: true, message: 'FCM token updated' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error updating FCM token', error: error.message });
    }
  },

  createNotification: async (req, res) => {
    try {
      const result = await Notification.create(req.body);
      res.status(201).json({ success: true, message: 'Notification created successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error creating notification', error: error.message });
    }
  },

  deleteNotification: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await Notification.delete(id);
      res.json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error deleting notification', error: error.message });
    }
  }
};

module.exports = notificationController;
