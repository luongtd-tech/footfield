const Tenant = require('../models/Tenant');

const tenantController = {
  getAllTenants: async (req, res) => {
    try {
      const tenants = await Tenant.getAll();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving tenants', error: error.message });
    }
  },

  getTenantSettings: async (req, res) => {
    try {
      const { id } = req.params;
      const tenant = await Tenant.findById(id);
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
      res.json(tenant);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving settings', error: error.message });
    }
  },

  getDashboardStats: async (req, res) => {
    try {
      const stats = await Tenant.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving stats', error: error.message });
    }
  },

  getTenantDashboardData: async (req, res) => {
    try {
      const { id } = req.params;
      const data = await Tenant.getDashboardData(id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving tenant dashboard data', error: error.message });
    }
  },

  createTenant: async (req, res) => {
    try {
      const result = await Tenant.create(req.body);
      res.status(201).json({ success: true, message: 'Tenant created successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error creating tenant', error: error.message });
    }
  },

  updateTenant: async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      // Log for debugging
      console.log('Updating tenant:', id, 'Data:', data);
      
      // Check if tenant exists
      const existingTenant = await Tenant.findById(id);
      if (!existingTenant) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy nhà thuê' });
      }
      
      // Validate required fields
      if (!data.name || data.name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Tên cơ sở không được để trống' });
      }
      
      // Filter out undefined/null values and empty strings for optional fields
      // Also skip empty password to avoid overwriting existing password
      const cleanData = {};
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) {
          if (key === 'password' && data[key].trim() === '') {
            // Skip empty password
            return;
          }
          cleanData[key] = data[key];
        }
      });
      
      if (Object.keys(cleanData).length === 0) {
        return res.status(400).json({ success: false, message: 'Không có dữ liệu để cập nhật' });
      }
      
      const result = await Tenant.update(id, cleanData);
      res.json({ success: true, message: 'Tenant updated successfully' });
    } catch (error) {
      console.error('Error updating tenant:', error);
      res.status(500).json({ success: false, message: 'Error updating tenant', error: error.message });
    }
  },

  updateTenantStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await Tenant.updateStatus(id, status);
      res.json({ success: true, message: 'Tenant status updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error updating tenant status', error: error.message });
    }
  },

  renewTenant: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await Tenant.renew(id);
      if (!result) return res.status(404).json({ success: false, message: 'Tenant not found' });
      res.json({ success: true, message: 'Tenant renewed successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error renewing tenant', error: error.message });
    }
  },

  deleteTenant: async (req, res) => {
    try {
      const { id } = req.params;
      const options = req.body || {};
      // Mặc định xóa toàn bộ dữ liệu tenant nếu không chỉ định cụ thể
      if (!options.bookings && !options.fields && !options.customers && !options.invoices && !options.services && !options.fullAccount) {
        options.fullAccount = true;
      }
      const result = await Tenant.delete(id, options);
      res.json({ success: true, message: 'Tenant data deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error deleting tenant data', error: error.message });
    }
  }
};

module.exports = tenantController;
