const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const database = { shop: {}, shopPhoto: {} };
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: database } };
const envPath = require.resolve('../dist/config/env');
require.cache[envPath] = { id: envPath, filename: envPath, loaded: true, exports: { env: { CORS_ORIGIN: '*', JWT_SECRET: 'photo-test-only-secret' } } };
const { prepareShopPhoto, MAX_PHOTO_BYTES } = require('../dist/utils/shop-photo');
const app = require('../dist/app').default;
let server, root, input, stored, writes = 0, revision = 0;
const shop = { id: 5, userId: 1, shopName: 'Photo test shop', services: [] };
const token = userId => jwt.sign({ userId, isShopOwner: true }, 'photo-test-only-secret');
before(async () => {
  input = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#2457AD' } }).png().toBuffer();
  database.shop.findUnique = async ({ where }) => where.id === 5 || where.userId === 1 ? { ...shop, photo: stored ? { updatedAt: stored.updatedAt } : null } : null;
  database.shop.findMany = async ({ include }) => {
    assert.deepEqual(include.photo, { select: { updatedAt: true } }, 'Listing must not load image bytes');
    return [{ ...shop, photo: stored ? { updatedAt: stored.updatedAt } : null }];
  };
  database.shopPhoto.findUnique = async ({ where }) => where.shopId === 5 ? stored : null;
  database.shopPhoto.upsert = async ({ create, update }) => { writes++; stored = { shopId: 5, bytes: stored ? update.bytes : create.bytes, updatedAt: new Date(1700000000000 + ++revision) }; return { updatedAt: stored.updatedAt }; };
  database.shopPhoto.deleteMany = async () => { writes++; stored = null; return { count: 1 }; };
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  root = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => new Promise(resolve => server.close(resolve)));
async function request(path, method='GET', body, userId=1) {
  return fetch(root + path, { method, headers: { 'Content-Type': 'application/json', ...(userId == null ? {} : { Authorization: `Bearer ${token(userId)}` }) }, body: body == null ? undefined : JSON.stringify(body) });
}
test('missing photos use a null URL and a public 404, without loading bytes in listings', async () => {
  const list = await (await request('/shops')).json();
  assert.equal(list.data[0].photoUrl, null);
  assert.equal((await request('/shops/5/photo','GET',undefined,null)).status,404);
});
test('authenticated ownership is required before decoding or writing photos', async () => {
  const before = writes;
  for (const [id,userId,status] of [['5',null,401],['5',2,403],['99',1,404],['abc',1,400],['-1',1,400]]) {
    const result = await request(`/shops/${id}/photo`,'PUT',{ imageBase64: 'not-an-image' },userId);
    assert.equal(result.status,status);
  }
  assert.equal(writes,before);
});
test('malformed, disguised, oversized and animated uploads are rejected without writes', async () => {
  const before = writes;
  for (const body of [{}, { imageBase64: '%%%%' }, { imageBase64: Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64') },
    { imageBase64: 'AAAA'.repeat(Math.floor(MAX_PHOTO_BYTES/3)+1) }]) {
    const result = await request('/shops/5/photo','PUT',body);
    assert.equal(result.status,400);
  }
  const oversized = await request('/shops/5/photo','PUT',{ imageBase64: 'A'.repeat(10 * 1024 * 1024) });
  assert.equal(oversized.status,413);
  const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } }).gif().toBuffer();
  await assert.rejects(prepareShopPhoto({ imageBase64: gif.toString('base64') }), /valid JPG/);
  assert.equal(writes,before);
});
test('owner upload is decoded, resized, stripped of metadata, and served publicly with safe headers', async () => {
  const upload = await request('/shops/5/photo','PUT',{ imageBase64: input.toString('base64') });
  assert.equal(upload.status,200);
  const { data } = await upload.json();
  assert.match(data.photoUrl,/^\/api\/shops\/5\/photo\?v=\d+$/);
  const image = await fetch(root.replace('/api','') + data.photoUrl);
  assert.equal(image.status,200);
  assert.equal(image.headers.get('content-type'),'image/jpeg');
  assert.equal(image.headers.get('cross-origin-resource-policy'),'cross-origin');
  assert.equal(image.headers.get('x-content-type-options'),'nosniff');
  const metadata = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
  assert.equal(metadata.format,'jpeg'); assert.ok(metadata.width <= 1440 && metadata.height <= 1080);
  assert.equal(metadata.exif,undefined);
  const cached = await fetch(root + '/shops/5/photo',{ headers: { 'If-None-Match': image.headers.get('etag') } });
  assert.equal(cached.status,304);
  const list = await (await request('/shops')).json();
  assert.equal(list.data[0].photoUrl,data.photoUrl);
  assert.equal(list.data[0].photo,undefined); assert.equal(list.data[0].bytes,undefined);
});
test('replacement changes the photo version; removal requires ownership and restores the placeholder', async () => {
  const previous = (await (await request('/shops')).json()).data[0].photoUrl;
  const updated = await (await request('/shops/5/photo','PUT',{ imageBase64: input.toString('base64') })).json();
  assert.notEqual(updated.data.photoUrl,previous);
  const before = writes;
  assert.equal((await request('/shops/5/photo','DELETE',undefined,2)).status,403);
  assert.equal(writes,before);
  assert.equal((await request('/shops/5/photo','DELETE')).status,200);
  assert.equal((await (await request('/shops')).json()).data[0].photoUrl,null);
  assert.equal((await request('/shops/5/photo','GET',undefined,null)).status,404);
});
