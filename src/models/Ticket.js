const db = require('../config/database');

const Ticket = {
  getAll: async () => {
    const [rows] = await db.query('SELECT * FROM tickets ORDER BY created_at DESC');
    return rows;
  },
  getOpenCount: async () => {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM tickets WHERE status != "resolved"');
    return rows[0].count;
  },
  updateStatus: async (id, status) => {
    const [result] = await db.query('UPDATE tickets SET status = ? WHERE id = ?', [status, id]);
    return result;
  },
  create: async (data) => {
    const { id, tenant_id, subject, type, priority, message, tenant_name } = data;
    const [result] = await db.query(
      'INSERT INTO tickets (id, tenant_id, subject, type, priority, message, tenant_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, tenant_id, subject, type, priority, message, tenant_name]
    );
    return result;
  },
  getByTenant: async (tenantId) => {
    const [rows] = await db.query('SELECT * FROM tickets WHERE tenant_id = ? ORDER BY created_at DESC', [tenantId]);
    return rows;
  }
};

module.exports = Ticket;
