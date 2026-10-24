import prisma from '../config/database';
import { describeDatabaseError } from '../utils/database-error';

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email || (flag && flag !== '--revoke')) throw new Error('Usage: npm run admin:set -- user@example.com [--revoke]');
  const user = await prisma.user.findUnique({ where: { email: email.trim() }, select: { id: true } });
  if (!user) throw new Error('No account found. Register the account in the app first.');
  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: flag !== '--revoke' } });
  console.log(flag === '--revoke' ? 'Administrator access revoked.' : 'Administrator access assigned. Sign in to open the admin dashboard.');
}
main().catch(error => {
  const failure = describeDatabaseError(error);
  console.error(failure.isDatabaseError ? failure.message : error instanceof Error ? error.message : 'Unable to update admin access.');
  process.exitCode = 1;
})
  .finally(() => prisma.$disconnect());
