const Customer = require('../models/Customer');

exports.getCustomersByTenant = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const customers = await Customer.findByTenant(tenantId);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers', error: error.message });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (customer) {
      res.json(customer);
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer', error: error.message });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const { tenant_id, phone } = req.body;
    
    // Check existing
    const existing = await Customer.findByPhone(tenant_id, phone);
    if (existing) {
      return res.status(409).json({ message: 'Customer with this phone already exists', customer: existing });
    }

    const customerData = { 
      id: `c_${Date.now()}`, 
      ...req.body,
      total_bookings: req.body.total_bookings || 0,
      total_spent: req.body.total_spent || 0,
      status: req.body.status || 'new',
      joined: req.body.joined || new Date().toISOString().slice(0, 10)
    };
    
    const newCustomer = await Customer.create(customerData);
    res.status(201).json(newCustomer);
  } catch (error) {
    res.status(500).json({ message: 'Error creating customer', error: error.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await Customer.update(id, req.body);
    if (success) {
      res.json({ success: true, message: 'Customer updated' });
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating customer', error: error.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await Customer.delete(id);
    if (success) {
      res.json({ success: true, message: 'Customer deleted' });
    } else {
      res.status(404).json({ message: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error deleting customer', error: error.message });
  }
};
