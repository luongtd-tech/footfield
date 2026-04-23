const Package = require('../models/Package');

const packageController = {
  getAllPackages: async (req, res) => {
    try {
      const packages = await Package.getAll();
      res.json(packages);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving packages', error: error.message });
    }
  },

  getPackageById: async (req, res) => {
    try {
      const pkg = await Package.getById(req.params.id);
      if (!pkg) {
        return res.status(404).json({ message: 'Package not found' });
      }
      res.json(pkg);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving package', error: error.message });
    }
  },

  createPackage: async (req, res) => {
    try {
      const result = await Package.create(req.body);
      res.status(201).json({ success: true, message: 'Package created successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error creating package', error: error.message });
    }
  },

  updatePackage: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await Package.update(id, req.body);
      res.json({ success: true, message: 'Package updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error updating package', error: error.message });
    }
  },

  deletePackage: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await Package.delete(id);
      res.json({ success: true, message: 'Package deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error deleting package', error: error.message });
    }
  }
};

module.exports = packageController;
