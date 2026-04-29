/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('tenants', function(table) {
    // Increase logo column size from 100 to 500 to accommodate long URLs
    table.string('logo', 500).alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('tenants', function(table) {
    table.string('logo', 100).alter();
  });
};
