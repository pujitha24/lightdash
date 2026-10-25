import { Knex } from 'knex';

export const config = { transaction: false };

export const classification = {
    kind: 'safe',
    reason: 'Builds a partial secondary index on apps concurrently; no lock that blocks reads or writes, no table rewrite, and older versions keep working.',
};

export async function up(knex: Knex): Promise<void> {
    await knex.raw('SET statement_timeout = 0');
    try {
        const invalidIndex = await knex.raw<{ rowCount: number }>(
            `SELECT 1
             FROM pg_class
             JOIN pg_index ON pg_index.indexrelid = pg_class.oid
             WHERE pg_class.relname = 'apps_space_uuid_active_idx'
               AND pg_index.indrelid = 'apps'::regclass
               AND NOT pg_index.indisvalid`,
        );
        if ((invalidIndex.rowCount ?? 0) > 0) {
            await knex.raw(
                'DROP INDEX CONCURRENTLY IF EXISTS apps_space_uuid_active_idx',
            );
        }
        await knex.raw(
            `CREATE INDEX CONCURRENTLY IF NOT EXISTS apps_space_uuid_active_idx
             ON apps (space_uuid) WHERE deleted_at IS NULL`,
        );
    } finally {
        await knex.raw('RESET statement_timeout');
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw(
        'DROP INDEX CONCURRENTLY IF EXISTS apps_space_uuid_active_idx',
    );
}
