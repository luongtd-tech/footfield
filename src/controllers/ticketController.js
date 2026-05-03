const Ticket = require('../models/Ticket');
const pushNotifier = require('../utils/pushNotifier');


const ticketController = {
  getAllTickets: async (req, res) => {
    try {
      const tickets = await Ticket.getAll();
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving tickets', error: error.message });
    }
  },

  updateTicketStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await Ticket.updateStatus(id, status);
      res.json({ success: true, message: 'Ticket status updated successfully' });

      // Notify Tenant about ticket status change
      const tickets = await Ticket.getAll();
      const ticket = tickets.find(t => t.id === id);
      if (ticket && ticket.tenant_id) {
        let statusMsg = status === 'resolved' ? 'đã được giải quyết' : status === 'in_progress' ? 'đang được xử lý' : 'đã cập nhật trạng thái';
        pushNotifier.sendToTenant(ticket.tenant_id, '🎫 Cập nhật Phiếu hỗ trợ', `Phiếu hỗ trợ ${id} của bạn ${statusMsg}.`);
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error updating ticket status', error: error.message });
    }
  },
  
  createTicket: async (req, res) => {
    try {
      const { tenant_id, subject, type, priority, message } = req.body;
      const id = `TK-${Date.now().toString().slice(-6)}`;
      
      // Get tenant name for caching in ticket table
      const [tenants] = await require('../config/database').query('SELECT name FROM tenants WHERE id = ?', [tenant_id]);
      const tenant_name = tenants[0]?.name || 'Unknown';

      const result = await Ticket.create({
        id, tenant_id, subject, type, priority, message, tenant_name
      });
      
      res.json({ success: true, message: 'Ticket created successfully', id });

      // Notify Admin about new ticket
      pushNotifier.sendToAdmin('🎫 Yêu cầu hỗ trợ mới', `Nhà thuê ${tenant_name} vừa gửi phiếu hỗ trợ: ${subject}`);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error creating ticket', error: error.message });
    }
  },

  getTenantTickets: async (req, res) => {
    try {
      const { tenantId } = req.params;
      const tickets = await Ticket.getByTenant(tenantId);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving tenant tickets', error: error.message });
    }
  }
};

module.exports = ticketController;
