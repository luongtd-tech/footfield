const db = require('./src/config/database');

async function checkAllBookings() {
  try {
    console.log('=== CHECKING ALL BOOKINGS ===');
    
    // Check all bookings for this tenant and field
    const [allBookings] = await db.query(
      'SELECT * FROM bookings WHERE tenant_id = ? AND field_id = ? ORDER BY date DESC', 
      ['tenant1', 'f_1774249961945']
    );
    
    console.log(`Total bookings found: ${allBookings.length}`);
    
    allBookings.forEach((booking, index) => {
      console.log(`\nBooking ${index + 1}:`);
      console.log(`  ID: ${booking.id}`);
      console.log(`  Date: ${booking.date}`);
      console.log(`  Date (DATE()): ${booking.date ? new Date(booking.date).toISOString().split('T')[0] : 'N/A'}`);
      console.log(`  Time: ${booking.start_time} - ${booking.end_time}`);
      console.log(`  Status: ${booking.status}`);
      console.log(`  Customer: ${booking.customer_name}`);
    });
    
    // Specifically check for 2026-03-28
    console.log('\n=== CHECKING SPECIFICALLY FOR 2026-03-28 ===');
    const [march28Bookings] = await db.query(
      'SELECT * FROM bookings WHERE tenant_id = ? AND field_id = ? AND DATE(date) = ?', 
      ['tenant1', 'f_1774249961945', '2026-03-28']
    );
    
    console.log(`Bookings for 2026-03-28: ${march28Bookings.length}`);
    march28Bookings.forEach(b => {
      console.log(`- ${b.id}: ${b.start_time}-${b.end_time} (${b.status})`);
    });
    
    // Test the exact query that Booking model would use
    console.log('\n=== TESTING MODEL QUERY ===');
    const [modelQuery] = await db.query(
      'SELECT b.*, f.name as field_name FROM bookings b JOIN fields f ON b.field_id = f.id WHERE b.tenant_id = ? AND b.field_id = ? AND DATE(b.date) = ? ORDER BY b.date DESC, b.start_time ASC',
      ['tenant1', 'f_1774249961945', '2026-03-28']
    );
    
    console.log(`Model query result: ${modelQuery.length} bookings`);
    modelQuery.forEach(b => {
      console.log(`- ${b.id}: ${b.date} ${b.start_time}-${b.end_time} (${b.status})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllBookings();
