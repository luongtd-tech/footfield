const db = require('../config/database');

const Invoice = {
  getAll: async () => {
    const [rows] = await db.query(`
      SELECT si.*, t.name as tenant_name, t.email as tenant_email, t.phone as tenant_phone, t.address as tenant_address, p.name as package_name
      FROM service_invoices si
      JOIN tenants t ON si.tenant_id = t.id
      JOIN packages p ON si.package_id = p.id
      ORDER BY si.created_at DESC
    `);
    return rows;
  },
  getStats: async () => {
    const [paid] = await db.query("SELECT SUM(amount) as total FROM service_invoices WHERE status = 'paid'");
    const [unpaid] = await db.query("SELECT SUM(amount) as total FROM service_invoices WHERE status = 'unpaid'");
    const [overdue] = await db.query("SELECT SUM(amount) as total FROM service_invoices WHERE status = 'overdue'");
    
    const [paidCount] = await db.query("SELECT COUNT(*) as count FROM service_invoices WHERE status = 'paid'");
    const [unpaidCount] = await db.query("SELECT COUNT(*) as count FROM service_invoices WHERE status = 'unpaid'");
    const [overdueCount] = await db.query("SELECT COUNT(*) as count FROM service_invoices WHERE status = 'overdue'");

    return {
      paid: { total: paid[0].total || 0, count: paidCount[0].count },
      unpaid: { total: unpaid[0].total || 0, count: unpaidCount[0].count },
      overdue: { total: overdue[0].total || 0, count: overdueCount[0].count }
    };
  },
  getMonthlyRevenue: async () => {
    // Lấy doanh thu 6 tháng gần nhất
    const [rows] = await db.query(`
      SELECT 
        DATE_FORMAT(payment_date, '%Y-%m') as month,
        SUM(amount) as revenue
      FROM service_invoices
      WHERE status = 'paid' AND payment_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `);
    return rows;
  },
  updateStatus: async (id, status, paymentDate = null) => {
    const query = paymentDate 
      ? 'UPDATE service_invoices SET status = ?, payment_date = ? WHERE id = ?' 
      : 'UPDATE service_invoices SET status = ? WHERE id = ?';
    const params = paymentDate ? [status, paymentDate, id] : [status, id];
    const [result] = await db.query(query, params);
    return result;
  },
  create: async (data) => {
    const { id, tenant_id, package_id, amount, billing_cycle, status, due_date, payment_date } = data;
    const [result] = await db.query(
      'INSERT INTO service_invoices (id, tenant_id, package_id, amount, billing_cycle, status, due_date, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, tenant_id, package_id, amount, billing_cycle, status, due_date, payment_date]
    );
    return result;
  }
};

module.exports = Invoice;
