const Staff = require('../models/Staff');

exports.getStaffByTenant = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const staff = await Staff.findByTenant(tenantId);
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching staff', error: error.message });
  }
};

exports.createStaff = async (req, res) => {
  try {
    const staffData = { id: `st_${Date.now()}`, ...req.body };
    const newStaff = await Staff.create(staffData);
    res.status(201).json(newStaff);
  } catch (error) {
    res.status(500).json({ message: 'Error creating staff', error: error.message });
  }
};
exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await Staff.update(id, req.body);
    if (success) {
      res.json({ message: 'Staff updated successfully' });
    } else {
      res.status(404).json({ message: 'Staff not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating staff', error: error.message });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await Staff.remove(id);
    if (success) {
      res.json({ message: 'Staff deleted successfully' });
    } else {
      res.status(404).json({ message: 'Staff not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error deleting staff', error: error.message });
  }
};
