/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('notifications', function(table) {
    if (!knex.schema.hasColumn('notifications', 'tenant_id')) {
      table.string('tenant_id', 50).references('id').inTable('tenants').onDelete('CASCADE').after('id');
    }
    if (!knex.schema.hasColumn('notifications', 'is_read')) {
      table.boolean('is_read').defaultTo(false).after('type');
    }
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('notifications', function(table) {
    table.dropColumn('tenant_id');
    table.dropColumn('is_read');
  });
};
