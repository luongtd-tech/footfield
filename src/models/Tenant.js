const db = require('../config/database');
const Invoice = require('./Invoice');

const Tenant = {
  getAll: async () => {
    const [rows] = await db.query('SELECT t.*, p.name as package_name, p.color as package_color, p.price_monthly, p.price_yearly FROM tenants t LEFT JOIN packages p ON t.package_id = p.id');
    return rows;
  },
  getStats: async () => {
    const [activeTenants] = await db.query("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'");
    const [totalTenants] = await db.query('SELECT COUNT(*) as count FROM tenants');
    const [openTickets] = await db.query("SELECT COUNT(*) as count FROM tickets WHERE status != 'resolved'");
    
    // Thống kê nhà thuê mới trong tháng (30 ngày gần nhất)
    const [newTenants] = await db.query('SELECT COUNT(*) as count FROM tenants WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    
    // Thống kê nhà thuê sắp hết hạn (trong 30 ngày tới)
    const [expiringSoon] = await db.query("SELECT COUNT(*) as count FROM tenants WHERE status = 'active' AND end_date <= DATE_ADD(NOW(), INTERVAL 30 DAY) AND end_date >= NOW()");

    // Simple revenue calculation (sum of monthly/yearly prices of active tenants)
    const [revenue] = await db.query(`
      SELECT SUM(CASE WHEN billing_cycle = 'monthly' THEN p.price_monthly ELSE p.price_yearly / 12 END) as monthly_revenue
      FROM tenants t
      JOIN packages p ON t.package_id = p.id
      WHERE t.status = 'active'
    `);

    return {
      activeTenants: activeTenants[0].count,
      totalTenants: totalTenants[0].count,
      openTickets: openTickets[0].count,
      newTenantsThisMonth: newTenants[0].count,
      expiringSoon: expiringSoon[0].count,
      monthlyRevenue: revenue[0].monthly_revenue || 0
    };
  },

  getDashboardData: async (tenantId) => {
    // 1. Precise "Today" in UTC+7 (Vietnam)
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const today = vnTime.toISOString().slice(0, 10);

    // 2. Stat cards
    const [[activeFields]] = await db.query("SELECT COUNT(*) as count FROM fields WHERE tenant_id = ? AND status = 'available'", [tenantId]);
    const [[todayBookings]] = await db.query("SELECT COUNT(*) as count FROM bookings WHERE tenant_id = ? AND date = ? AND status != 'cancelled'", [tenantId, today]);
    const [[todayRevenue]] = await db.query('SELECT SUM(total_price) as sum FROM bookings WHERE tenant_id = ? AND date = ? AND paid = 1', [tenantId, today]);
    const [[totalCustomers]] = await db.query('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?', [tenantId]);
    const [[vipCount]] = await db.query("SELECT COUNT(*) as count FROM customers WHERE tenant_id = ? AND status = 'vip'", [tenantId]);
    const [[pendingBookings]] = await db.query("SELECT COUNT(*) as count FROM bookings WHERE tenant_id = ? AND status = 'pending'", [tenantId]);
    const [[unreadNotifs]] = await db.query('SELECT COUNT(*) as count FROM notifications WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_read = 0', [tenantId]);

    // Extra metrics for sub-texts
    const [[maintenanceFields]] = await db.query("SELECT COUNT(*) as count FROM fields WHERE tenant_id = ? AND status = 'maintenance'", [tenantId]);
    const [[confirmedToday]] = await db.query("SELECT COUNT(*) as count FROM bookings WHERE tenant_id = ? AND date = ? AND status IN ('confirmed', 'completed')", [tenantId, today]);
    const [[paidTransactionsToday]] = await db.query('SELECT COUNT(*) as count FROM bookings WHERE tenant_id = ? AND date = ? AND paid = 1', [tenantId, today]);

    // 3. Revenue chart (last 7 days) - Ensuring all days are present
    const [revenueRaw] = await db.query(`
      SELECT DATE(date) as day, SUM(total_price) as revenue
      FROM bookings
      WHERE tenant_id = ? AND date >= DATE_SUB(?, INTERVAL 6 DAY) AND paid = 1
      GROUP BY DATE(date)
      ORDER BY day;
    `, [tenantId, today]);

    // Fill gaps for 7 days
    const revenue7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(vnTime);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().slice(0, 10);
        const match = revenueRaw.find(r => {
            const rDay = new Date(r.day).toISOString().slice(0, 10);
            return rDay === dStr;
        });
        revenue7Days.push({
            day: dStr,
            revenue: match ? parseFloat(match.revenue) : 0
        });
    }

    // 3. Today's bookings list
    const [todayBookingsList] = await db.query(`
      SELECT b.id, b.customer_name, b.start_time, b.end_time, b.status, f.name as field_name
      FROM bookings b
      JOIN fields f ON b.field_id = f.id
      WHERE b.tenant_id = ? AND b.date = ?
      ORDER BY b.start_time;
    `, [tenantId, today]);

    // 4. Fields status list
    const [fieldsStatus] = await db.query('SELECT id, name, price_per_hour, status FROM fields WHERE tenant_id = ?', [tenantId]);

    // 5. VIP customers (top 5 by spending)
    const [vipCustomers] = await db.query(`
      SELECT id, name, total_spent, total_bookings, status
      FROM customers
      WHERE tenant_id = ? AND status = 'vip'
      ORDER BY total_spent DESC
      LIMIT 5
    `, [tenantId]);

    return {
      stats: {
        activeFields: activeFields.count,
        todayBookings: todayBookings.count,
        todayRevenue: todayRevenue.sum || 0,
        totalCustomers: totalCustomers.count,
        vipCustomers: vipCount.count,
        pendingBookings: pendingBookings.count,
        unreadNotifications: unreadNotifs.count,
        maintenanceFields: maintenanceFields.count,
        confirmedToday: confirmedToday.count,
        paidTransactionsToday: paidTransactionsToday.count
      },
      revenue7Days,
      todayBookingsList,
      fieldsStatus,
      vipCustomers
    };
  },
  findById: async (id) => {
    const [rows] = await db.query(`
      SELECT t.*, p.name as package_name, p.max_fields, p.features 
      FROM tenants t 
      LEFT JOIN packages p ON t.package_id = p.id 
      WHERE t.id = ?
    `, [id]);
    return rows[0];
  },
  create: async (data) => {
    const { id, name, owner, email, phone, address, username, password, package_id, billing_cycle, status, start_date, end_date, logo } = data;
    
    // Get package price for invoice
    const [pkgs] = await db.query('SELECT price_monthly, price_yearly FROM packages WHERE id = ?', [package_id]);
    const pkg = pkgs[0] || { price_monthly: 0, price_yearly: 0 };
    const amount = billing_cycle === 'yearly' ? pkg.price_yearly : pkg.price_monthly;

    const [result] = await db.query(
      'INSERT INTO tenants (id, name, owner, email, phone, address, username, password, package_id, billing_cycle, status, start_date, end_date, logo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, owner, email, phone, address, username, password, package_id, billing_cycle, status, start_date, end_date, logo]
    );

    // Create initial invoice
    await Invoice.create({
      id: 'INV' + Date.now(),
      tenant_id: id,
      package_id: package_id,
      amount: amount,
      billing_cycle: billing_cycle,
      status: 'paid', // Initial creation from admin usually assumes paid
      due_date: start_date,
      payment_date: new Date()
    });

    return result;
  },
  update: async (id, data) => {
    const fields = Object.keys(data).filter(key => key !== 'id');
    const values = fields.map(key => data[key]);
    
    if (fields.length === 0) return null;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const [result] = await db.query(
      `UPDATE tenants SET ${setClause} WHERE id = ?`,
      [...values, id]
    );
    return result;
  },
  updateStatus: async (id, status) => {
    const [result] = await db.query('UPDATE tenants SET status = ? WHERE id = ?', [status, id]);
    return result;
  },
  updateExpiredTenants: async () => {
    const [result] = await db.query("UPDATE tenants SET status = 'expired' WHERE status = 'active' AND end_date < DATE(NOW())");
    return result;
  },
  renew: async (id) => {
    const [rows] = await db.query('SELECT package_id, end_date, billing_cycle FROM tenants WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const tenant = rows[0];
    const cycle = tenant.billing_cycle;
    const daysToAdd = cycle === 'yearly' ? 365 : 30;
    
    const currentEnd = new Date(tenant.end_date);
    const now = new Date();
    const baseDate = currentEnd < now ? now : currentEnd;
    baseDate.setDate(baseDate.getDate() + daysToAdd);
    const newEndStr = baseDate.toISOString().slice(0, 10);
    
    // Get package price for invoice
    const [pkgs] = await db.query('SELECT price_monthly, price_yearly FROM packages WHERE id = ?', [tenant.package_id]);
    const pkg = pkgs[0] || { price_monthly: 0, price_yearly: 0 };
    const amount = cycle === 'yearly' ? pkg.price_yearly : pkg.price_monthly;

    const [result] = await db.query("UPDATE tenants SET status = 'active', end_date = ? WHERE id = ?", [newEndStr, id]);

    // Create renewal invoice
    await Invoice.create({
      id: 'INV' + Date.now(),
      tenant_id: id,
      package_id: tenant.package_id,
      amount: amount,
      billing_cycle: cycle,
      status: 'paid', // Renewal from admin usually assumes paid
      due_date: newEndStr,
      payment_date: new Date()
    });

    return result;
  },
  delete: async (id) => {
    const [result] = await db.query('DELETE FROM tenants WHERE id = ?', [id]);
    return result;
  }
};

module.exports = Tenant;
