const db = require('../config/database');
const bcrypt = require('bcryptjs');
const authController = {
  login: async (req, res) => {
    const { username, password, type } = req.body;

    try {
      if (type === 'provider') {
        const [rows] = await db.query('SELECT * FROM admins WHERE username = ? AND password = ?', [username, password]);
        if (rows.length > 0) {
          const user = rows[0];
          delete user.password;
          return res.json({ success: true, user, role: 'provider' });
        }
      } else if (type === 'tenant') {
        const [rows] = await db.query("SELECT * FROM tenants WHERE username = ? AND status = 'active'", [username]);
        if (rows.length > 0) {
          const user = rows[0];
          let isMatch = false;
          try {
            isMatch = bcrypt.compareSync(password, user.password);
          } catch (e) {
            isMatch = false;
          }
          // Fallback cho pass cũ chưa hash
          if (isMatch || password === user.password) {
            delete user.password;
            return res.json({ success: true, user, role: 'tenant' });
          }
        }
      }

      res.status(401).json({ success: false, message: 'Invalid username or password' });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Server error during login', error: error.message });
    }
  }
};

module.exports = authController;
