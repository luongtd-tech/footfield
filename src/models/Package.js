const db = require('../config/database');

const Package = {
  getAll: async () => {
    const [rows] = await db.query(`
      SELECT p.*, 
             COUNT(t.id) as tenant_count,
             SUM(CASE WHEN t.status = 'active' THEN 1 ELSE 0 END) as active_tenant_count,
             SUM(CASE WHEN t.status = 'active' AND t.billing_cycle = 'monthly' THEN p.price_monthly 
                      WHEN t.status = 'active' AND t.billing_cycle = 'yearly' THEN p.price_yearly / 12 
                      ELSE 0 END) as monthly_revenue
      FROM packages p
      LEFT JOIN tenants t ON p.id = t.package_id
      GROUP BY p.id
    `);
    return rows;
  },
  getById: async (id) => {
    const [rows] = await db.query('SELECT * FROM packages WHERE id = ?', [id]);
    return rows[0];
  },
  create: async (data) => {
    const { id, name, price_monthly, price_yearly, max_fields, features, color, popular } = data;
    const [result] = await db.query(
      'INSERT INTO packages (id, name, price_monthly, price_yearly, max_fields, features, color, popular) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, price_monthly, price_yearly, max_fields, features, color, popular]
    );
    return result;
  },
  update: async (id, data) => {
    const { name, price_monthly, price_yearly, max_fields, features, color, popular } = data;
    const [result] = await db.query(
      'UPDATE packages SET name = ?, price_monthly = ?, price_yearly = ?, max_fields = ?, features = ?, color = ?, popular = ? WHERE id = ?',
      [name, price_monthly, price_yearly, max_fields, features, color, popular, id]
    );
    return result;
  },
  delete: async (id) => {
    const [result] = await db.query('DELETE FROM packages WHERE id = ?', [id]);
    return result;
  }
};

module.exports = Package;
