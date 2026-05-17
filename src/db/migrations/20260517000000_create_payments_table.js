exports.up = function(knex) {
  return knex.schema.createTable('payments', function(table) {
    table.string('vnp_txn_ref', 100).primary();
    table.string('booking_id', 50).references('id').inTable('bookings').onDelete('CASCADE');
    table.decimal('amount', 15, 2).notNullable();
    table.string('bank_code', 20).notNullable();
    table.enum('status', ['success', 'fail']).defaultTo('success');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('payments');
};
