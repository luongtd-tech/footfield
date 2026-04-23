const Booking = require('./src/models/Booking');

async function testModel() {
  try {
    console.log('Testing Booking.findByTenant with date filter...');
    
    const bookings = await Booking.findByTenant('tenant1', {
      field: 'f_1774249961945',
      date: '2026-03-28'
    });
    
    console.log('Bookings found for 2026-03-28:', bookings.length);
    bookings.forEach(b => {
      console.log(`- ${b.id}: ${b.date} ${b.start_time}-${b.end_time} (${b.status})`);
    });
    
    const allBookings = await Booking.findByTenant('tenant1', {
      field: 'f_1774249961945'
    });
    
    console.log('\nAll bookings for this field:', allBookings.length);
    allBookings.forEach(b => {
      console.log(`- ${b.id}: ${b.date} ${b.start_time}-${b.end_time} (${b.status})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testModel();
