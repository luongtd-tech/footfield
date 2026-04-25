const db = require('../config/database');

const Finance = {
  getStats: async (tenantId) => {
    // Precise "Today" in UTC+7
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    
    // Current Month start and end
    const startOfMonth = new Date(vnTime.getFullYear(), vnTime.getMonth(), 1).toISOString().slice(0, 10);
    const endOfMonth = new Date(vnTime.getFullYear(), vnTime.getMonth() + 1, 0).toISOString().slice(0, 10);
    
    // Previous Month start and end
    const startOfPrevMonth = new Date(vnTime.getFullYear(), vnTime.getMonth() - 1, 1).toISOString().slice(0, 10);
    const endOfPrevMonth = new Date(vnTime.getFullYear(), vnTime.getMonth(), 0).toISOString().slice(0, 10);

    // 1. Current Month Revenue
    const [[currMonthRev]] = await db.query(`
      SELECT SUM(total_price) as sum, COUNT(*) as count 
      FROM bookings 
      WHERE tenant_id = ? AND date BETWEEN ? AND ? AND paid = 1
    `, [tenantId, startOfMonth, endOfMonth]);

    // 2. Previous Month Revenue
    const [[prevMonthRev]] = await db.query(`
      SELECT SUM(total_price) as sum 
      FROM bookings 
      WHERE tenant_id = ? AND date BETWEEN ? AND ? AND paid = 1
    `, [tenantId, startOfPrevMonth, endOfPrevMonth]);

    // 3. Unpaid amount (Current Month)
    const [[unpaidStats]] = await db.query(`
      SELECT SUM(total_price) as sum, COUNT(*) as count 
      FROM bookings 
      WHERE tenant_id = ? AND date BETWEEN ? AND ? AND paid = 0
    `, [tenantId, startOfMonth, endOfMonth]);

    // 4. Occupancy Rate (Monthly performance)
    const [[totalFields]] = await db.query('SELECT COUNT(*) as count FROM fields WHERE tenant_id = ?', [tenantId]);
    const [[bookedHours]] = await db.query(`
      SELECT SUM(duration) as total 
      FROM bookings 
      WHERE tenant_id = ? AND date BETWEEN ? AND ? AND status != 'cancelled'
    `, [tenantId, startOfMonth, endOfMonth]);

    // Capacity = Total Fields * 15 hours/day * days in current month
    const daysInMonth = new Date(vnTime.getFullYear(), vnTime.getMonth() + 1, 0).getDate();
    const totalCapacity = (totalFields.count || 0) * 15 * daysInMonth;
    const occupancyRate = totalCapacity > 0 ? ((bookedHours.total || 0) / totalCapacity * 100) : 0;
    const growth = prevMonthRev.sum > 0 ? ((currMonthRev.sum - prevMonthRev.sum) / prevMonthRev.sum * 100) : 0;

    return {
      totalRevenue: currMonthRev.sum || 0,
      paidCount: currMonthRev.count || 0,
      unpaidAmount: unpaidStats.sum || 0,
      unpaidCount: unpaidStats.count || 0,
      growthPercentage: growth,
      occupancyRate: occupancyRate,
      prevMonthName: new Date(startOfPrevMonth).toLocaleString('vi-VN', { month: 'long' })
    };
  },

  getPaymentBreakdown: async (tenantId) => {
    const [rows] = await db.query(`
      SELECT payment_method as id, SUM(total_price) as value
      FROM bookings
      WHERE tenant_id = ? AND paid = 1
      GROUP BY payment_method
    `, [tenantId]);
    return rows;
  },

  getFieldRevenue: async (tenantId) => {
    const [rows] = await db.query(`
      SELECT f.name, SUM(b.total_price) as value
      FROM bookings b
      JOIN fields f ON b.field_id = f.id
      WHERE b.tenant_id = ? AND b.paid = 1
      GROUP BY f.id, f.name
    `, [tenantId]);
    return rows;
  },

  getRecentTransactions: async (tenantId) => {
    const [rows] = await db.query(`
      SELECT b.*, f.name as field_name
      FROM bookings b
      JOIN fields f ON b.field_id = f.id
      WHERE b.tenant_id = ?
      ORDER BY b.date DESC, b.start_time DESC
      LIMIT 20
    `, [tenantId]);
    return rows;
  }
};

module.exports = Finance;
