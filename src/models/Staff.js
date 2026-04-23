const db = require('../config/database');

const Staff = {
  findByTenant: async (tenantId) => {
    const [staff] = await db.query("SELECT * FROM staff WHERE tenant_id = ? AND status = 'active'", [tenantId]);
    return staff;
  },

  create: async (staffData) => {
    const [result] = await db.query('INSERT INTO staff SET ?', [staffData]);
    return { id: staffData.id || result.insertId, ...staffData };
  },

  updateStatus: async (id, status) => {
    const [result] = await db.query('UPDATE staff SET status = ? WHERE id = ?', [status, id]);
    return result.affectedRows > 0;
  },

  update: async (id, staffData) => {
    const [result] = await db.query('UPDATE staff SET ? WHERE id = ?', [staffData, id]);
    return result.affectedRows > 0;
  },

  remove: async (id) => {
    const [result] = await db.query('DELETE FROM staff WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
};

module.exports = Staff;
