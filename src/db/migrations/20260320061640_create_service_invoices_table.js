exports.up = function(knex) {
  return knex.schema.createTable('service_invoices', function (table) {
    table.string('id', 50).primary();
    table.string('tenant_id', 50).references('id').inTable('tenants').onDelete('CASCADE');
    table.string('package_id', 50).references('id').inTable('packages');
    table.decimal('amount', 15, 2).notNullable();
    table.string('billing_cycle', 20);
    table.string('status', 20).defaultTo('paid'); // paid, unpaid, overdue
    table.date('due_date');
    table.timestamp('payment_date').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('service_invoices');
};
