/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasTenantId = await knex.schema.hasColumn('notifications', 'tenant_id');
  const hasIsRead = await knex.schema.hasColumn('notifications', 'is_read');

  return knex.schema.table('notifications', function(table) {
    if (!hasTenantId) {
      table.string('tenant_id', 50).references('id').inTable('tenants').onDelete('CASCADE').after('id');
    }
    if (!hasIsRead) {
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
