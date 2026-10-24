// Read-only check of an explicitly supplied account against the configured DB.
// Credentials come from the process environment and are never logged.
const assert = require('node:assert/strict');
const prisma = require('../dist/config/database').default;
const app = require('../dist/app').default;

async function main() {
  const email = process.env.LABARIDE_ADMIN_EMAIL;
  const password = process.env.LABARIDE_ADMIN_PASSWORD;
  assert.ok(email && password, 'Supply LABARIDE_ADMIN_EMAIL and LABARIDE_ADMIN_PASSWORD');
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  try {
    const root = `http://127.0.0.1:${server.address().port}/api`;
    const login = await fetch(root + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(login.status, 200, 'Admin credentials must authenticate');
    const { data } = await login.json();
    assert.equal(data.user.isAdmin, true); assert.equal(data.user.password, undefined);
    const dashboard = await fetch(root + '/admin/shops', { headers: { Authorization: 'Bearer ' + data.token } });
    assert.equal(dashboard.status, 200, 'Admin dashboard API must accept the account');
    assert.ok(Array.isArray((await dashboard.json()).data));
    console.log('PASS: requested admin account authenticates and can access shop reviews. No records were changed.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(() => { console.error('FAIL: admin login verification. Check account setup and database connectivity.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
