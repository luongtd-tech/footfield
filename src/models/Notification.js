const db = require('../config/database');

const Notification = {
  getAll: async () => {
    const [rows] = await db.query('SELECT * FROM notifications ORDER BY created_at DESC');
    return rows;
  },
  findByTenant: async (tenantId) => {
    const [rows] = await db.query('SELECT * FROM notifications WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY created_at DESC', [tenantId]);
    return rows;
  },
  getUnreadCount: async (tenantId) => {
    const [[row]] = await db.query('SELECT COUNT(*) as count FROM notifications WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_read = 0', [tenantId]);
    return row.count;
  },
  create: async (data) => {
    const { id, tenant_id, title, message, type, target } = data;
    const [result] = await db.query(
      'INSERT INTO notifications (id, tenant_id, title, message, type, target) VALUES (?, ?, ?, ?, ?, ?)',
      [id, tenant_id, title, message, type, target]
    );
    return result;
  },
  markAllAsRead: async (tenantId) => {
    const [result] = await db.query('UPDATE notifications SET is_read = 1 WHERE tenant_id = ? OR tenant_id IS NULL', [tenantId]);
    return result;
  },
  delete: async (id) => {
    const [result] = await db.query('DELETE FROM notifications WHERE id = ?', [id]);
    return result;
  }
};

module.exports = Notification;
