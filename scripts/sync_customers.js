const db = require('./src/config/database');

async function sync() {
    console.log('🔄 Starting Customer Synchronization from Bookings...');
    
    try {
        // 1. Clear current customers to ensure 100% sync from bookings
        await db.query('DELETE FROM customers');
        console.log('✅ Cleaned up customers table.');

        // 2. Fetch all unique customers from bookings with aggregated stats
        // We group by tenant_id and phone to handle multi-tenant scenarios correctly
        const [customerStats] = await db.query(`
            SELECT 
                tenant_id, 
                customer_phone as phone,
                MAX(customer_name) as name, 
                MAX(customer_email) as email,
                COUNT(*) as total_bookings,
                SUM(total_price) as total_spent,
                MAX(date) as last_visit,
                MIN(created_at) as joined
            FROM bookings
            GROUP BY tenant_id, customer_phone
        `);

        console.log(`📊 Found ${customerStats.length} unique customers in bookings.`);

        for (const stat of customerStats) {
            // Determine status/rank
            let status = 'new';
            if (stat.total_bookings >= 10 || stat.total_spent >= 5000000) {
                status = 'vip';
            } else if (stat.total_bookings >= 5 || stat.total_spent >= 2000000) {
                status = 'regular';
            }

            const customerData = {
                id: `c_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                tenant_id: stat.tenant_id,
                name: stat.name,
                phone: stat.phone,
                email: stat.email || '',
                total_bookings: stat.total_bookings,
                total_spent: stat.total_spent,
                last_visit: stat.last_visit,
                status: status,
                joined: stat.joined ? new Date(stat.joined).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
            };

            await db.query('INSERT INTO customers SET ?', [customerData]);
            console.log(`✅ Synced customer: ${stat.name} (${stat.phone}) - ${status.toUpperCase()}`);
        }

        console.log('✨ Synchronization completed successfully!');
    } catch (err) {
        console.error('❌ Sync failed:', err.message);
    }
    process.exit(0);
}

sync();
