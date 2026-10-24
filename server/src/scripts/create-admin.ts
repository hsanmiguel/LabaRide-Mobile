import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { describeDatabaseError } from '../utils/database-error';

async function main() {
  const [email] = process.argv.slice(2);
  const password = process.env.LABARIDE_ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 8) {
    throw new Error('Provide an email argument and LABARIDE_ADMIN_PASSWORD (at least 8 characters).');
  }
  const existing = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } }, select: { id: true } });
  if (existing) throw new Error('An account already exists with this email. Use admin:set to grant access without changing its password.');
  await prisma.user.create({ data: { name: 'LabaRide Admin', email: email.trim(), password: await bcrypt.hash(password, 12), isAdmin: true } });
  console.log('Administrator account created. Sign in to open the admin dashboard.');
}
main().catch(error => {
  const failure = describeDatabaseError(error);
  console.error(failure.isDatabaseError ? failure.message : error instanceof Error ? error.message : 'Unable to create admin account.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
