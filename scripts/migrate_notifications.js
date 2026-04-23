const db = require('./src/config/database');

const migrate = async () => {
  try {
    const columnsToAdd = [
      { name: 'tenant_id', type: 'VARCHAR(50)' },
      { name: 'is_read', type: 'TINYINT(1) DEFAULT 0' }
    ];

    const [existingColumns] = await db.query('DESCRIBE notifications');
    const existingColumnNames = existingColumns.map(col => col.Field);

    for (const column of columnsToAdd) {
      if (!existingColumnNames.includes(column.name)) {
        console.log(`Adding column: ${column.name}`);
        await db.query(`ALTER TABLE notifications ADD COLUMN ${column.name} ${column.type}`);
      } else {
        console.log(`Column ${column.name} already exists.`);
      }
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();
