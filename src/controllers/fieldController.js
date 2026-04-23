const Field = require('../models/Field');

exports.getFieldsByTenant = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const fields = await Field.findByTenant(tenantId);
    res.json(fields);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching fields', error: error.message });
  }
};

exports.createField = async (req, res) => {
  try {
    const { tenant_id } = req.body;
    
    // Check package limit
    const [rows] = await require('../config/database').query(`
      SELECT COUNT(f.id) as count, p.max_fields 
      FROM fields f 
      JOIN tenants t ON f.tenant_id = t.id 
      JOIN packages p ON t.package_id = p.id 
      WHERE t.id = ?
      GROUP BY p.id
    `, [tenant_id]);

    if (rows.length > 0) {
      const { count, max_fields } = rows[0];
      if (count >= max_fields) {
        return res.status(403).json({ 
          success: false, 
          message: `Giới hạn gói dịch vụ của bạn là ${max_fields} sân. Vui lòng nâng cấp để thêm mới.` 
        });
      }
    }

    const fieldData = { id: `f_${Date.now()}`, ...req.body };
    const newField = await Field.create(fieldData);
    res.status(201).json(newField);
  } catch (error) {
    res.status(500).json({ message: 'Error creating field', error: error.message });
  }
};

exports.updateFieldStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const success = await Field.updateStatus(id, status);
    if (success) {
      res.json({ success: true, message: 'Field status updated' });
    } else {
      res.status(404).json({ success: false, message: 'Field not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating field status', error: error.message });
  }
};

exports.updateField = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await Field.update(id, req.body);
    if (success) {
      res.json({ success: true, message: 'Field updated' });
    } else {
      res.status(404).json({ success: false, message: 'Field not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating field', error: error.message });
  }
};

exports.deleteField = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await Field.remove(id);
    if (success) {
      res.json({ success: true, message: 'Field deleted' });
    } else {
      res.status(404).json({ success: false, message: 'Field not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error deleting field', error: error.message });
  }
};
