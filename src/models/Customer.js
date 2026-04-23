const db = require('../config/database');

const Customer = {
  findByTenant: async (tenantId) => {
    const [rows] = await db.query('SELECT * FROM customers WHERE tenant_id = ? ORDER BY total_spent DESC', [tenantId]);
    return rows;
  },

  findById: async (id) => {
    const [rows] = await db.query('SELECT * FROM customers WHERE id = ?', [id]);
    return rows[0];
  },

  findByPhone: async (tenantId, phone) => {
    const [rows] = await db.query('SELECT * FROM customers WHERE tenant_id = ? AND phone = ?', [tenantId, phone]);
    return rows[0];
  },

  create: async (customerData) => {
    await db.query('INSERT INTO customers SET ?', [customerData]);
    return customerData;
  },

  update: async (id, customerData) => {
    await db.query('UPDATE customers SET ? WHERE id = ?', [customerData, id]);
    return true;
  },

  delete: async (id) => {
    await db.query('DELETE FROM customers WHERE id = ?', [id]);
    return true;
  },

  updateStats: async (id, bookingPrice, date) => {
    const [result] = await db.query(`
      UPDATE customers 
      SET total_bookings = total_bookings + 1, 
          total_spent = total_spent + ?, 
          last_visit = ?
      WHERE id = ?
    `, [bookingPrice, date, id]);
    
    // Auto rank up
    const customer = await Customer.findById(id);
    if (customer) {
      let newStatus = 'new';
      if (customer.total_bookings >= 10 || customer.total_spent >= 5000000) {
        newStatus = 'vip';
      } else if (customer.total_bookings >= 5 || customer.total_spent >= 2000000) {
        newStatus = 'regular';
      }
      
      if (newStatus !== customer.status) {
        await db.query('UPDATE customers SET status = ? WHERE id = ?', [newStatus, id]);
      }
    }
    
    return result.affectedRows > 0;
  }
};

module.exports = Customer;
