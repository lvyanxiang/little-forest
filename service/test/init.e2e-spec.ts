import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';

describe('First-deployment SQL initialization', () => {
  let client: Client;
  const root = resolve(__dirname, '..');
  const seed = readFileSync(resolve(root, 'init/init.sql'), 'utf8');

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ envFilePath: resolve(root, '.env') })] }).compile();
    const config = module.get(ConfigService);
    client = new Client({ host: config.get('DB_HOST', 'localhost'), port: Number(config.get('DB_PORT', 5432)), user: config.get('DB_USERNAME', 'postgres'), password: config.get('DB_PASSWORD', 'password'), database: config.get('DB_NAME', 'little_forest') });
    await client.connect();
    await client.query('BEGIN');
    const schema = `forest_init_test_${randomUUID().replaceAll('-', '')}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    for (const file of readdirSync(resolve(root, 'migrations')).filter((file) => file.endsWith('.sql')).sort()) {
      await client.query(readFileSync(resolve(root, 'migrations', file), 'utf8'));
    }
  });

  afterAll(async () => {
    if (client) { await client.query('ROLLBACK'); await client.end(); }
  });

  it('creates a complete store, initial media and five real slots in an empty schema', async () => {
    await client.query(seed);
    const { rows: [store] } = await client.query('SELECT "name", "quickDateDays", "bookingAdvanceDays", "uiText", "homeHeroImage" LIKE \'data:image/jpeg;base64,%\' AS "hasHero", "brandLogoImage" LIKE \'data:image/png;base64,%\' AS "hasLogo" FROM "store_settings" WHERE "id" = 1');
    expect(store).toMatchObject({ quickDateDays: 14, bookingAdvanceDays: 90, hasHero: true, hasLogo: true });
    expect(store.uiText.loginDescription).toBeTruthy();
    const { rows } = await client.query('SELECT "startTime", "maxCapacity" FROM "time_slots" ORDER BY "sortOrder"');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ startTime: '14:00', maxCapacity: 8 });
  });

  it('preserves edited settings, uploaded media and inactive slots on repeated execution', async () => {
    await client.query('UPDATE "store_settings" SET "name" = $1, "quickDateDays" = 3, "bookingAdvanceDays" = 7, "homeHeroImage" = $2, "uiText" = jsonb_set("uiText", \'{loginDescription}\', to_jsonb($3::text)) WHERE "id" = 1', ['Edited store', 'data:image/png;base64,custom', 'Edited login copy']);
    await client.query('UPDATE "time_slots" SET "maxCapacity" = 99, "isActive" = false');
    await client.query(seed);
    await client.query(seed);
    const { rows: [store] } = await client.query('SELECT "name", "quickDateDays", "bookingAdvanceDays", "homeHeroImage", "uiText"->>\'loginDescription\' AS "loginDescription" FROM "store_settings" WHERE "id" = 1');
    expect(store).toEqual({ name: 'Edited store', quickDateDays: 3, bookingAdvanceDays: 7, homeHeroImage: 'data:image/png;base64,custom', loginDescription: 'Edited login copy' });
    const { rows: [counts] } = await client.query('SELECT COUNT(*)::int AS "count", MIN("maxCapacity") AS "capacity", BOOL_OR("isActive") AS "active" FROM "time_slots"');
    expect(counts).toEqual({ count: 5, capacity: 99, active: false });
  });

  it('replaces the obsolete stock login hint while preserving a customized hint', async () => {
    await client.query('UPDATE "store_settings" SET "uiText" = "uiText" || $1::jsonb WHERE "id" = 1', [JSON.stringify({ loginHint: '请先查看隐私指引，再勾选同意。暂不登录可继续浏览首页和预约时段。', loginReadRequired: 'Old read requirement' })]);
    await client.query(seed);
    const { rows: [store] } = await client.query('SELECT "uiText" FROM "store_settings" WHERE "id" = 1');
    expect(store.uiText.loginHint).toContain('请勾选同意隐私指引后登录');
    expect(store.uiText).not.toHaveProperty('loginReadRequired');
    await client.query('UPDATE "store_settings" SET "uiText" = jsonb_set("uiText", \'{loginHint}\', to_jsonb($1::text)) WHERE "id" = 1', ['Customized login hint']);
    await client.query(seed);
    const { rows: [edited] } = await client.query('SELECT "uiText"->>\'loginHint\' AS "hint" FROM "store_settings" WHERE "id" = 1');
    expect(edited.hint).toBe('Customized login hint');
  });
});
