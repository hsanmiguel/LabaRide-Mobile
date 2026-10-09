const assert = require('node:assert/strict');
const { test } = require('node:test');

// These tests exercise configuration and error handling, without connecting.
process.env.DATABASE_URL = 'postgresql://tester:test@localhost:5432/test';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.JWT_SECRET = 'test-secret-'.repeat(4);
const { envSchema } = require('../dist/config/env');
const { describeDatabaseError } = require('../dist/utils/database-error');
const { errorHandler } = require('../dist/middleware/error.middleware');

const base = 'postgresql://postgres.testproject:p%40ss%23word@aws-0-example.pooler.supabase.com:5432/postgres';
const configuration = (DATABASE_URL = base, DIRECT_URL = base) => ({
  DATABASE_URL, DIRECT_URL, JWT_SECRET: process.env.JWT_SECRET,
});

test('missing database configuration and JWT secret are reported by field name', () => {
  const result = envSchema.safeParse({});
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues.map(issue => issue.path[0]).sort(), ['DATABASE_URL', 'JWT_SECRET']);
});

test('copied Supabase URLs receive secure defaults and retain their credentials', () => {
  const result = envSchema.parse(configuration());
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    const url = new URL(result[key]);
    assert.equal(url.username, 'postgres.testproject');
    assert.equal(decodeURIComponent(url.password), 'p@ss#word');
    assert.equal(url.port, '5432');
    assert.equal(url.searchParams.get('sslmode'), 'require');
    assert.equal(url.searchParams.get('connect_timeout'), '30');
  }
});

test('runtime and migration URLs remain independently configurable', () => {
  const runtime = base + '?sslmode=require&connect_timeout=45';
  const direct = 'postgresql://postgres:test@db.testproject.supabase.co:5432/postgres?sslmode=require&connect_timeout=60';
  const result = envSchema.parse(configuration(runtime, direct));
  assert.equal(result.DATABASE_URL, runtime);
  assert.equal(result.DIRECT_URL, direct);
  assert.equal(envSchema.parse(configuration(process.env.DATABASE_URL)).DATABASE_URL, process.env.DATABASE_URL);
});

test('placeholders, malformed URLs, and unsupported or insecure SSL modes are rejected', () => {
  for (const password of ['%5BYOUR-PASSWORD%5D', '%5BDATABASE_PASSWORD%5D']) {
    assert.equal(envSchema.safeParse(configuration(base.replace('p%40ss%23word', password))).success, false);
  }
  for (const mode of ['disable', 'prefer', 'verify-full']) {
    assert.equal(envSchema.safeParse(configuration(base + '?sslmode=' + mode)).success, false);
  }
  assert.equal(envSchema.safeParse(configuration('not-a-url')).success, false);
});

test('database errors distinguish authentication, networking, and missing schema without exposing input', () => {
  const privateInput = 'postgresql://private-user:private-password@private-host/postgres secret-jwt';
  for (const [code, expected] of [['P1000', 'authentication'], ['P1001', 'unreachable'], ['P2021', 'schema']]) {
    const failure = describeDatabaseError({ name: 'PrismaClientInitializationError', errorCode: code, message: privateInput });
    assert.equal(failure.code, code);
    assert.equal(failure.isDatabaseError, true);
    assert.equal(failure.status, 503);
    assert.match(failure.message.toLowerCase(), new RegExp(expected));
    assert.ok(!JSON.stringify(failure).includes('private-password'));
    assert.ok(!JSON.stringify(failure).includes('secret-jwt'));
    assert.ok(!JSON.stringify(failure).includes('postgresql://'));
  }
  const other = describeDatabaseError({ name: 'PrismaClientUnknownRequestError', message: privateInput });
  assert.equal(other.status, 500);
  assert.ok(!JSON.stringify(other).includes(privateInput));
});

test('API database failures return a controlled response without raw Prisma details', () => {
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args.join(' '));
  try {
    for (const [code, expectedStatus] of [['P1000', 503], ['P1001', 503], ['P2021', 503], ['P2002', 409], ['P2025', 404]]) {
      const response = {
        status(value) { this.statusCode = value; return this; },
        json(value) { this.body = value; return this; },
      };
      errorHandler({ name: 'PrismaClientKnownRequestError', code, message: 'private-password secret-jwt' }, {}, response, () => {});
      assert.equal(response.statusCode, expectedStatus);
      assert.equal(response.body.success, false);
      assert.ok(!JSON.stringify(response.body).includes('private-password'));
      assert.ok(!JSON.stringify(response.body).includes('secret-jwt'));
    }
    assert.ok(!logs.join('\n').includes('private-password'));
    assert.ok(!logs.join('\n').includes('secret-jwt'));
  } finally { console.error = originalError; }
});
