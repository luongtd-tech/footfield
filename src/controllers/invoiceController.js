const Invoice = require('../models/Invoice');
const mailService = require('../config/mail');
const pushNotifier = require('../utils/pushNotifier');

const invoiceController = {
  getAllInvoices: async (req, res) => {
    try {
      const invoices = await Invoice.getAll();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving invoices', error: error.message });
    }
  },

  getInvoiceStats: async (req, res) => {
    try {
      const stats = await Invoice.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving invoice stats', error: error.message });
    }
  },

  getMonthlyRevenue: async (req, res) => {
    try {
      const data = await Invoice.getMonthlyRevenue();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving monthly revenue', error: error.message });
    }
  },

  sendEmail: async (req, res) => {
    const { id, to, subject, htmlContent } = req.body;
    
    try {
      if (!to) {
        return res.status(400).json({ success: false, message: 'Recipient email is required' });
      }

      await mailService.sendInvoice(to, subject, htmlContent);
      res.json({ success: true, message: `Email sent successfully to ${to}` });
    } catch (error) {
      console.error('Email send error:', error);
      res.status(500).json({ success: false, message: 'Failed to send email', error: error.message });
    }
  },
  updateInvoiceStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
      const paymentDate = status === 'paid' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
      const result = await Invoice.updateStatus(id, status, paymentDate);
      
      if (result.affectedRows > 0) {
        res.json({ success: true, message: 'Invoice status updated successfully' });

        // Notify Tenant about invoice status change
        const invoices = await Invoice.getAll();
        const invoice = invoices.find(i => i.id === id);
        if (invoice && invoice.tenant_id) {
          let statusMsg = status === 'paid' ? 'đã được thanh toán' : status === 'overdue' ? 'đã quá hạn' : `chuyển sang trạng thái: ${status}`;
          pushNotifier.sendToTenant(invoice.tenant_id, '💳 Cập nhật Hóa đơn', `Hóa đơn ${id} của bạn ${statusMsg}.`);
        }
      } else {
        res.status(404).json({ success: false, message: 'Invoice not found' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Error updating invoice status', error: error.message });
    }
  }
};

module.exports = invoiceController;
