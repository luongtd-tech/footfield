/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('staff', (table) => {
    table.string('id', 50).primary();
    table.string('tenant_id', 50);
    table.string('name', 255).notNullable();
    table.string('phone', 20);
    table.string('status', 20).defaultTo('active');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Foreign key matching the exact original structure
    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
  });

  // Insert seed data inside migration (though typically should be in seeds folder)
  await knex('staff').insert([
    { id: 'st1', tenant_id: 'tenant1', name: 'Nguyễn Văn A', phone: '0911111111' },
    { id: 'st2', tenant_id: 'tenant1', name: 'Trần Thị B', phone: '0922222222' },
    { id: 'st3', tenant_id: 'tenant1', name: 'Phạm Văn C', phone: '0933333333' },
    { id: 'st4', tenant_id: 'tenant1', name: 'Lê Hữu D', phone: '0944444444' }
  ]).onConflict('id').ignore(); // IGNORE like in the original INSERT IGNORE script
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('staff');
};
