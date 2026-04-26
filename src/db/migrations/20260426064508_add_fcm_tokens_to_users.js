/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .table('tenants', table => {
      table.string('fcm_token').nullable();
    })
    .table('admins', table => {
      table.string('fcm_token').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .table('tenants', table => {
      table.dropColumn('fcm_token');
    })
    .table('admins', table => {
      table.dropColumn('fcm_token');
    });
};
