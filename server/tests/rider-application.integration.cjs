const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const configuration = require('../dist/config/database');
const db = configuration.default;
const { env } = require('../dist/config/env');

async function main() {
  const before = await db.user.count();
  const rollback = new Error('ROLLBACK_RIDER_APPLICATION_TEST');
  try {
    await db.$transaction(async tx => {
      configuration.default = new Proxy(tx, { get(target, key) { return key === '$transaction' ? callback => callback(tx) : target[key]; } });
      const app = require('../dist/app').default;
      const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
      try {
        const root = `http://127.0.0.1:${server.address().port}/api`;
        const email = `rider-${randomUUID()}@example.invalid`;
        const admin = await tx.user.create({ data: { name: 'Application Test Admin', email: `admin-${randomUUID()}@example.invalid`, password: 'test-only', isAdmin: true } });
        const adminToken = jwt.sign({ userId: admin.id }, env.JWT_SECRET);
        async function request(path, method, body, token, expected = 200) {
          const response = await fetch(root + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
          const result = await response.json();
          assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result.error || result.message)}`);
          return result.data;
        }
        const input = { name: 'New Rider', email, phone: '09123456789', password: 'test-password-123', confirmPassword: 'test-password-123', isRider: true, isAdmin: true, applicationStatus: 'Approved' };
        await request('/auth/rider-signup', 'POST', { ...input, phone: '' }, null, 400);
        await request('/auth/rider-signup', 'POST', { ...input, confirmPassword: 'wrong' }, null, 400);
        const submitted = await request('/auth/rider-signup', 'POST', input, null, 201);
        assert.equal(submitted.user.isRider, false);
        assert.equal(submitted.user.isAdmin, false);
        assert.equal(submitted.user.riderApplicationStatus, 'Draft');
        assert.equal(submitted.user.password, undefined);
        const rider = await tx.riderProfile.findUnique({ where: { userId: submitted.user.id } });
        assert.equal(rider.active, false); assert.equal(rider.online, false);
        await request('/auth/rider-signup', 'POST', input, null, 409);
        await request('/delivery/rider', 'GET', undefined, submitted.token, 403);
        await request('/delivery/availability', 'PUT', { online: true }, submitted.token, 403);
        await request('/delivery/riders', 'PUT', { email, active: true }, adminToken, 409);
        const login = await request('/auth/login', 'POST', { email, password: input.password });
        assert.equal(login.user.riderApplicationStatus, 'Draft');
        const profile = await request(`/users/${submitted.user.id}`, 'GET', undefined, submitted.token);
        assert.equal(profile.riderApplicationStatus, 'Draft');
        const details = { birthdate: '1995-05-10', address_line_1: '123 Test Street', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400', licenseNumber: 'TEST-PRO-123', licenseExpiry: '2030-12-31', motorcycleMake: 'Test brand', motorcycleModel: 'Test model', motorcycleYear: 2020, plateNumber: 'TEST123', registeredOwner: true };
        await request('/delivery/application/submit', 'POST', { acknowledge: true }, submitted.token, 400);
        await request('/delivery/application', 'PUT', { ...details, birthdate: '2020-01-01' }, submitted.token, 400);
        await request('/delivery/application', 'PUT', { ...details, licenseExpiry: '2020-01-01' }, submitted.token, 400);
        await request('/delivery/application', 'PUT', details, submitted.token);
        const sharp = require('sharp');
        const bytes = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
        const docTypes = ['ProfessionalLicense', 'Clearance', 'TinProof', 'OfficialReceipt', 'RegistrationCertificate'];
        await request('/delivery/application/documents/ProfessionalLicense', 'PUT', { imageBase64: Buffer.from('not an image').toString('base64') }, submitted.token, 400);
        for (const type of docTypes) await request(`/delivery/application/documents/${type}`, 'PUT', { imageBase64: bytes.toString('base64') }, submitted.token);
        await request('/delivery/application/submit', 'POST', { acknowledge: true }, submitted.token, 400);
        await request('/delivery/application/documents/ApplicantPhoto', 'PUT', { imageBase64: bytes.toString('base64') }, submitted.token);
        const photo = await tx.riderDocument.findUnique({ where: { userId_type: { userId: submitted.user.id, type: 'ApplicantPhoto' } } });
        const dimensions = await sharp(photo.bytes).metadata();
        assert.equal(dimensions.width, 600); assert.equal(dimensions.height, 600);
        await request('/delivery/application/submit', 'POST', { acknowledge: false }, submitted.token, 400);
        await request('/delivery/application/submit', 'POST', { acknowledge: true }, submitted.token);
        const application = await request(`/delivery/applications/${submitted.user.id}`, 'GET', undefined, adminToken);
        assert.equal(application.applicationStatus, 'Pending');
        assert.ok(application.documents.every(doc => !('bytes' in doc)));
        const imageUrl = `${root}/delivery/applications/${submitted.user.id}/documents/ProfessionalLicense`;
        assert.equal((await fetch(imageUrl)).status, 401);
        const privateImage = await fetch(imageUrl, { headers: { Authorization: `Bearer ${submitted.token}` } });
        assert.equal(privateImage.status, 200); assert.match(privateImage.headers.get('cache-control'), /no-store/);
        const outsider = await tx.user.create({ data: { name: 'Document Outsider', email: `outsider-${email}`, password: 'test-only' } });
        const outsiderToken = jwt.sign({ userId: outsider.id }, env.JWT_SECRET);
        assert.equal((await fetch(imageUrl, { headers: { Authorization: `Bearer ${outsiderToken}` } })).status, 403);
        await request(`/delivery/riders/${submitted.user.id}/review`, 'PUT', { status: 'Approved' }, adminToken, 400);
        // Rejection feedback blocks submission until a replacement is uploaded.
        const first = application.documents.find(doc => doc.type === 'ProfessionalLicense');
        await request(`/delivery/applications/${submitted.user.id}/documents/ProfessionalLicense/review`, 'PUT', { status: 'Rejected', reason: 'Upload a clearer professional license photo.', expectedUpdatedAt: first.updatedAt }, adminToken);
        await request('/delivery/application/submit', 'POST', { acknowledge: true }, submitted.token, 400);
        await request('/delivery/application/documents/ProfessionalLicense', 'PUT', { imageBase64: bytes.toString('base64') }, submitted.token);
        await request(`/delivery/applications/${submitted.user.id}/documents/ProfessionalLicense/review`, 'PUT', { status: 'Verified', expectedUpdatedAt: first.updatedAt }, adminToken, 409);
        await request('/delivery/application/submit', 'POST', { acknowledge: true }, submitted.token);
        const refreshed = await request(`/delivery/applications/${submitted.user.id}`, 'GET', undefined, adminToken);
        for (const doc of refreshed.documents) await request(`/delivery/applications/${submitted.user.id}/documents/${doc.type}/review`, 'PUT', { status: 'Verified', expectedUpdatedAt: doc.updatedAt }, adminToken);
        await request(`/delivery/riders/${submitted.user.id}/review`, 'PUT', { status: 'Approved' }, submitted.token, 403);
        await request(`/delivery/riders/${submitted.user.id}/review`, 'PUT', { status: 'Approved' }, adminToken);
        await request(`/delivery/riders/${submitted.user.id}/review`, 'PUT', { status: 'Rejected', reason: 'Stale review must not override approval' }, adminToken, 409);
        const verified = await request('/auth/verify-token', 'POST', {}, submitted.token);
        assert.equal(verified.user.isRider, true);
        assert.equal(verified.user.riderApplicationStatus, 'Approved');
        const jobs = await request('/delivery/rider', 'GET', undefined, submitted.token);
        assert.equal(jobs.rider.active, true);
        assert.equal(jobs.rider.reviewedById, admin.id);
        const second = await request('/auth/rider-signup', 'POST', { ...input, email: `second-${email}` }, null, 201);
        await tx.riderProfile.update({ where: { userId: second.user.id }, data: { applicationStatus: 'Pending' } });
        await request(`/delivery/riders/${second.user.id}/review`, 'PUT', { status: 'Rejected' }, adminToken, 400);
        await request(`/delivery/riders/${second.user.id}/review`, 'PUT', { status: 'Rejected', reason: 'Please contact the administrator to verify your contact details.' }, adminToken);
        const rejected = await request(`/users/${second.user.id}`, 'GET', undefined, second.token);
        assert.equal(rejected.isRider, false);
        assert.equal(rejected.riderApplicationStatus, 'Rejected');
        assert.ok(rejected.riderReviewReason);
        console.log('PASS rider registration → pending login/status → admin approval → rider access, rejection feedback, role isolation and stale-review protection.');
      } finally { await new Promise(resolve => server.close(resolve)); configuration.default = db; }
      throw rollback;
    }, { maxWait: 30000, timeout: 120000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { configuration.default = db; }
  assert.equal(await db.user.count(), before);
  console.log('PASS all test accounts and application writes rolled back.');
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error.message : `Rider application integration failed (${error.code || error.name}).`); process.exitCode = 1; }).finally(() => db.$disconnect());
