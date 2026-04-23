exports.up = function(knex) {
  return knex.schema
    .createTable('packages', function (table) {
      table.string('id', 50).primary();
      table.string('name', 255).notNullable();
      table.decimal('price_monthly', 15, 2);
      table.decimal('price_yearly', 15, 2);
      table.integer('max_fields');
      table.text('features');
      table.string('color', 20);
      table.boolean('popular').defaultTo(false);
    })
    .createTable('tenants', function (table) {
      table.string('id', 50).primary();
      table.string('name', 255).notNullable();
      table.string('owner', 255);
      table.string('email', 255).unique();
      table.string('phone', 20);
      table.text('address');
      table.string('username', 100).unique();
      table.string('password', 255);
      table.string('package_id', 50).references('id').inTable('packages');
      table.string('status', 20).defaultTo('active');
      table.date('start_date');
      table.date('end_date');
      table.string('billing_cycle', 20);
      table.string('logo', 100);
      table.string('theme_color', 20);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('fields', function (table) {
        table.string('id', 50).primary();
        table.string('tenant_id', 50).references('id').inTable('tenants');
        table.string('name', 255).notNullable();
        table.string('type', 50);
        table.string('size', 100);
        table.string('grass', 100);
        table.decimal('price_per_hour', 15, 2);
        table.string('status', 20).defaultTo('available');
        table.string('image', 255);
        table.text('amenities');
        table.text('description');
    })
    .createTable('customers', function (table) {
        table.string('id', 50).primary();
        table.string('tenant_id', 50).references('id').inTable('tenants');
        table.string('name', 255).notNullable();
        table.string('phone', 20);
        table.string('email', 255);
        table.integer('total_bookings').defaultTo(0);
        table.decimal('total_spent', 15, 2).defaultTo(0);
        table.date('last_visit');
        table.string('status', 20).defaultTo('new');
        table.date('joined');
    })
    .createTable('bookings', function (table) {
        table.string('id', 50).primary();
        table.string('tenant_id', 50).references('id').inTable('tenants');
        table.string('field_id', 50).references('id').inTable('fields');
        table.string('customer_name', 255);
        table.string('customer_phone', 20);
        table.string('customer_email', 255);
        table.date('date');
        table.time('start_time');
        table.time('end_time');
        table.decimal('duration', 5, 2);
        table.decimal('total_price', 15, 2);
        table.string('status', 20).defaultTo('pending');
        table.string('payment_method', 50);
        table.boolean('paid').defaultTo(false);
        table.text('note');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('qr_code', 100);
    })
    .createTable('invoices', function (table) {
        table.string('id', 50).primary();
        table.string('tenant_id', 50).references('id').inTable('tenants');
        table.string('booking_id', 50).references('id').inTable('bookings');
        table.string('customer_name', 255);
        table.decimal('amount', 15, 2);
        table.string('status', 20).defaultTo('unpaid');
        table.date('date');
        table.string('payment_method', 50);
    })
    .createTable('tickets', function (table) {
        table.string('id', 50).primary();
        table.string('tenant_id', 50).references('id').inTable('tenants');
        table.string('subject', 255);
        table.string('type', 50);
        table.string('priority', 20);
        table.string('status', 20).defaultTo('open');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.text('message');
        table.string('tenant_name', 255);
    })
    .createTable('notifications', function (table) {
        table.string('id', 50).primary();
        table.string('title', 255);
        table.text('message');
        table.string('type', 50);
        table.string('target', 50).defaultTo('all');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('notifications')
    .dropTable('tickets')
    .dropTable('invoices')
    .dropTable('bookings')
    .dropTable('customers')
    .dropTable('fields')
    .dropTable('tenants')
    .dropTable('packages');
};
