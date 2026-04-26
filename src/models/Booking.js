const db = require('../config/database');

const Booking = {
  findById: async (id) => {
    const [rows] = await db.query('SELECT * FROM bookings WHERE id = ?', [id]);
    return rows[0];
  },
  findByTenant: async (tenantId, filters) => {
    let query = 'SELECT b.*, f.name as field_name FROM bookings b JOIN fields f ON b.field_id = f.id WHERE b.tenant_id = ?';
    const params = [tenantId];

    if (filters.q) {
      query += ' AND (b.customer_name LIKE ? OR b.customer_phone LIKE ?)';
      params.push(`%${filters.q}%`, `%${filters.q}%`);
    }
    if (filters.field) {
      query += ' AND b.field_id = ?';
      params.push(filters.field);
    }
    if (filters.date) {      query += ' AND b.date = ?';
      params.push(filters.date);
    }
    if (filters.status) {
      query += ' AND b.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY b.date DESC, b.start_time ASC';

    const [bookings] = await db.query(query, params);
    return bookings;
  },

  create: async (booking) => {
    const [result] = await db.query('INSERT INTO bookings SET ?', [booking]);
    return { id: booking.id, ...booking };
  },

  updateStatus: async (id, status) => {
    const [result] = await db.query('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
    return result.affectedRows > 0;
  },

  updatePayment: async (id, paid, payment_method) => {
    const [result] = await db.query('UPDATE bookings SET paid = ?, payment_method = ? WHERE id = ?', [paid, payment_method, id]);
    return result.affectedRows > 0;
  },

  findByQRCode: async (qrCode) => {
    const [rows] = await db.query(`
      SELECT b.*, f.name as field_name 
      FROM bookings b 
      JOIN fields f ON b.field_id = f.id 
      WHERE b.qr_code = ?
    `, [qrCode]);
    return rows[0];
  }
};

module.exports = Booking;
