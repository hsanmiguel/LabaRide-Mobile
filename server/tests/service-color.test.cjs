const assert = require('node:assert/strict');
const { test } = require('node:test');
const db = {};
const file = require.resolve('../dist/config/database');
require.cache[file] = { id: file, filename: file, loaded: true, exports: { __esModule: true, default: db } };
const { withUniqueServiceColor, normalizeServiceColor } = require('../dist/utils/service-color');
const { createServiceSchema } = require('../dist/validators/shop.validator');

function fixture(initial = []) {
  const rows = initial.map(row => ({ ...row }));
  let queue = Promise.resolve(), locked = false, locks = 0;
  db.$transaction = async callback => {
    const previous = queue;
    let release;
    queue = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await callback(db); } finally { locked = false; release(); }
  };
  db.$queryRaw = async strings => { assert.match(strings.join(''), /FOR UPDATE/); locked = true; locks++; return []; };
  db.shopService = { findMany: async ({ where }) => {
    assert.ok(locked, 'color lookup occurs after the shop lock');
    return rows.filter(row => row.shopId === where.shopId && row.id !== where.id?.not);
  } };
  const assign = (color, id = rows.length + 1, shopId = 5) => withUniqueServiceColor(shopId, color, id, async () => {
    const row = rows.find(row => row.id === id && row.shopId === shopId);
    if (row) row.color = color;
    else rows.push({ id, shopId, color });
    return { id, color };
  });
  return { rows, assign, locks: () => locks };
}

test('service color validation normalizes case and short hex and rejects malformed colors', () => {
  const body = { serviceName: 'Wash', price: 25 };
  assert.equal(createServiceSchema.parse({ body: { ...body, color: ' #abc ' } }).body.color, '#AABBCC');
  assert.equal(normalizeServiceColor('#aBc'), '#AABBCC');
  for (const color of ['red', '#12345', '#12345678', 'url(test)']) assert.throws(() => createServiceSchema.parse({ body: { ...body, color } }));
});

test('colors are unique within each shop, and the same service can keep its own color', async () => {
  const f = fixture([{ id: 1, shopId: 5, color: '#abc' }]);
  await assert.rejects(f.assign('#AABBCC', 2), error => error.statusCode === 409);
  assert.equal(f.rows.length, 1);
  await f.assign('#AABBCC', 1);
  await f.assign('#AABBCC', 3, 6);
  assert.equal(f.rows.length, 2, 'another shop can use the same color');
  await f.assign('#28536B', 2);
  assert.equal(f.rows.length, 3);
});

test('simultaneous requests for a color produce exactly one assignment', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.assign('#7EA8BE', 1), f.assign('#7EA8BE', 2)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 409);
  assert.equal(f.rows.length, 1);
  assert.equal(f.locks(), 2);
});

test('older clients receive an unused color and legacy fallback colors remain reserved', async () => {
  fixture([{ id: 1, shopId: 5, color: null }]);
  assert.equal(await withUniqueServiceColor(5, undefined, undefined, async (tx, color) => color), '#6842D9');
  fixture(['#321078','#6842D9','#886AB8','#D0C1E8','#7EA8BE','#28536B','#5C374C','#052F5F'].map((color, index) => ({ id: index + 1, shopId: 5, color })));
  await assert.rejects(withUniqueServiceColor(5, undefined, undefined, async () => assert.fail('Must not write')), error => error.statusCode === 409);
});
