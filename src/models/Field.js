const db = require('../config/database');

const Field = {
  findByTenant: async (tenantId) => {
    const [fields] = await db.query('SELECT * FROM fields WHERE tenant_id = ?', [tenantId]);
    return fields;
  },

  create: async (field) => {
    await db.query('INSERT INTO fields SET ?', [field]);
    return field;
  },

  updateStatus: async (id, status) => {
    const [result] = await db.query('UPDATE fields SET status = ? WHERE id = ?', [status, id]);
    return result.affectedRows > 0;
  },

  update: async (id, fieldData) => {
    const [result] = await db.query('UPDATE fields SET ? WHERE id = ?', [fieldData, id]);
    return result.affectedRows > 0;
  },

  remove: async (id) => {
    const [result] = await db.query('DELETE FROM fields WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
};

module.exports = Field;
