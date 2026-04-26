const Booking = require('../models/Booking');
const Field = require('../models/Field'); 
const Customer = require('../models/Customer');
const pushNotifier = require('../utils/pushNotifier');

exports.getBookingsByTenant = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const filters = { 
      q: req.query.q, 
      field: req.query.field, 
      status: req.query.status 
    };
    const bookings = await Booking.findByTenant(tenantId, filters);
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings', error: error.message });
  }
};

exports.createBooking = async (req, res) => {
  try {
    const bookingData = { id: `bk_${Date.now()}`, ...req.body };
    
    // ✅ Server-side validation: Kiểm tra xung đột thời gian
    const { tenant_id, field_id, date, start_time, end_time } = bookingData;
    
    if (tenant_id && field_id && date && start_time && end_time) {
      // Lấy tất cả bookings cho cùng tenant, field, và date
      const existingBookings = await Booking.findByTenant(tenant_id, {
        field: field_id,
        date: date
      });
      
      // Kiểm tra xung đột thời gian - tính cả confirmed và pending để ngăn booking chồng slot
      const hasConflict = existingBookings.some(booking => {
        if (booking.id === bookingData.id) return false; // Bỏ qua chính nó
        if (!['confirmed', 'pending', 'completed'].includes(booking.status)) return false;
        
        const bStart = booking.start_time.substring(0, 5);
        const bEnd   = booking.end_time.substring(0, 5);
        const sTime  = start_time.substring(0, 5);
        const eTime  = end_time.substring(0, 5);
        
        // Conflict logic: overlap detection using normalized times
        const conflict = (sTime >= bStart && sTime < bEnd) || 
                      (eTime > bStart && eTime <= bEnd) ||
                      (sTime <= bStart && eTime >= bEnd);
        
        return conflict;
      });
      
      if (hasConflict) {
        return res.status(409).json({ 
          message: 'Time slot conflict detected', 
          error: 'This time slot is already booked',
          conflict: true 
        });
      }
    }
    
    const newBooking = await Booking.create(bookingData);

    // ✅ Sync Customer Data
    const { customer_name, customer_phone, total_price } = newBooking;
    let customer = await Customer.findByPhone(tenant_id, customer_phone);
    if (!customer) {
      await Customer.create({
        id: `c_${Date.now()}`,
        tenant_id,
        name: customer_name,
        phone: customer_phone,
        total_bookings: 1,
        total_spent: total_price,
        last_visit: date,
        status: 'new',
        joined: new Date().toISOString().slice(0, 10)
      });
    } else {
      await Customer.updateStats(customer.id, total_price, date);
    }

    res.status(201).json(newBooking);

    // Notify Tenant about new booking
    pushNotifier.sendToTenant(
      tenant_id, 
      '⚽ Đơn đặt sân mới!', 
      `Khách hàng ${customer_name} vừa đặt sân ${newBooking.field_name} vào lúc ${newBooking.start_time.substring(0,5)}.`
    );
  } catch (error) {
    res.status(500).json({ message: 'Error creating booking', error: error.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const success = await Booking.updateStatus(id, status);
    if (success) {
      res.json({ success: true, message: 'Booking status updated' });
    } else {
      res.status(404).json({ success: false, message: 'Booking not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating booking status', error: error.message });
  }
};

exports.updateBookingPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paid, payment_method } = req.body;
    const success = await Booking.updatePayment(id, paid, payment_method);
    if (success) {
      res.json({ success: true, message: 'Booking payment updated' });
    } else {
      res.status(404).json({ success: false, message: 'Booking not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating booking payment', error: error.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const success = await Booking.updateStatus(id, status);
    if (success) {
      res.json({ success: true, message: `Booking status updated to ${status}` });
      
      // Get booking details to notify tenant
      const booking = await Booking.findById(id);
      if (booking) {
        pushNotifier.sendToTenant(
          booking.tenant_id,
          '🔔 Cập nhật trạng thái!',
          `Đơn đặt sân ${id} đã chuyển sang trạng thái: ${status}.`
        );
      }
    } else {
      res.status(404).json({ message: 'Booking not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
};

exports.getBookingByQR = async (req, res) => {
  try {
    const { code } = req.params;
    const booking = await Booking.findByQRCode(code);
    if (booking) {
      res.json(booking);
    } else {
      res.status(404).json({ message: 'Booking not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching booking by QR', error: error.message });
  }
};
