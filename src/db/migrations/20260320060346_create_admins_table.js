exports.up = function(knex) {
  return knex.schema.createTable('admins', function (table) {
    table.increments('id').primary();
    table.string('username', 100).unique().notNullable();
    table.string('password', 255).notNullable();
    table.string('name', 255);
    table.string('role', 50).defaultTo('admin');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('admins');
};
