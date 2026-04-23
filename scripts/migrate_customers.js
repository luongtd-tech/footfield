const db = require('./src/config/database');

const INITIAL_CUSTOMERS = [
    { id: 'c1', tenant_id: 'tenant1', name: 'Trần Văn Nam', phone: '0901234567', email: 'nam@gmail.com', total_bookings: 12, total_spent: 4320000, last_visit: '2026-03-18', status: 'vip', joined: '2025-06-01' },
    { id: 'c2', tenant_id: 'tenant1', name: 'Lê Thị Hoa', phone: '0912345670', email: 'hoa@gmail.com', total_bookings: 8, total_spent: 2880000, last_visit: '2026-03-18', status: 'regular', joined: '2025-08-15' },
    { id: 'c3', tenant_id: 'tenant1', name: 'Nguyễn Minh Tuấn', phone: '0923456781', email: 'tuan@gmail.com', total_bookings: 5, total_spent: 5000000, last_visit: '2026-03-17', status: 'regular', joined: '2025-09-20' },
    { id: 'c4', tenant_id: 'tenant1', name: 'Phạm Đức Long', phone: '0934567892', email: 'long@gmail.com', total_bookings: 3, total_spent: 1080000, last_visit: '2026-03-16', status: 'new', joined: '2026-01-10' },
    { id: 'c5', tenant_id: 'tenant1', name: 'Hoàng Văn Bình', phone: '0945678903', email: 'binh@gmail.com', total_bookings: 20, total_spent: 6200000, last_visit: '2026-03-17', status: 'vip', joined: '2025-03-01' }
];

async function migrate() {
    console.log('Starting migration...');
    for (const customer of INITIAL_CUSTOMERS) {
        try {
            await db.query('INSERT INTO customers SET ?', [customer]);
            console.log(`✅ Migrated: ${customer.name}`);
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                console.log(`ℹ️ Already exists: ${customer.name}`);
            } else {
                console.error(`❌ Error migrating ${customer.name}:`, err.message);
            }
        }
    }
    console.log('Migration finished.');
    process.exit(0);
}

migrate();
