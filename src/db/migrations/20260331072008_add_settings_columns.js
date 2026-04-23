/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('tenants', function(table) {
    // Add columns if they don't exist (handled by knex alterTable natively depending on dialect if using hasColumn, but we'll just add them)
    table.time('open_time').defaultTo('06:00:00');
    table.time('close_time').defaultTo('22:00:00');
    table.string('bank_name', 100);
    table.string('bank_account', 50);
    table.string('bank_holder', 100);
    table.boolean('notify_reminder').defaultTo(true);
    table.boolean('notify_new_booking').defaultTo(true);
    table.boolean('notify_daily_report').defaultTo(false);
    table.boolean('allow_online_booking').defaultTo(true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('tenants', function(table) {
    table.dropColumn('open_time');
    table.dropColumn('close_time');
    table.dropColumn('bank_name');
    table.dropColumn('bank_account');
    table.dropColumn('bank_holder');
    table.dropColumn('notify_reminder');
    table.dropColumn('notify_new_booking');
    table.dropColumn('notify_daily_report');
    table.dropColumn('allow_online_booking');
  });
};
