exports.up = function(knex) {
  return knex.schema
    .createTable('services', function(table) {
      table.increments('id').primary();
      table.string('tenant_id').notNullable();
      table.string('name').notNullable();
      table.integer('price').notNullable();
      table.string('unit').defaultTo('cái'); // chai, đôi, bộ...
      table.string('category').defaultTo('drink'); // drink, rental, food...
      table.string('image');
      table.integer('stock').defaultTo(0);
      table.timestamps(true, true);
    })
    .createTable('booking_services', function(table) {
      table.increments('id').primary();
      table.string('booking_id').notNullable();
      table.integer('service_id').unsigned().notNullable();
      table.integer('quantity').notNullable();
      table.integer('price_at_time').notNullable(); // Giá tại thời điểm bán
      table.timestamps(true, true);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('booking_services')
    .dropTableIfExists('services');
};
