// Isolated committed fixtures let actual API transactions roll back failed approvals.
// All fixture users, shops and document bytes are removed in finally by exact IDs.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const prisma = require('../dist/config/database').default;
const { env } = require('../dist/config/env');
const app = require('../dist/app').default;
async function main() {
  const prefix = `shop-doc-${randomUUID()}`, userIds = [], shopIds = [];
  let server;
  try {
    async function user(name, flags = {}) {
      const row = await prisma.user.create({ data: { name: `Test ${name}`, email: `${prefix}-${name}@example.invalid`, password: 'fixture-only-no-login', ...flags } });
      userIds.push(row.id); return { ...row, token: jwt.sign({ userId: row.id }, env.JWT_SECRET) };
    }
    const owner = await user('owner'), other = await user('other'), admin = await user('admin', { isAdmin: true }), legacyOwner = await user('legacy', { isShopOwner: true });
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const root = `http://127.0.0.1:${server.address().port}/api`;
    async function request(path, method = 'GET', body, who = owner, status = 200) {
      const response = await fetch(root + path, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${who.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json(); assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result.error)}`); return result.data;
    }
    const input = { shopName: 'Private document test shop', contactNumber: '09123456789', openingTime: '08:00', closingTime: '18:00', address_line_1: '123 Test Street', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400', country: 'Philippines', address_type: 'Work' };
    const shop = await request('/shops', 'POST', input, owner, 201); shopIds.push(shop.id);
    assert.equal(shop.requirementsVersion, 1); assert.equal(shop.approvalStatus, 'Pending');
    const path = `/shops/${shop.id}/documents`;
    async function approve(version, status = 200) { return request(`/admin/shops/${shop.id}/review`, 'PUT', { status: 'Approved', expectedStatus: 'Pending', expectedVersion: version }, admin, status); }
    await approve(shop.applicationVersion, 400);
    assert.equal((await prisma.shop.findUnique({ where: { id: shop.id } })).approvalStatus, 'Pending', 'Denied approval rolls back publication');
    assert.equal((await prisma.user.findUnique({ where: { id: owner.id } })).isShopOwner, false);
    await request(path, 'GET', undefined, other, 403); await request(path, 'GET', undefined, null, 401);
    const imageBase64 = (await sharp({ create: { width: 200, height: 200, channels: 3, background: '#2457AD' } }).withMetadata().jpeg().toBuffer()).toString('base64');
    for (const type of ['SECRegistration', 'TinProof', 'MayorsPermit']) await request(`${path}/${type}`, 'PUT', { imageBase64 });
    let metadata = await request(path);
    assert.deepEqual(metadata.missing, []); assert.equal(metadata.canApprove, false);
    assert.ok(metadata.documents.every(doc => doc.bytes === undefined));
    await approve(metadata.applicationVersion, 400);
    await request(`${path}/TinProof/review`, 'PUT', { status: 'Verified', expectedUpdatedAt: metadata.documents.find(doc => doc.type === 'TinProof').updatedAt }, owner, 403);
    const image = await fetch(root + path + '/TinProof', { headers: { Authorization: `Bearer ${owner.token}` } });
    assert.equal(image.headers.get('cache-control'), 'private, no-store'); assert.equal(image.headers.get('content-type'), 'image/jpeg');
    assert.equal((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).exif, undefined);
    await request(`${path}/TinProof`, 'GET', undefined, other, 403);
    const tin = metadata.documents.find(doc => doc.type === 'TinProof');
    await request(`${path}/TinProof/review`, 'PUT', { status: 'Rejected', reason: 'Please upload a clearer tax document.', expectedUpdatedAt: tin.updatedAt }, admin);
    assert.equal((await request(path)).approvalStatus, 'Rejected');
    await request(`${path}/TinProof`, 'PUT', { imageBase64 });
    await request(`${path}/TinProof/review`, 'PUT', { status: 'Verified', expectedUpdatedAt: tin.updatedAt }, admin, 409);
    metadata = await request(path);
    for (const doc of metadata.documents) await request(`${path}/${doc.type}/review`, 'PUT', { status: 'Verified', expectedUpdatedAt: doc.updatedAt }, admin);
    metadata = await request(path); assert.equal(metadata.canApprove, true);
    await approve(shop.applicationVersion, 409); await approve(metadata.applicationVersion);
    assert.equal((await prisma.user.findUnique({ where: { id: owner.id } })).isShopOwner, true);
    await request(`${path}/TinProof`, 'GET', undefined, other, 403);
    assert.equal((await request(`/shops/${shop.id}`, 'GET', undefined, other)).documents, undefined);
    await request(`/shops/${shop.id}`, 'PUT', { ...input, shopName: 'Updated identity' });
    metadata = await request(path); assert.equal(metadata.approvalStatus, 'Pending'); assert.ok(metadata.documents.every(doc => doc.status === 'Pending'));
    await approve(metadata.applicationVersion, 400);
    const legacy = await prisma.shop.create({ data: { userId: legacyOwner.id, ...input, approvalStatus: 'Approved', requirementsVersion: 0 } }); shopIds.push(legacy.id);
    await request(`/admin/shops/${legacy.id}/review`, 'PUT', { status: 'Suspended', expectedStatus: 'Approved', expectedVersion: 1, reason: 'Fixture suspension for restoration check.' }, admin);
    await request(`/admin/shops/${legacy.id}/review`, 'PUT', { status: 'Approved', expectedStatus: 'Suspended', expectedVersion: 1 }, admin);
    console.log('PASS: new-shop approval gating, SEC alternative, private sanitized images, correction/replacement, stale review denial, verified approval, identity re-review and legacy restoration.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await prisma.$transaction(async tx => {
      await tx.shop.deleteMany({ where: { id: { in: shopIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds }, email: { startsWith: prefix } } });
    }, { timeout: 60000 });
    assert.equal(await prisma.user.count({ where: { email: { startsWith: prefix } } }), 0);
    assert.equal(await prisma.shopDocument.count({ where: { shopId: { in: shopIds } } }), 0);
    console.log('PASS: all scoped shop/document fixtures removed.');
  }
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : `Shop requirement integration failed (${error.code || error.name}).`); process.exitCode = 1; }).finally(() => prisma.$disconnect());
