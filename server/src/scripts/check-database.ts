import prisma from '../config/database';
import { describeDatabaseError } from '../utils/database-error';

async function checkDatabase() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database authentication successful; SELECT 1 passed.');

    const tables = await prisma.$queryRaw<Array<{ name: string; exists: boolean }>>`
      SELECT name, to_regclass('public.' || name) IS NOT NULL AS "exists"
      FROM unnest(ARRAY[
        'users', 'shops', 'shop_services', 'kilo_prices', 'transactions',
        'transaction_items', 'household_items', 'clothing_types'
      ]) AS name
    `;
    const missing = tables.filter((table) => !table.exists).map((table) => table.name);
    if (missing.length) {
      console.error(`Missing application tables: ${missing.join(', ')}. For a new database, run npm run prisma:deploy.`);
      process.exitCode = 1;
      return;
    }
    console.log('All eight LabaRide tables are present.');
  } catch (error) {
    const failure = describeDatabaseError(error);
    console.error(`Database check failed (${failure.code}). ${failure.message}`);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      console.error('Database client cleanup failed.');
      process.exitCode = 1;
    }
  }
}

void checkDatabase();
