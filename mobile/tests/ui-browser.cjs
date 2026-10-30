// Production-bundle UI smoke test. Fixtures are intercepted in this isolated
// browser only; no production API or database is read or written.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'artifacts/ui-redesign');
const photoTest = process.argv.includes('--photos');
const approvalTest = process.argv.includes('--approvals');
const weightTest = process.argv.includes('--weight-evidence');
const responseTest = process.argv.includes('--assignment-response');
const pullTest = process.argv.includes('--pull-jobs');
const bookingTest = process.argv.includes('--booking-confirmation');
const trackingTest = process.argv.includes('--rider-tracking');
const callTest = process.argv.includes('--call-contact');
const shopRequirementsTest = process.argv.includes('--shop-requirements');
const notificationsTest = process.argv.includes('--notification-delete');
const deliveryTest = process.argv.includes('--delivery') || weightTest || responseTest || pullTest || bookingTest || trackingTest || callTest;
const riderApplicationTest = process.argv.includes('--rider-application');
const dispatchTest = process.argv.includes('--dispatch');
const applicationTest = process.argv.includes('--application');
const dialogTest = process.argv.includes('--dialogs');
const logoutTest = process.argv.includes('--logout');
const scheduleTest = process.argv.includes('--schedule');
const shopOrdersTest = process.argv.includes('--shop-orders');
const liveOperationsTest = process.argv.includes('--live-operations');
const processingTimerTest = process.argv.includes('--processing-timers');
const orderStepsTest = process.argv.includes('--order-steps');
const originalOrderStepsTest = process.argv.includes('--original-order-steps');
const manualTimersTest = process.argv.includes('--manual-timers');
const manualTimerWrites = [];
const analyticsTest = process.argv.includes('--analytics');
const servicesTest = process.argv.includes('--services');
const serviceWrites = [];
const priceRangeWrites = [];
const analyticsRequests = [];
const { analyticsRange, analyticsSeries } = require('../../server/dist/utils/shop-analytics');
const nativeDialogs = [], dialogWrites = [], workflowWrites = [];
let failServiceDelete = false;
let photoBytes, hasPhoto = false, brokenPhoto = false;
fs.mkdirSync(artifacts, { recursive: true });
const user = { id: 7, name: 'Test Customer With A Long Name', email: 'ui-test@example.test', isShopOwner: !deliveryTest && !dispatchTest, isAdmin: approvalTest || dispatchTest, isRider: deliveryTest,
  address_line_1: '123 Long Street Name, Building Two', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400', country: 'Philippines', address_type: 'Home', latitude: 13.6217, longitude: 123.1948 };
const shops = [{ ...user, id: 101, userId: 7, approvalStatus: approvalTest || applicationTest ? 'Pending' : 'Approved', applicationVersion: 1, createdAt: new Date().toISOString(), pickupEnabled: true, shopName: 'Test Laundry & Fabric Care With A Long Shop Name', openingTime: '08:00', closingTime: '18:00', contactNumber: '09123456789', services: [{ id: 1, serviceName: 'Full Service', price: 215, packageKilos: 8 }, { id: 2, serviceName: 'Wash Only', price: 25 }], kiloPrices: [], clothingTypes: [], householdItems: [] },
  { ...user, id: 102, userId: 8, approvalStatus: 'Approved', applicationVersion: 1, createdAt: new Date().toISOString(), shopName: 'Test Neighborhood Laundry', latitude: 13.63, services: [] }];
const reviews = [];
if (servicesTest) {
  shops[0].services[0].color = '#321078';
  shops[0].services[1].color = '#D0C1E8';
}
let notificationRecords = [], failNotificationDelete = false;
const notificationDeletes = [];
const shopDocumentFixture = [];
const requirementDocuments = ['ApplicantPhoto', 'ProfessionalLicense', 'Clearance', 'TinProof', 'OfficialReceipt', 'RegistrationCertificate'];
const requirementFixture = { userId: 7, applicationStatus: 'Draft', registeredOwner: true, licenseNumber: 'TEST-PRO-123', licenseExpiry: '2030-12-31T00:00:00Z', motorcycleMake: 'Test brand', motorcycleModel: 'Test model', motorcycleYear: 2020, plateNumber: 'TEST123', missing: [], documents: requirementDocuments.map((type, index) => ({ id: index + 1, type, status: 'Pending', updatedAt: new Date().toISOString() })), user: { name: user.name, email: user.email, phone: '09123456789', birthdate: '1995-05-10T00:00:00Z', address_line_1: '123 Test Street', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400' } };
const deliveryJobs = [
  { id: 1, transactionId: 42, riderId: 7, stage: 'Pickup', status: 'Offered', expiresAt: new Date(Date.now() + 300000).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), order: { id: 42, version: 1, status: 'PickupAssigned', serviceName: 'Full Service', kiloAmount: 8, scheduledDate: '2026-10-23', scheduledTime: '1970-01-01T09:00:00.000Z', customer: { address: 'Naga, Camarines Sur' }, shop: { name: shops[0].shopName, address: '123 Long Street, Naga, Camarines Sur' } } },
  { id: 2, transactionId: 43, riderId: 7, stage: 'Delivery', status: 'Accepted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), order: { id: 43, version: 6, status: 'OutForDelivery', serviceName: 'Full Service', kiloAmount: 8, totalAmount: 245, paymentMethod: 'Cash on Delivery', scheduledDate: '2026-10-23', scheduledTime: '1970-01-01T09:00:00.000Z', customer: { name: 'Assigned Customer', phone: '09123456789', address: '456 Long Customer Street Name, Naga, Camarines Sur, Philippines', instructions: 'Ring the doorbell on arrival' }, shop: { name: shops[0].shopName, address: '123 Long Street, Naga', phone: '09123456789' } } },
];
const orders = ['Pending', 'Processing', 'Completed', 'Cancelled'].map((status,i) => ({ id: 42+i, userId: 7, shopId: 101, userName: user.name,
  serviceName: 'Full Service', kiloAmount: 8, subtotal: 215, deliveryFee: 30, voucherDiscount: 0, totalAmount: 245,
  deliveryType: 'Deliver', scheduledDate: '2026-10-15', scheduledTime: '10:00 AM', paymentMethod: 'Cash on Delivery', status,
  createdAt: new Date().toISOString(), shop: shops[0], ...Object.fromEntries(Object.entries(user).filter(([key]) => ['address_line_1','city','state_province','country','postal_code','address_type'].includes(key))) }));
if (shopOrdersTest || liveOperationsTest) {
  for (const [index, stage] of ['PickupEnRoute', 'AtPartner', 'LaundryReceived', 'Washing', 'ReadyForDelivery', 'OutForDelivery'].entries())
    orders.push({ ...orders[0], id: 50 + index, workflowStatus: stage, createdAt: `2026-10-${20 + index}T01:00:00Z`, collectionMethod: 'ShopPickup' });
}
if (liveOperationsTest) {
  shops[0].services[0].color = '#321078';
  shops[0].services[1].color = '#D0C1E8';
  orders[1].serviceName = 'Wash Only';
  orders[1].estimatedReadyAt = new Date(Date.now() - 3600000).toISOString();
}
if (processingTimerTest) {
  const started = new Date(Date.now() - 5 * 60000).toISOString();
  Object.assign(orders[1], { washingMinutes: 30, dryingMinutes: 45, processingStartedAt: started, workflowStatus: 'Washing', processingTimingSource: 'snapshot' });
  Object.assign(orders[0], { status: 'Processing', washingMinutes: 30, dryingMinutes: 45, processingStartedAt: new Date(Date.now() - 50 * 60000).toISOString(), dryingStartedAt: started, workflowStatus: 'Drying', processingTimingSource: 'snapshot' });
}
const dispatchOrders = orders.slice(0, 2).map((order,index) => ({ ...order, workflowStatus: index ? 'ReadyForDelivery' : 'PickupQueued', workflowVersion: 3, assignments: [], events: [] }));
if (orderStepsTest) Object.assign(orders[0], {
  status: 'Queued', workflowStatus: 'LaundryReceived', workflowVersion: 0, collectionMethod: 'Dropoff',
  receivedAt: new Date(Date.now()-60000).toISOString(), washingMinutes: 30, dryingMinutes: 45, processingTimingSource: 'snapshot',
  assignments: [], events: [{ id: 1, action: 'receive', toStatus: 'LaundryReceived', createdAt: new Date().toISOString(), actor: { name: 'Laundry partner' } }],
});
if (manualTimersTest) Object.assign(orders[0], {
  status:'Processing', workflowStatus:null, processingStartedAt:'2020-01-01T00:00:00Z', washingStartedAt:null, dryingStartedAt:null,
  washingMinutes:30, dryingMinutes:45, processingTimingSource:'snapshot',
});
const dispatchWrites = [];
let handoffFixture;
const weightRecords = [], weightWrites = [];
let weightPhotoFailure = false;
const assignmentResponses = [];
let expireAssignmentResponse = false;
const bookingWrites = [];
let bookingState = 'BookingPending', bookingVersion = 0, bookingConflict = false;
const gpsWrites = [];
let gpsLocation = null, gpsSession = null, trackingReadFailure = false, trackingPhase = 'PickupEnRoute';
let boardOnline = true, boardHasPosition = true, boardWorkload = 0, claimConflict = false;
const publicClaimWrites = [], pullAssignedJobs = [];
let missingRoutePin=false, roadRouteFailure=false;
const roadRouteRequests=[];
const publicBoardJobs = [
  { id: 42, stage: 'Pickup', workflowVersion: 3, serviceName: 'Full Service', kilos: '8', scheduledDate: '2026-10-24', scheduledTime: '1970-01-01T09:00:00.000Z', createdAt: '2026-10-24T01:00:00Z', shopName: 'Test Laundry Partner With A Long Name', pickupArea: 'Naga, Camarines Sur', dropoffArea: 'Basud, Camarines Norte', distanceKm: 1.2 },
  { id: 43, stage: 'Delivery', workflowVersion: 6, serviceName: 'Wash Only', kilos: '5', scheduledDate: null, scheduledTime: null, createdAt: '2026-10-24T02:00:00Z', shopName: 'Test Laundry Partner', pickupArea: 'Basud, Camarines Norte', dropoffArea: 'Naga, Camarines Sur', distanceKm: null },
];
let missingDispatchOrigin = false;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;
let socket;
let mode = 'populated';
let closing = false;
let errors = [];
const consoleMessages = new Set();
let nextId = 0;
let sessionScriptId;
const pending = new Map();
const server = http.createServer((req,res) => {
  const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = requestPath === '/' ? 'index.html' : requestPath.slice(1);
  let filename = path.resolve(root, 'dist', relative);
  if (!filename.startsWith(path.join(root,'dist') + path.sep)) filename = path.join(root,'dist/index.html');
  if (!fs.existsSync(filename) || fs.statSync(filename).isDirectory()) filename = path.join(root,'dist/index.html');
  const mime = { '.js':'text/javascript', '.html':'text/html', '.ttf':'font/ttf', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json' };
  res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' });
  fs.createReadStream(filename).pipe(res);
});
function command(method, params = {}) {
  if (closing) return Promise.resolve({});
  const id = ++nextId;
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { try { if (await evaluate(expression)) return; } catch (error) { if (!/null|context|undefined/.test(error.message)) throw error; } await pause(100); }
  throw new Error('UI did not become ready: ' + expression + '\n' + await evaluate('document.body.innerText'));
}
async function visit(route, width, expected, screenshot) {
  errors = [];
  if (sessionScriptId) await command('Page.removeScriptToEvaluateOnNewDocument',{identifier:sessionScriptId});
  const fixedClock = scheduleTest ? `const OriginalDate=Date;globalThis.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[Date.parse('2026-10-22T02:30:00Z')]));}static now(){return OriginalDate.parse('2026-10-22T02:30:00Z');}};` : '';
  const savedAddressFixture = scheduleTest ? `localStorage.setItem('labaride-addresses:7',${JSON.stringify(JSON.stringify([{ ...user, address_line_1: '88 Saved Address Street', address_type: 'Work', access_code: 'Gate 2', dropoff_instructions: 'Ring the bell' }]))});` : '';
  const script = await command('Page.addScriptToEvaluateOnNewDocument',{source:`${fixedClock}${savedAddressFixture}sessionStorage.setItem('auth_token','isolated-ui-test');sessionStorage.setItem('auth_user',${JSON.stringify(JSON.stringify(user))});`});
  sessionScriptId = script.identifier;
  await command('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 844 : 1000, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: `http://127.0.0.1:4178${route}` });
  await waitFor(`document.body?.innerText?.includes(${JSON.stringify(expected)})`);
  await pause(250);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, route + ' must fit viewport');
  const actualPath = await evaluate('location.pathname');
  const wrong = actualPath.startsWith('/shop/') ? ['rgb(36, 87, 173)', 'rgb(56, 103, 255)'] : ['rgb(50, 16, 120)', 'rgb(104, 66, 217)'];
  const leaks = await evaluate(`Array.from(document.querySelectorAll('[role="button"],[role="tab"],svg')).filter(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return false;const s=getComputedStyle(e);return ${JSON.stringify(wrong)}.includes(s.color)||${JSON.stringify(wrong)}.includes(s.backgroundColor)||${JSON.stringify(wrong)}.includes(s.stroke)}).length`);
  assert.equal(leaks, 0, route + ' must not contain the other interface color');
  assert.deepEqual(errors, [], route + ' runtime exceptions');
  if (screenshot) {
    const shot = await command('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifacts,screenshot + '.png'), Buffer.from(shot.data,'base64'));
  }
  console.log('PASS', width, route, mode);
}
async function clickText(text) {
  const clicked = await evaluate(`(()=>{const candidates=Array.from(document.querySelectorAll('[role="button"],[role="tab"],[role="radio"],a')).filter(e=>e.innerText.trim()===${JSON.stringify(text)}||e.getAttribute("aria-label")===${JSON.stringify(text)});const e=candidates.find(e=>e.closest('[aria-modal="true"],[role="dialog"]'))||candidates[0];if(e){e.click();return true}return false})()`);
  assert.ok(clicked,'Missing interactive control: '+text);
  await pause(150);
}
(async () => {
  if (photoTest || riderApplicationTest || weightTest || shopRequirementsTest) {
    const sharp = require('../../server/node_modules/sharp');
    photoBytes = await sharp({ create: { width: 240, height: 160, channels: 3, background: '#2457AD' } }).jpeg().toBuffer();
    fs.writeFileSync(path.join(artifacts,'upload-test.jpg'),photoBytes);
  }
  await new Promise(resolve => server.listen(4178,'127.0.0.1',resolve));
  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const profile = path.join(root, '.ui-browser-profile');
  browser = spawn(chrome, ['--headless=new','--disable-gpu','--no-sandbox','--disable-extensions','--no-first-run','--no-default-browser-check', '--remote-debugging-port=9227', '--user-data-dir='+profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let target;
  for (let i=0;i<60;i++) { try { target=(await (await fetch('http://127.0.0.1:9227/json')).json()).find(t=>t.type==='page'); if(target)break; } catch {} await pause(100); }
  assert.ok(target,'Chrome debugging endpoint unavailable');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open',resolve,{once:true}));
  socket.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id) { const item=pending.get(message.id); if(!item)return; clearTimeout(item.timer);pending.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);return; }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Page.javascriptDialogOpening') {
      nativeDialogs.push(message.params.message);
      await command('Page.handleJavaScriptDialog',{ accept: false });
    }
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) consoleMessages.add(message.params.args.map(arg => arg.value || arg.description || '').join(' '));
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      try {
        if(pullTest && request.url.includes('unpkg.com/leaflet')) {
          const js = `window.L={map:function(id){var node=document.getElementById(id);node.style.background='repeating-linear-gradient(0deg,#EDF3F7,#EDF3F7 39px,#DEE7EF 40px)';return{node:node,layers:[],fitBounds:function(points){this.points=points;var self=this;var ys=points.map(p=>p[0]),xs=points.map(p=>p[1]);function project(p){return[25+(p[1]-Math.min(...xs))/(Math.max(...xs)-Math.min(...xs)||1)*(node.clientWidth-50),25+(Math.max(...ys)-p[0])/(Math.max(...ys)-Math.min(...ys)||1)*(node.clientHeight-50)]}this.layers.forEach(layer=>{if(layer.point){var p=project(layer.point);layer.node.style.cssText='position:absolute;left:'+p[0]+'px;top:'+p[1]+'px;transform:translate(-50%,-50%);z-index:2'}else if(layer.coords){layer.poly.setAttribute('points',layer.coords.map(p=>project(p).join(',')).join(' '))}})},invalidateSize:function(){},removeLayer:function(layer){layer.node.remove();this.layers=this.layers.filter(x=>x!==layer)}}},tileLayer:function(){return{addTo:function(){return this},on:function(){return this}}},divIcon:function(o){return o},marker:function(point,opts){return{point:point,node:document.createElement('div'),addTo:function(map){this.node.innerHTML=opts.icon.html;map.node.appendChild(this.node);map.layers.push(this);return this},setLatLng:function(point){this.point=point;return this},setIcon:function(icon){this.node.innerHTML=icon.html;return this},bindTooltip:function(label){this.node.setAttribute('aria-label',label.textContent);return this}}},polyline:function(coords,opts){var svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');svg.style.cssText='position:absolute;width:100%;height:100%;inset:0';poly.setAttribute('fill','none');poly.setAttribute('stroke',opts.color);poly.setAttribute('stroke-width',opts.weight);svg.appendChild(poly);return{coords:coords,node:svg,poly:poly,addTo:function(map){map.node.appendChild(svg);map.layers.push(this);return this}}}};`;
          await command('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:request.url.includes('.js')?'application/javascript':'text/css'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(request.url.includes('.js')?js:'').toString('base64')});
          return;
        }
        if(pullTest && request.url.startsWith('https://api.mapbox.com/directions/')) {
          const points=new URL(request.url).pathname.split('/').pop().split(';').map(point=>point.split(',').map(Number));
          roadRouteRequests.push(points);
          const geometry=[points[0],[points[0][0],(points[0][1]+points[1][1])/2],points[1]];
          await command('Fetch.fulfillRequest',{requestId,responseCode:roadRouteFailure?503:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(JSON.stringify(roadRouteFailure?{code:'Error'}:{code:'Ok',routes:[{distance:1500,duration:360,geometry:{type:'LineString',coordinates:geometry}}]})).toString('base64')});
          return;
        }
        if (trackingTest && request.url.includes('unpkg.com/leaflet')) {
          const js = `window.L={map:function(id){return{node:document.getElementById(id),setView:function(){return this},fitBounds:function(){},invalidateSize:function(){},removeLayer:function(m){m.node.remove()}}},tileLayer:function(){return{addTo:function(){return this},on:function(){return this}}},divIcon:function(o){return o},marker:function(coords,options){return{coords:coords,node:document.createElement('div'),addTo:function(map){this.node.style.cssText='position:absolute;left:45%;top:45%';this.node.innerHTML=options.icon.html;map.node.appendChild(this.node);return this},setLatLng:function(p){this.coords=p;return this},setIcon:function(icon){this.node.innerHTML=icon.html;return this},bindTooltip:function(text){this.node.setAttribute('aria-label',text.textContent);return this},getLatLng:function(){return{lat:this.coords[0],lng:this.coords[1]}}}}};`;
          const isJS = request.url.includes('.js');
          await command('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: isJS ? 'application/javascript' : 'text/css' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(isJS ? js : '').toString('base64') });
          return;
        }
        if (!request.url.includes('/api/')) { await command('Fetch.continueRequest',{ requestId }); return; }
        const endpoint = new URL(request.url).pathname;
        const photoEndpoint = endpoint === '/api/shops/101/photo';
        if(pullTest && request.method==='GET' && /^\/api\/delivery\/orders\/(42|43)\/route-preview$/.test(endpoint)) {
          const pickup=endpoint.includes('/42/');
          const customer=missingRoutePin?null:{latitude:pickup?13.62:13.64,longitude:pickup?123.19:123.21},shop={latitude:13.63,longitude:123.2};
          const data={orderId:pickup?42:43,workflowVersion:3,stage:pickup?'Pickup':'Delivery',origin:pickup?customer:shop,destination:pickup?shop:customer,missingPins:missingRoutePin?['customer']:[]};
          await command('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(JSON.stringify({success:true,data})).toString('base64')});
          return;
        }
        if (originalOrderStepsTest) assert.ok(!endpoint.startsWith('/api/delivery/orders/'),'Original orders retain their existing API');
        assert.ok((scheduleTest || originalOrderStepsTest) && request.method === 'PUT' && endpoint === '/api/transactions/42/status' || ['GET','OPTIONS'].includes(request.method) || photoTest && photoEndpoint && ['PUT','DELETE'].includes(request.method)
          || dispatchTest && request.method === 'PUT' && /^\/api\/delivery\/orders\/\d+\/assign$/.test(endpoint)
          || deliveryTest && handoffFixture && request.method === 'PUT' && endpoint === '/api/delivery/orders/42/action'
          || weightTest && request.method === 'PUT' && endpoint === '/api/delivery/orders/42/weight'
          || responseTest && request.method === 'PUT' && endpoint === '/api/delivery/assignments/1/respond'
          || pullTest && request.method === 'PUT' && (/^\/api\/delivery\/orders\/\d+\/claim$/.test(endpoint) || endpoint === '/api/delivery/availability')
          || bookingTest && request.method === 'PUT' && endpoint === '/api/delivery/orders/42/action'
          || orderStepsTest && request.method === 'PUT' && endpoint === '/api/delivery/orders/42/action'
          || manualTimersTest && request.method === 'PUT' && endpoint === '/api/transactions/42/timer'
          || trackingTest && request.method === 'PUT' && endpoint === '/api/delivery/location'
          || shopRequirementsTest && request.method === 'PUT' && (/^\/api\/shops\/101\/documents\/[^/]+(?:\/review)?$/.test(endpoint) || endpoint === '/api/admin/shops/101/review')
          || notificationsTest && request.method === 'DELETE' && endpoint.startsWith('/api/notifications/')
          || riderApplicationTest && request.method === 'PUT' && endpoint === '/api/delivery/application'
          || riderApplicationTest && request.method === 'PUT' && /^\/api\/delivery\/applications\/\d+\/documents\/[^/]+\/review$/.test(endpoint)
          || riderApplicationTest && request.method === 'POST' && endpoint === '/api/delivery/application/submit'
          || dialogTest && request.method === 'DELETE' && endpoint === '/api/shops/101/services/1'
          || servicesTest && ['POST','PUT'].includes(request.method) && /^\/api\/shops\/101\/services(?:\/\d+)?$/.test(endpoint)
          || servicesTest && request.method === 'POST' && endpoint === '/api/shops/101/kilo-prices'
          || approvalTest && request.method === 'PUT' && ['/api/admin/shops/101/review','/api/shops/101/application'].includes(endpoint)
          || applicationTest && request.method === 'POST' && endpoint === '/api/auth/verify-token'
          || approvalTest && request.method === 'POST' && endpoint === '/api/auth/login', 'UI smoke tests must not mutate real records');
        if (mode === 'loading') await pause(2500);
        if (closing) return;
        if (manualTimersTest && request.method === 'PUT' && endpoint === '/api/transactions/42/timer') {
          const body=JSON.parse(request.postData);
          assert.deepEqual(Object.keys(body),['phase']);
          assert.ok(user.isShopOwner,'Only the owner can start a timer');
          assert.ok(['washing','drying'].includes(body.phase));
          if(body.phase==='drying') assert.ok(orders[0].washingStartedAt);
          manualTimerWrites.push(body);
          const field=body.phase==='washing'?'washingStartedAt':'dryingStartedAt';
          orders[0][field] ||= new Date().toISOString();
          await command('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(JSON.stringify({success:true,data:orders[0]})).toString('base64')});
          return;
        }
        if (orderStepsTest && request.method === 'PUT' && endpoint === '/api/delivery/orders/42/action') {
          const body = JSON.parse(request.postData);
          assert.equal(body.expectedVersion,orders[0].workflowVersion);
          const next = { wash: 'Washing', dry: 'Drying', fold: 'Folding', ready: 'ReadyForDelivery', confirmReceipt: 'Completed' }[body.action];
          assert.ok(next,'Only expected step actions are submitted');
          workflowWrites.push(body); orders[0].workflowStatus=next; orders[0].workflowVersion++;
          if (next==='Washing') orders[0].processingStartedAt=new Date().toISOString();
          if (next==='Drying') orders[0].dryingStartedAt=new Date().toISOString();
          if (next==='Completed') orders[0].completedAt=new Date().toISOString();
          orders[0].events.push({ id: orders[0].events.length+1, action: body.action, toStatus: next, createdAt: new Date().toISOString(), actor: { name: user.name } });
          await command('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(JSON.stringify({success:true,data:{id:42}})).toString('base64')});
          return;
        }
        if ((scheduleTest || originalOrderStepsTest) && request.method === 'PUT' && endpoint === '/api/transactions/42/status') {
          const body = JSON.parse(request.postData);
          workflowWrites.push(body);
          const changedAt = scheduleTest ? '2026-10-22T02:30:00Z' : new Date().toISOString();
          Object.assign(orders[0], body, { updatedAt: changedAt });
          if (body.status === 'Queued') orders[0].receivedAt = changedAt;
          if (body.status === 'Processing') orders[0].processingStartedAt = changedAt;
          if (body.status === 'Ready') orders[0].readyAt = changedAt;
          if (body.status === 'Completed') orders[0].completedAt = changedAt;
        }
        if (notificationsTest && endpoint.startsWith('/api/notifications')) {
          const params = new URL(request.url).searchParams;
          const scope = item => item.userId === 7 && (['rider','admin'].includes(params.get('audience')) ? item.audience === params.get('audience') : !['rider','admin'].includes(item.audience) && item.shopMode === (params.get('shopMode') === 'true'));
          let data = notificationRecords.filter(scope), status = 200;
          if (request.method === 'DELETE') {
            notificationDeletes.push(request.url);
            if (failNotificationDelete) status = 500;
            else {
              const id = Number(endpoint.split('/').at(-1));
              const before = notificationRecords.length;
              notificationRecords = notificationRecords.filter(item => !(item.readAt && (endpoint.endsWith('/read') ? scope(item) : item.userId === 7 && item.id === id)));
              data = { deleted: before - notificationRecords.length };
            }
          }
          await command('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }, { name: 'Access-Control-Allow-Methods', value: 'GET, DELETE, OPTIONS' }], body: Buffer.from(JSON.stringify(status === 500 ? { success: false, error: { message: 'Could not delete this test notification.' } } : { success: true, data })).toString('base64') });
          return;
        }
        if (/^\/api\/shops\/101\/documents$/.test(endpoint)) {
          const has = (type, verified = false) => shopDocumentFixture.some(doc => doc.type === type && (!verified || doc.status === 'Verified'));
          const missing = verified => [...(!has('DTIRegistration', verified) && !has('SECRegistration', verified) ? ['DTI or SEC registration'] : []), ...(!has('TinProof', verified) ? ['TIN proof'] : []), ...(!has('MayorsPermit', verified) ? ['Mayor’s Permit'] : [])];
          const data = { approvalStatus: shops[0].approvalStatus, requirementsVersion: shops[0].requirementsVersion || 0, applicationVersion: shops[0].applicationVersion, documents: shopDocumentFixture, missing: missing(false), unverified: missing(true), canApprove: missing(true).length === 0 };
          await command('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }, { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' }], body: Buffer.from(JSON.stringify({ success: true, data })).toString('base64') });
          return;
        }
        if (shopRequirementsTest && /^\/api\/shops\/101\/documents\/[^/]+$/.test(endpoint)) {
          const type = endpoint.split('/').at(-1);
          if (request.method === 'PUT') {
            assert.ok(JSON.parse(request.postData).imageBase64); assert.equal(user.isAdmin, false);
            let doc = shopDocumentFixture.find(doc => doc.type === type);
            if (!doc) { doc = { type }; shopDocumentFixture.push(doc); }
            Object.assign(doc, { status: 'Pending', updatedAt: new Date().toISOString(), reviewReason: null }); shops[0].applicationVersion++; shops[0].approvalStatus = 'Pending';
          } else {
            await command('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/jpeg' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }, { name: 'Access-Control-Allow-Methods', value: 'GET, PUT, OPTIONS' }], body: photoBytes.toString('base64') }); return;
          }
        }
        if (shopRequirementsTest && request.method === 'PUT' && endpoint.includes('/documents/') && endpoint.endsWith('/review')) {
          const body = JSON.parse(request.postData), type = endpoint.split('/').at(-2), doc = shopDocumentFixture.find(doc => doc.type === type);
          assert.equal(user.isAdmin, true); assert.equal(body.expectedUpdatedAt, doc.updatedAt);
          Object.assign(doc, { status: body.status, reviewReason: body.reason, updatedAt: new Date().toISOString() }); shops[0].applicationVersion++;
          if (body.status === 'Rejected') { shops[0].approvalStatus = 'Rejected'; shops[0].reviewReason = body.reason; }
        }
        if (trackingTest && request.method === 'PUT' && endpoint === '/api/delivery/location') {
          const body = JSON.parse(request.postData); gpsWrites.push(body);
          if (body.sharing) { gpsSession = body.sessionId; gpsLocation = { latitude: body.latitude, longitude: body.longitude, accuracy: body.accuracy, capturedAt: new Date(body.capturedAt).toISOString(), receivedAt: new Date().toISOString() }; }
          else if (gpsSession === body.sessionId) { gpsLocation = null; gpsSession = null; }
          await command('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify({ success: true, data: { sharedJobs: body.sharing ? 1 : 0, receivedAt: new Date().toISOString() } })).toString('base64') });
          return;
        }
        if (endpoint === '/api/delivery/orders/42/tracking') {
          const data = { state: trackingPhase === 'Completed' ? 'finished' : !trackingTest ? 'waiting' : !gpsLocation ? 'paused' : Date.now() - Date.parse(gpsLocation.capturedAt) > 45000 ? 'stale' : 'sharing', rider: trackingTest && trackingPhase !== 'Completed' ? { name: 'Test Tracking Rider', stage: 'Pickup' } : null, location: trackingTest && trackingPhase !== 'Completed' ? gpsLocation : null, customer: { latitude: 13.62, longitude: 123.19 }, shop: { latitude: 13.63, longitude: 123.20 }, destination: 'customer', staleAfterMs: 45000, serverTime: new Date().toISOString() };
          await command('Fetch.fulfillRequest', { requestId, responseCode: trackingReadFailure ? 503 : 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }, { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' }], body: Buffer.from(JSON.stringify(trackingReadFailure ? { success: false, error: { message: 'Test tracking connection lost' } } : { success: true, data })).toString('base64') });
          return;
        }
        if (bookingTest && request.method === 'PUT' && endpoint === '/api/delivery/orders/42/action') {
          const body = JSON.parse(request.postData); assert.equal(body.action, 'confirmBooking'); assert.equal(body.note, 'ok');
          assert.equal(body.expectedVersion, bookingVersion); bookingWrites.push(body);
          if (bookingConflict) {
            bookingConflict = false; bookingVersion++;
            await command('Fetch.fulfillRequest', { requestId, responseCode: 409, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify({ success: false, error: { message: 'Order changed. Refresh and try again.' } })).toString('base64') });
            return;
          }
          bookingState = 'PickupQueued'; bookingVersion++;
        }
        if (pullTest && request.method === 'PUT' && endpoint === '/api/delivery/availability') boardOnline = JSON.parse(request.postData).online;
        if (pullTest && request.method === 'PUT' && endpoint.endsWith('/claim')) {
          const body = JSON.parse(request.postData), job = publicBoardJobs.find(job => job.id === Number(endpoint.split('/').at(-2)));
          publicClaimWrites.push(body); assert.equal(body.stage, job.stage); assert.equal(body.expectedVersion, job.workflowVersion);
          job.claimed = true;
          if (claimConflict) {
            await command('Fetch.fulfillRequest', { requestId, responseCode: 409, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify({ success: false, error: { message: 'This job was claimed or changed. Refresh Available Jobs and choose another job.' } })).toString('base64') });
            return;
          }
          boardWorkload++;
          pullAssignedJobs.push({ ...deliveryJobs[0], id: 100 + job.id, transactionId: job.id, status: 'Accepted', stage: job.stage, order: { ...deliveryJobs[0].order, id: job.id, version: job.workflowVersion + 1, status: `${job.stage}Accepted`, customer: { name: 'Private Claimed Customer', address: '123 Private Customer Street, Naga', phone: '09123456789' } } });
        }
        if (responseTest && request.method === 'PUT' && endpoint === '/api/delivery/assignments/1/respond') {
          assignmentResponses.push(JSON.parse(request.postData));
          await pause(300);
          deliveryJobs[0].status = expireAssignmentResponse ? 'Expired' : 'Accepted';
          deliveryJobs[0].order.status = expireAssignmentResponse ? 'PickupQueued' : 'PickupAccepted';
          if (expireAssignmentResponse) {
            await command('Fetch.fulfillRequest', { requestId, responseCode: 409, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify({ success: false, error: { code: 'WORKFLOW_CONFLICT', message: 'This offer expired. Ask the administrator to send a new assignment.' } })).toString('base64') });
            return;
          }
        }
        if (weightTest && endpoint.startsWith('/api/delivery/orders/42/weight-evidence/')) {
          if (request.method === 'GET') assert.ok(request.headers.Authorization || request.headers.authorization, 'Scale photos require authentication');
          const status = weightPhotoFailure ? 503 : 200;
          await command('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'image/jpeg' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization' }, { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' }, { name: 'Cache-Control', value: 'private, no-store' }], body: status === 200 ? photoBytes.toString('base64') : '' });
          return;
        }
        if (weightTest && request.method === 'PUT' && endpoint === '/api/delivery/orders/42/weight') {
          const body = JSON.parse(request.postData);
          assert.ok(body.imageBase64.length > 10); assert.ok(body.note.length >= 5);
          assert.equal(body.expectedVersion, 8 + weightWrites.length);
          weightWrites.push(body);
          orders[0].kiloAmount = body.kilos;
          weightRecords.unshift({ id: weightWrites.length, kilos: body.kilos, totalAmount: 245, note: body.note, createdAt: new Date().toISOString(), actor: { name: 'Test Laundry Partner' } });
        }
        if (deliveryTest && handoffFixture && request.method === 'PUT' && endpoint === '/api/delivery/orders/42/action') {
          const body = JSON.parse(request.postData);
          assert.equal(body.expectedVersion, deliveryJobs[0].order.version);
          if (body.action === 'arriveHandoff') handoffFixture.arrived = true;
          else if (body.action === 'releaseHandoff') { assert.ok(handoffFixture.arrived); handoffFixture.released = true; }
          else if (body.action === 'receiveHandoff') { assert.ok(handoffFixture.released); deliveryJobs[0].order.status = 'LaundryPickedUp'; delete deliveryJobs[0].order.handoff; }
          else assert.fail('Unexpected handover action');
          deliveryJobs[0].order.version++;
        }
        if (dispatchTest && request.method === 'PUT' && endpoint.endsWith('/assign')) {
          const body = JSON.parse(request.postData), order = dispatchOrders.find(item => item.id === Number(endpoint.split('/').at(-2)));
          assert.equal(body.expectedVersion, 3); dispatchWrites.push(body);
          order.workflowStatus = `${body.stage}Assigned`; order.assignments = [{ id: 1, riderId: body.riderId, stage: body.stage, status: 'Offered', updatedAt: new Date().toISOString(), rider: { name: 'Rider near customer' } }];
        }
        if (riderApplicationTest && /\/api\/delivery\/applications\/\d+\/documents\/[^/]+$/.test(endpoint)) {
          await command('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/jpeg' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization' }, { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' }, { name: 'Cache-Control', value: 'private, no-store' }], body: photoBytes.toString('base64') });
          return;
        }
        if (riderApplicationTest && endpoint === '/api/delivery/application/submit') { user.riderApplicationStatus = 'Pending'; requirementFixture.applicationStatus = 'Pending'; }
        if (riderApplicationTest && request.method === 'PUT' && endpoint.endsWith('/review') && endpoint.includes('/documents/')) {
          const type = endpoint.split('/').at(-2), input = JSON.parse(request.postData);
          const document = requirementFixture.documents.find(doc => doc.type === type);
          assert.ok(document); document.status = input.status; document.updatedAt = new Date().toISOString();
        }
        if (servicesTest && request.method === 'POST' && endpoint === '/api/shops/101/kilo-prices') {
          const body = JSON.parse(request.postData); priceRangeWrites.push(body); shops[0].kiloPrices.push({ id: 1, ...body });
        }
        if (servicesTest && ['POST','PUT'].includes(request.method) && /^\/api\/shops\/101\/services(?:\/\d+)?$/.test(endpoint) && mode !== 'error') {
          const body = JSON.parse(request.postData);
          serviceWrites.push({ method: request.method, body });
          if (request.method === 'POST') shops[0].services.push({ id: 3, ...body });
          else Object.assign(shops[0].services.find(service => service.id === Number(endpoint.split('/').at(-1))), body);
        }
        if (dialogTest && request.method === 'DELETE') {
          dialogWrites.push(endpoint);
          if (!failServiceDelete) shops[0].services = shops[0].services.filter(service=>service.id!==1);
          await command('Fetch.fulfillRequest',{requestId,responseCode:failServiceDelete?503:200,
            responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'Content-Type, Authorization'},{name:'Access-Control-Allow-Methods',value:'GET, PUT, DELETE, OPTIONS'}],
            body:Buffer.from(JSON.stringify(failServiceDelete?{success:false,error:{message:'Unable to delete this service. Try again.'}}:{success:true,data:{id:1}})).toString('base64')});
          return;
        }
        if (photoTest && photoEndpoint && request.method !== 'OPTIONS') {
          if (request.method === 'PUT' && mode !== 'error') {
            const input = JSON.parse(request.postData);
            assert.ok(input.imageBase64 && Buffer.from(input.imageBase64,'base64').length > 0);
            hasPhoto = true;
            shops[0].photoUrl = `/api/shops/101/photo?v=${Date.now()}`;
          }
          if (request.method === 'DELETE') { hasPhoto = false; shops[0].photoUrl = null; }
          const binary = request.method === 'GET';
          const status = mode === 'error' ? 503 : binary && (!hasPhoto || brokenPhoto) ? 404 : 200;
          await command('Fetch.fulfillRequest',{ requestId, responseCode: status,
            responseHeaders: [{name:'Content-Type',value:binary?'image/jpeg':'application/json'}, {name:'Access-Control-Allow-Origin',value:'*'}, {name:'Access-Control-Allow-Headers',value:'Content-Type, Authorization'}, {name:'Access-Control-Allow-Methods',value:'GET, PUT, DELETE, OPTIONS'}],
            body: binary ? status === 200 ? photoBytes.toString('base64') : '' : Buffer.from(JSON.stringify(status===503?{success:false,error:{message:'Test photo upload failed'}}:{success:true,data:{photoUrl:shops[0].photoUrl}})).toString('base64') });
          return;
        }
        if ((approvalTest || shopRequirementsTest) && request.method === 'PUT' && ['/api/admin/shops/101/review', '/api/shops/101/application'].includes(endpoint)) {
          const body = JSON.parse(request.postData);
          if (endpoint.includes('/review')) {
            assert.equal(body.expectedStatus, shops[0].approvalStatus); assert.equal(body.expectedVersion, shops[0].applicationVersion);
            shops[0].approvalStatus = body.status; shops[0].reviewReason = body.reason; shops[0].reviewedAt = new Date().toISOString();
            reviews.push(body);
          } else { Object.assign(shops[0], body, { approvalStatus: 'Pending', reviewReason: null, applicationVersion: shops[0].applicationVersion + 1 }); }
        }
        const dispatchDelivery = endpoint.includes('/orders/43/');
        const dispatchOptions = { stage: dispatchDelivery ? 'Delivery' : 'Pickup', workflowVersion: 3, origin: { source: dispatchDelivery ? 'shop' : 'customer', name: dispatchDelivery ? 'Laundry Partner' : 'Test Customer', address: 'Naga, Camarines Sur', coordinatesAvailable: !missingDispatchOrigin }, riders: dispatchDelivery ? [{ userId: 22, name: 'Rider near shop', workload: 0, distance: missingDispatchOrigin ? null : 0.2 }, { userId: 21, name: 'Rider near customer', workload: 2, distance: missingDispatchOrigin ? null : 4 }] : [{ userId: 21, name: 'Rider near customer', workload: 2, distance: 0.5 }, { userId: 22, name: 'Rider near shop', workload: 0, distance: 4 }, { userId: 23, name: 'Rider without position', workload: 0, distance: null }] };
        const data = endpoint === '/api/delivery/available-jobs' ? { rider: { online: boardOnline, workload: boardWorkload, capacity: 3, hasPosition: boardHasPosition }, limit: 100, jobs: boardOnline ? publicBoardJobs.filter(job => !job.claimed).map(job=>boardHasPosition?job:{...job,distanceKm:null}) : [] }
          : pullTest && endpoint === '/api/delivery/rider' ? { rider: { online: boardOnline }, jobs: pullAssignedJobs }
          : dispatchTest && endpoint.endsWith('/rider-options') ? dispatchOptions
          : processingTimerTest && /^\/api\/delivery\/orders\/(42|43)$/.test(endpoint) ? { ...orders.find(order => String(order.id) === endpoint.split('/').pop()), assignments: [], events: [] }
          : orderStepsTest && endpoint === '/api/delivery/orders/42' ? { ...orders[0], collectionCode: user.isShopOwner ? '234567' : undefined, pickupCode: user.isShopOwner ? undefined : '123456', deliveryCode: user.isShopOwner ? undefined : '345678' }
          : dispatchTest && endpoint === '/api/delivery/operations' ? { orders: dispatchOrders, riders: [] }
          : riderApplicationTest && (endpoint === '/api/delivery/application' || endpoint === '/api/delivery/applications/12') ? requirementFixture
          : deliveryTest && endpoint === '/api/delivery/orders/42' ? { ...orders[0], weightEvidence: weightRecords, handoff: handoffFixture, workflowStatus: trackingTest ? trackingPhase : bookingTest ? bookingState : handoffFixture ? deliveryJobs[0].order.status : 'Folding', workflowVersion: bookingTest ? bookingVersion : handoffFixture ? deliveryJobs[0].order.version : 8 + weightWrites.length, pickupCode: user.isShopOwner ? undefined : '123456', deliveryCode: user.isShopOwner ? undefined : '345678', collectionCode: user.isShopOwner ? '234567' : undefined, assignments: [{ ...deliveryJobs[0], rider: { name: 'Assigned Rider' } }], events: [{ id: 1, action: 'fold', toStatus: 'Folding', createdAt: new Date().toISOString(), actor: { name: 'Laundry Partner' }, detail: 'Laundry is being folded.' }] }
          : (deliveryTest || riderApplicationTest || notificationsTest) && endpoint === '/api/delivery/rider' ? { rider: { online: true }, jobs: deliveryJobs }
          : riderApplicationTest && endpoint === '/api/delivery/operations' ? { orders: [], riders: [
            { userId: 12, applicationStatus: 'Pending', active: false, online: false, workload: 0, user: { name: 'Applicant Rider', email: 'rider@example.test', phone: '09123456789' } },
            { userId: 13, applicationStatus: 'Draft', active: false, online: false, canEnable: false, workload: 0, user: { name: 'Draft Rider', email: 'draft@example.test' } },
            { userId: 14, applicationStatus: 'Disabled', active: false, online: false, canEnable: false, workload: 0, user: { name: 'Incomplete Rider', email: 'incomplete@example.test' } },
          ] }
          : deliveryTest && endpoint === '/api/delivery/operations' ? { orders: [], riders: [{ userId: 7, active: true, online: true, workload: 2, user }] }
          : ['/api/auth/login','/api/auth/verify-token'].includes(endpoint) ? { user, token: 'isolated-ui-test' } : endpoint.startsWith('/api/users/') ? user : endpoint === '/api/admin/shops' ? shops.map(shop => ({ ...shop, user, reviewedBy: user }))
          : endpoint === '/api/shops' ? mode==='empty'?[]:shops.filter(shop => shop.approvalStatus === 'Approved') : endpoint.endsWith('/analytics') ? (() => {
            const params = new URL(request.url).searchParams;
            analyticsRequests.push({ start: params.get('start'), end: params.get('end') });
            const range = analyticsRange(params.get('start'), params.get('end'));
            const series = analyticsSeries(range, mode === 'empty' ? [] : [{ local: range.start + 'T09', count: 4 }, { local: range.end + 'T14', count: 8 }],
              mode === 'empty' ? [] : [{ local: range.start + 'T10', count: 1, value: 215, kilos: 8 }, { local: range.end + 'T15', count: 2, value: 430, kilos: 16 }]);
            const summary = series.reduce((sum, p) => ({ orders: sum.orders + p.orders, completedOrders: sum.completedOrders + p.completedOrders, completedValue: sum.completedValue + p.completedValue, kilos: sum.kilos + p.kilos }), { orders: 0, completedOrders: 0, completedValue: 0, kilos: 0 });
            return { range: { start: range.start, end: range.end, granularity: range.granularity, timeZone: 'Asia/Manila' }, summary, series,
              popularServices: mode === 'empty' ? [] : [{ name: 'Full Service', orders: 2, kilos: 16, value: 430 }, { name: 'Wash Only', orders: 1, kilos: 8, value: 215 }],
              workload: mode === 'empty' ? { pending: 0, queued: 0, ready: 0 } : { pending: 3, queued: 2, ready: 1 }, undatedCompletedOrders: mode === 'empty' ? 0 : 2 };
          })() : endpoint.startsWith('/api/shops/') ? shops[0] : endpoint.startsWith('/api/transactions/') ? mode==='empty'?[]:orders : [];
        await command('Fetch.fulfillRequest',{ requestId, responseCode: mode==='error'?503:200,
          responseHeaders: [{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'Content-Type, Authorization'}, {name:'Access-Control-Allow-Methods',value:'GET, PUT, DELETE, OPTIONS'}],
          body: Buffer.from(JSON.stringify(mode==='error'?{success:false,error:{message:'Test service unavailable'}}:{success:true,data})).toString('base64') });
      } catch(error) { if(!closing && !/Invalid InterceptionId|Target closed|Fetch domain is not enabled/.test(error.message)) console.error(error.message); }
    }
  });
  await command('Page.enable'); await command('Runtime.enable');
  await command('Fetch.enable',{ patterns:[{urlPattern:'*/api/*'}, ...(trackingTest || pullTest ? [{urlPattern:'*unpkg.com/leaflet*'}] : []), ...(pullTest?[{urlPattern:'https://api.mapbox.com/directions/*'}]:[])] });
  if (callTest) await command('Page.addScriptToEvaluateOnNewDocument', { source: `window.copiedPhoneNumbers=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async number=>{window.copiedPhoneNumbers.push(number)}}});` });
  if (scheduleTest) {
    for (const width of [320,390,768,1440]) {
      await visit('/order/101', width, 'Review Order');
      await evaluate(`document.querySelector('[role="checkbox"]').click()`);
      await clickText('Review Order');
      await waitFor('document.body.innerText.includes("Place Order")');
      assert.ok(await evaluate('document.body.innerText.includes("Turnaround & Updates")'));
      await evaluate(`document.querySelector('[aria-label="Laundry transport"]').click()`);
      await evaluate(`document.querySelector('[aria-label="Pickup & delivery"]').click()`);
      const openAddresses = async () => {
        await evaluate(`Array.from(document.querySelectorAll('[role="button"]')).find(e=>e.innerText.trim().startsWith('Customer address')).click()`);
        await waitFor(`!!document.querySelector('[role="radiogroup"][aria-label="Saved addresses"]')`);
      };
      await openAddresses();
      assert.equal(await evaluate(`document.querySelector('[role="radiogroup"][aria-label="Saved addresses"]').parentElement.querySelectorAll('input,textarea').length`), 0, 'Checkout address selector has no address inputs');
      await waitFor(`!!document.querySelector('[aria-label="Saved address 1"]')`);
      if (width === 390) {
        const shot = await command('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(artifacts, 'checkout-address-selector-390.png'), Buffer.from(shot.data, 'base64'));
      }
      await evaluate(`document.querySelector('[aria-label="Saved address 1"]').click()`);
      await waitFor(`!document.querySelector('[role="radiogroup"][aria-label="Saved addresses"]')`);
      assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('labaride-draft:user:7')).state.address.address_line_1`), '88 Saved Address Street');
      await openAddresses();
      await evaluate(`document.querySelector('[aria-label="Primary address"]').click()`);
      await waitFor(`!document.querySelector('[role="radiogroup"][aria-label="Saved addresses"]')`);
      assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('labaride-draft:user:7')).state.address`), null);
      const openSchedule = async () => {
        await evaluate(`Array.from(document.querySelectorAll('[role="button"]')).find(e=>e.innerText.trim().startsWith('Requested laundry pickup')).click()`);
        await waitFor('!!document.querySelector("[data-testid=delivery-schedule-footer]")');
      };
      await openSchedule();
      await waitFor('document.activeElement?.getAttribute("aria-label")==="Close pickup request"');
      const bounds = await evaluate(`(()=>{const footer=document.querySelector('[data-testid=delivery-schedule-footer]');const panel=footer.parentElement.getBoundingClientRect();return {left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom,footerTop:footer.getBoundingClientRect().top};})()`);
      assert.ok(bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=(width<768?844:1000),'Schedule fits viewport');
      const horizontalOverflow = await evaluate(`(()=>{const e=document.querySelector('[data-testid=delivery-schedule-body]');return e.scrollWidth>e.clientWidth;})()`);
      assert.equal(horizontalOverflow,false,'Schedule body does not overflow horizontally');
      await evaluate(`document.querySelector('[data-testid=delivery-schedule-body]').scrollTop=99999`);
      await pause(100);
      assert.ok(Math.abs(await evaluate(`document.querySelector('[data-testid=delivery-schedule-footer]').getBoundingClientRect().top`)-bounds.footerTop)<1,'Footer stays fixed while content scrolls');
      await evaluate(`document.querySelector('[data-testid=delivery-schedule-body]').scrollTop=0`);
      await evaluate(`document.querySelector('[aria-label="Tomorrow"]').click()`);
      await evaluate(`document.querySelector('[aria-label="9:00 AM"]').click()`);
      assert.ok((await evaluate(`document.querySelector('[data-testid=delivery-schedule-footer]').innerText`)).includes('Tomorrow at 9:00 AM'));
      await clickText('Choose another date');
      await evaluate(`document.querySelector('[aria-label="2026-10-25"]').click()`);
      assert.equal(await evaluate(`!!document.querySelector('[data-testid=delivery-calendar]')`),false);
      if (width===320||width===390||width===1440) {
        const shot=await command('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(artifacts,`delivery-schedule-${width}.png`),Buffer.from(shot.data,'base64'));
      }
      await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await waitFor('!document.querySelector("[data-testid=delivery-schedule-footer]")');
      await openSchedule();
      await evaluate(`document.querySelector('[aria-label="Tomorrow"]').click()`);
      await evaluate(`document.querySelector('[aria-label="9:00 AM"]').click()`);
      await clickText('Save pickup request');
      await waitFor('!document.querySelector("[data-testid=delivery-schedule-footer]")');
      assert.equal(await evaluate(`JSON.parse(sessionStorage.getItem('labaride-draft:user:7')).state.requestedPickupAt`),'2026-10-23T01:00:00.000Z');
      assert.deepEqual(errors,[],'Schedule has no runtime exceptions');
      console.log('PASS laundry pickup request',width);
    }
    orders[0].status = 'Queued';
    orders[0].receivedAt = '2026-10-22T02:00:00Z';
    await visit('/shop/customers/orders/42', 390, 'Ready time estimate');
    await clickText('Ready time estimate');
    async function fill(label, value) {
      await evaluate(`(()=>{const e=document.querySelector('[aria-label="'+${JSON.stringify(label)}+'"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    }
    await fill('Ready date','2026-10-23');
    await fill('Ready time','14:00');
    await clickText('Send ready estimate');
    await waitFor('document.body.innerText.includes("Update ready estimate")');
    assert.equal(workflowWrites[0].estimatedReadyAt,'2026-10-23T06:00:00.000Z');
    await clickText('Start processing');
    await waitFor('!!document.querySelector("[data-testid=app-dialog]")');
    await clickText('Confirm');
    await waitFor('document.body.innerText.includes("Mark laundry ready")');
    assert.equal(workflowWrites[1].status,'Processing');
    assert.ok(await evaluate('document.body.innerText.includes("Processing started")'));
    await clickText('Mark laundry ready');
    await waitFor('!!document.querySelector("[data-testid=app-dialog]")');
    await clickText('Confirm');
    await waitFor('document.body.innerText.includes("Confirm delivered to customer")');
    assert.equal(workflowWrites[2].status,'Ready');
    await visit('/transaction-details?id=42',390,'Step 4 of 5');
    assert.ok(await evaluate('document.body.innerText.includes("arranging return delivery")'));
    await clickText('Order step 3: Processing');
    assert.ok(await evaluate('document.body.innerText.includes("Estimated ready:")'));
    console.log('PASS shop estimate, processing, ready actions and customer updates');
    fs.writeFileSync(path.join(artifacts,'delivery-schedule-verification.txt'),'Requested laundry pickup verified in Chrome at widths 320, 390, 768 and 1440.\nDate selection, time selection, inline calendar, initial focus, Escape dismissal, fixed footer, viewport bounds, no horizontal overflow and saved checkout state passed. Shop estimate entry, explicit processing start, ready action and customer turnaround details also passed.\nRequests intercepted with isolated fixtures; no live orders created.\n');
    return;
  }
  if (dispatchTest) {
    for (const width of [320,390,1440]) {
      await visit('/admin/operations',width,'Delivery Operations',`delivery-monitoring-${width}`);
      assert.equal(await evaluate('Array.from(document.querySelectorAll("[role=tab]")).find(tab => tab.innerText.trim() === "All").getAttribute("aria-selected")'), 'true', 'Operations opens the full monitoring queue');
      assert.ok((await evaluate('document.body.innerText')).includes('Order monitoring'));
      assert.ok(!(await evaluate('document.body.innerText')).includes('Dispatch & rider management'));
      assert.equal(await evaluate('(()=>{const buttons=Array.from(document.querySelectorAll("[role=button]"));return buttons.findIndex(e=>e.innerText.trim()==="View audit & details")<buttons.findIndex(e=>e.innerText.trim()==="Assign / reassign rider")})()'),true,'Order review precedes manual intervention');
      await clickText('Unassigned');await clickText('Assign / reassign rider');
      await waitFor('document.body.innerText.includes("Customer pickup location")');
      await waitFor('!!document.querySelector("[data-testid=dispatch-rider-option-21]")');
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'Nearest-rider picker fits viewport');
      assert.equal(await evaluate('document.querySelector("[role=radiogroup]").firstElementChild.getAttribute("data-testid")'),'dispatch-rider-option-21');
      assert.ok((await evaluate('document.querySelector("[data-testid=dispatch-rider-option-21]").innerText')).includes('0.5 km away'));
      assert.ok((await evaluate('document.querySelector("[data-testid=dispatch-rider-option-23]").innerText')).includes('Position not provided'));
      assert.equal(await evaluate('Array.from(document.querySelectorAll("[role=button]")).find(button=>button.innerText.trim()==="Send assignment").getAttribute("aria-disabled")'),'true','Assignment requires an explicit rider selection');
      const shot = await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,`dispatch-nearest-${width}.png`),Buffer.from(shot.data,'base64'));
      await clickText('Cancel');
    }
    await clickText('Assign / reassign rider');await waitFor('!!document.querySelector("[data-testid=dispatch-rider-option-21]")');
    await evaluate('document.querySelector("[data-testid=dispatch-rider-option-21]").click()');await pause(150);await clickText('Send assignment');
    await waitFor('!document.body.innerText.includes("Customer pickup location")');
    assert.equal(dispatchWrites[0].riderId,21);assert.equal(dispatchWrites[0].stage,'Pickup');
    await clickText('Assign / reassign rider');await waitFor('document.body.innerText.includes("Laundry shop collection location")');
    assert.equal(await evaluate('document.querySelector("[role=radiogroup]").firstElementChild.getAttribute("data-testid")'),'dispatch-rider-option-22');
    missingDispatchOrigin=true;await clickText('Refresh eligible riders');await waitFor('document.body.innerText.includes("No saved map pin for this location")');
    await clickText('Cancel');
    console.log('PASS nearest-rider selection, pickup/delivery origins, missing positions/pins, explicit manual assignment and responsive layouts');
    return;
  }
  if (riderApplicationTest) {
    user.isAdmin=false;user.isRider=false;user.isShopOwner=false;
    for (const width of [320,390,1440]) await visit('/login',width,'Apply as a Rider',`rider-login-${width}`);
    await clickText('Apply as a Rider');await waitFor('document.body.innerText.includes("Ride with LabaRide")');
    for (const width of [320,390,1440]) await visit('/rider-signup',width,'Create rider account',`rider-signup-${width}`);
    await clickText('Create rider account');await waitFor('document.body.innerText.includes("matching passwords")');
    user.riderApplicationStatus='Draft';
    for (const width of [320,390,1440]) {
      await visit('/rider-application',width,'Your personal details',`rider-personal-${width}`);
      await clickText('Save & continue');await waitFor('document.body.innerText.includes("Professional license number")');
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'Motorcycle form fits viewport');
      const motorcycleShot = await command('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(artifacts,`rider-motorcycle-${width}.png`),Buffer.from(motorcycleShot.data,'base64'));
      await clickText('Save & continue');await waitFor('document.body.innerText.includes("Upload your requirements")');
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'Document checklist fits viewport');
      const documentShot = await command('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(artifacts,`rider-documents-${width}.png`),Buffer.from(documentShot.data,'base64'));
      if (width===390) { await clickText('View private document');await waitFor('Array.from(document.images).some(image => image.src.startsWith("data:image"))'); }
      await clickText('Review application');await waitFor('document.body.innerText.includes("Review before submitting")');
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'Final review fits viewport');
      const finalReview = await evaluate('document.body.innerText');
      assert.ok(finalReview.includes('License valid until') && finalReview.includes('Required documents') && finalReview.includes('Your documents stay private'),'Final review groups labeled details and document status');
      const reviewShot = await command('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(artifacts,`rider-final-review-${width}.png`),Buffer.from(reviewShot.data,'base64'));
    }
    user.riderApplicationStatus='Pending';
    for (const width of [320,390,1440]) await visit('/rider-application',width,'Application submitted',`rider-pending-${width}`);
    await clickText('Check application status');
    await waitFor('document.body.innerText.includes("Status checked: still waiting for admin review.")');
    assert.ok((await evaluate('document.body.innerText')).includes('Last checked at'),'Manual status refresh confirms completion with a timestamp');
    user.isRider=true;user.riderApplicationStatus='Approved';
    await clickText('Check application status');await waitFor('location.pathname === "/rider"');
    user.isAdmin=true;user.isRider=false;delete user.riderApplicationStatus;
    for (const width of [390,1440]) await visit('/admin/operations',width,'Applicant Rider',`rider-review-${width}`);
    assert.equal(await evaluate('document.querySelector("[data-testid=rider-application-13]").innerText.includes("Draft")'),true,'Draft rider belongs to applications');
    assert.equal(await evaluate('Array.from(document.querySelector("[data-testid=rider-roster-14]").querySelectorAll("[role=button]")).some(button => button.innerText.trim() === "Enable")'),false,'Unverified disabled rider cannot be enabled');
    await clickText('Review application');await waitFor('document.body.innerText.includes("Approve rider")');
    await waitFor('document.body.innerText.includes("License valid until")');
    await waitFor('!!document.querySelector("[data-testid=rider-applicant-photo] img")');
    for (const width of [390,1440]) {
      await command('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 844 : 1000, deviceScaleFactor: 1, mobile: false });
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'Applicant review dialog fits viewport');
      const photoBounds = await evaluate('(()=>{const r=document.querySelector("[data-testid=rider-applicant-photo]").getBoundingClientRect();return {width:r.width,height:r.height};})()');
      assert.equal(photoBounds.width, photoBounds.height, 'Header applicant photo stays square');
      assert.ok(photoBounds.width <= 84 && photoBounds.width >= 64, 'Header photo uses a compact responsive size');
      const applicantShot = await command('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(artifacts,`rider-admin-dialog-${width}.png`),Buffer.from(applicantShot.data,'base64'));
    }
    assert.equal(await evaluate('Array.from(document.querySelectorAll("[role=button]")).find(button => button.innerText.trim() === "Approve rider").getAttribute("aria-disabled")'), 'true', 'Approval stays disabled until required documents are verified');
    requirementFixture.applicationStatus='Pending';
    await clickText('Refresh application status');
    await waitFor('document.body.innerText.includes("Submitted · ready for document review")');
    assert.equal(await evaluate('Array.from(document.querySelectorAll("[role=button]")).find(button => button.innerText.trim() === "Reject application").getAttribute("aria-disabled")'), null, 'Submission unlocks rejection without reopening the dialog');
    assert.equal(await evaluate('Array.from(document.querySelectorAll("[role=button]")).find(button => button.innerText.trim() === "Verify document").getAttribute("aria-disabled")'), null, 'Submission unlocks document verification');
    await clickText('Verify document');
    await waitFor('document.body.innerText.includes("1 of 6 documents verified")');
    assert.equal(await evaluate('Array.from(document.querySelector("[data-testid=rider-document-review-ApplicantPhoto]").querySelectorAll("[role=button]")).some(button => button.innerText.trim() === "Verify document")'), false, 'Verified documents no longer offer verification again');
    assert.ok((await evaluate('document.querySelector("[data-testid=rider-document-review-ApplicantPhoto]").innerText')).includes('Verification saved. No further action needed'));
    requirementFixture.documents.forEach(doc => { doc.status='Verified'; });
    await clickText('Refresh application status');
    await waitFor('document.body.innerText.includes("All required documents are verified. You can approve rider access.")');
    assert.equal(await evaluate('Array.from(document.querySelectorAll("[role=button]")).find(button => button.innerText.trim() === "Approve rider").getAttribute("aria-disabled")'), null, 'Verified requirements unlock final approval');
    await clickText('Cancel');
    console.log('PASS rider application entry, mobile/web registration, validation, pending status, automatic approval redirect and admin review dialog');
    return;
  }
  if (notificationsTest) {
    const cases = [
      { route: '/notifications', audience: 'customer', shopMode: false, widths: [320,390,1440] },
      { route: '/shop/home/shop-notifications', audience: 'partner', shopMode: true, widths: [390] },
      { route: '/rider/notifications', audience: 'rider', shopMode: false, widths: [390] },
      { route: '/admin/notifications', audience: 'admin', shopMode: false, widths: [390,1440] },
    ];
    for (const entry of cases) for (const width of entry.widths) {
      notificationRecords = ['customer','partner','rider','admin'].flatMap((audience,index) => [1,2,3].map(n => ({ id: index*100+n, transactionId:42, userId:7, audience, shopMode: audience==='partner', title:n===2?'Unread status update':'Read status update', message:'Your order status changed.', createdAt:new Date().toISOString(), readAt:n===2?null:new Date().toISOString() })));
      notificationRecords.push({id:999, userId:8, audience:'customer', shopMode:false, readAt:new Date().toISOString()});
      const base=['customer','partner','rider','admin'].indexOf(entry.audience)*100;
      user.isAdmin=entry.audience==='admin'; user.isRider=entry.audience==='rider'; user.isShopOwner=entry.audience==='partner';
      await visit(entry.route,width,'Delete read (2)',`notification-delete-${entry.audience}-${width}`);
      assert.equal(await evaluate(`document.querySelector('[data-testid="notification-${base+2}"]').querySelectorAll('[aria-label="Delete"]').length`),0,'Unread items have no Delete button');
      const currentPath=await evaluate('location.pathname'), before=notificationDeletes.length;
      async function deleteRow(id) { await evaluate(`document.querySelector('[data-testid="notification-${id}"] [aria-label="Delete"]').click()`); await pause(150); }
      await deleteRow(base+1); await clickText('Cancel'); assert.equal(notificationDeletes.length,before);
      await deleteRow(base+1); await clickText('Delete');
      await waitFor(`!document.querySelector('[data-testid="notification-${base+1}"]')`);
      assert.equal(await evaluate('location.pathname'),currentPath,'Deleting does not navigate to an order');
      failNotificationDelete=true; await deleteRow(base+3); await clickText('Delete');
      await waitFor('document.body.innerText.includes("Could not delete this test notification")');
      assert.ok(await evaluate(`!!document.querySelector('[data-testid="notification-${base+3}"]')`));
      failNotificationDelete=false; await clickText('Delete read (1)'); await clickText('Delete');
      await waitFor(`!document.querySelector('[data-testid="notification-${base+3}"]')`);
      assert.ok(await evaluate(`!!document.querySelector('[data-testid="notification-${base+2}"]')`));
      assert.equal(notificationRecords.filter(item=>item.audience!==entry.audience && item.userId===7).length,9,'Other role lists are untouched');
      assert.ok(notificationRecords.some(item=>item.userId===8),'Other users are untouched');
    }
    console.log('PASS read-only notification deletion, cancel, failure recovery, role-scoped bulk deletion, unread protection and mobile/desktop layouts');
    return;
  }
  if (shopRequirementsTest) {
    shops[0].requirementsVersion = 1; shops[0].approvalStatus = 'Pending'; user.isShopOwner = false;
    async function rowClick(type, label) { await evaluate(`(()=>{const row=document.querySelector('[data-testid="shop-document-${type}"]');Array.from(row.querySelectorAll('[role=button]')).find(button=>button.innerText.trim()===${JSON.stringify(label)}).click();})()`); await pause(150); }
    async function uploadShopDocument(type) {
      await rowClick(type, shopDocumentFixture.some(doc => doc.type === type) ? 'Replace document' : 'Upload document');
      await waitFor('!!document.querySelector("input[type=file]")');
      const { root: documentRoot } = await command('DOM.getDocument');
      const { nodeId } = await command('DOM.querySelector', { nodeId: documentRoot.nodeId, selector: 'input[type=file]' });
      await command('DOM.setFileInputFiles', { nodeId, files: [path.join(artifacts, 'upload-test.jpg')] });
      await waitFor(`document.querySelector('[data-testid="shop-document-${type}"]').innerText.includes('Pending review')`);
    }
    await visit('/register-shop',390,'Shop verification documents');
    await evaluate(`Array.from(document.querySelectorAll('[role=radio]')).find(e=>e.innerText.trim()==='SEC').click()`);
    for (const type of ['SECRegistration', 'TinProof', 'MayorsPermit']) await uploadShopDocument(type);
    for (const width of [320,390,1440]) await visit('/register-shop',width,'Documents uploaded. Waiting for admin verification.',`shop-documents-owner-${width}`);
    user.isAdmin = true;
    for (const width of [320,390,1440]) {
      await visit('/admin',width,'Approve Shop'); await clickText('Approve Shop');
      await waitFor('document.body.innerText.includes("Shop verification documents")');
      assert.equal(await evaluate('Array.from(document.querySelector("[aria-modal=true]").querySelectorAll("[role=button]")).find(e=>e.innerText.trim()==="Approve Shop").getAttribute("aria-disabled")'),'true');
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
      const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,`shop-documents-admin-${width}.png`),Buffer.from(shot.data,'base64'));
      await clickText('Cancel');
    }
    await clickText('Approve Shop');
    await rowClick('TinProof','Needs correction');
    await evaluate(`(()=>{const e=document.querySelector('[aria-label="Document correction reason"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Please upload a clearer tax document.');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await rowClick('TinProof','Send correction request');
    await waitFor('document.body.innerText.includes("Correction request sent to the shop owner")');
    await clickText('Cancel');
    user.isAdmin = false;
    await visit('/register-shop',390,'Needs correction'); await uploadShopDocument('TinProof');
    user.isAdmin = true;
    await visit('/admin',390,'Approve Shop'); await clickText('Approve Shop');
    for (const type of ['SECRegistration','TinProof','MayorsPermit']) {
      await rowClick(type,'View private document');
      await waitFor(`!!document.querySelector('[data-testid="shop-document-${type}"] img')`);
      await rowClick(type,'Verify document');
      await waitFor(`document.querySelector('[data-testid="shop-document-${type}"]').innerText.includes('Verified')`);
    }
    await waitFor('document.body.innerText.includes("Required documents verified. The admin can approve shop access")');
    await clickText('Approve Shop');
    await waitFor('!document.body.innerText.includes("Shop verification documents")');
    assert.equal(shops[0].approvalStatus,'Approved'); assert.ok(reviews.at(-1).expectedVersion > 1);
    console.log('PASS shop owner uploads, SEC alternative, private previews, required admin verification, correction/replacement, final approval and 320/390/1440 layouts');
    return;
  }
  if (callTest) {
    deliveryJobs[1].order.shop.phone = '09987654321';
    for (const width of [320, 390, 1440]) {
      await visit('/rider/jobs', width, 'Rider dashboard');
      await clickText('Call');
      await waitFor('document.body.innerText.includes("Call contact")');
      assert.equal(await evaluate(`document.querySelector('[aria-label="Contact phone number"]').textContent`), '09987654321');
      assert.ok((await evaluate('document.body.innerText')).includes('Calling requires a phone app configured'));
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
      const shot = await command('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(artifacts, `call-contact-${width}.png`), Buffer.from(shot.data, 'base64'));
      await clickText('Copy number'); await waitFor('document.body.innerText.includes("Phone number copied.")');
      assert.equal(await evaluate('window.copiedPhoneNumbers.at(-1)'), '09987654321');
      await clickText('Close contact');
      await evaluate(`Array.from(document.querySelectorAll('[role=button]')).filter(e=>e.innerText.trim()==='Call')[1].click()`);
      await waitFor('document.body.innerText.includes("Call contact")');
      assert.equal(await evaluate(`document.querySelector('[aria-label="Contact phone number"]').textContent`), '09123456789');
      await clickText('Copy number'); assert.equal(await evaluate('window.copiedPhoneNumbers.at(-1)'), '09123456789');
      await evaluate(`navigator.clipboard.writeText=async()=>{throw new Error('Clipboard blocked')};document.execCommand=()=>false;`);
      await clickText('Copy number'); await waitFor('document.body.innerText.includes("Select the number above and copy it manually")');
      await clickText('Close contact');
    }
    console.log('PASS customer/shop Call dialog, correct numbers, copy/manual fallback and 320/390/1440 layouts; no real calls or system clipboard writes');
    return;
  }
  if (trackingTest) {
    deliveryJobs[0].status = 'Accepted'; deliveryJobs[0].order.status = 'PickupEnRoute'; deliveryJobs[1].status = 'Completed';
    await command('Browser.grantPermissions', { origin: 'http://127.0.0.1:4178', permissions: ['geolocation'] });
    await command('Emulation.setGeolocationOverride', { latitude: 13.62, longitude: 123.19, accuracy: 10 });
    await visit('/rider/jobs', 390, 'Start sharing location');
    await clickText('Start sharing location');
    await waitFor('document.body.innerText.includes("Sharing your position with active-job customers")');
    assert.ok(gpsWrites.some(body => body.sharing && body.latitude === 13.62));
    await evaluate(`Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));`);
    await waitFor('document.body.innerText.includes("Location sharing is paused")');
    await pause(400); assert.ok(gpsWrites.some(body => body.sharing === false));
    await evaluate(`Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));`);
    await waitFor('document.body.innerText.includes("Sharing your position with active-job customers")');
    await clickText('Stop sharing location'); await waitFor('document.body.innerText.includes("Location sharing is off")');
    await pause(400); assert.equal(gpsLocation, null);
    await command('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'denied', origin: 'http://127.0.0.1:4178' });
    const writesBeforeDenial = gpsWrites.length;
    await clickText('Start sharing location');
    await waitFor('document.body.innerText.includes("Allow location access to share your position")');
    assert.equal(gpsWrites.length, writesBeforeDenial, 'Denied GPS permission does not publish a location');
    user.isRider = false; user.isShopOwner = false; orders[0].workflowStatus = 'PickupEnRoute';
    for (const width of [320, 390, 1440]) {
      gpsLocation = { latitude: 13.62, longitude: 123.19, accuracy: 10, capturedAt: new Date().toISOString(), receivedAt: new Date().toISOString() };
      await visit('/order/tracking/42', width, 'Rider location updating', `rider-tracking-${width}`);
      await waitFor(`!!document.querySelector('iframe[title="Rider location map"]')?.contentWindow?.markers?.rider`);
      assert.equal(await evaluate(`document.querySelector('iframe[title="Rider location map"]').contentWindow.markers.rider.getLatLng().lat`), 13.62);
      gpsLocation = { ...gpsLocation, latitude: 13.625, capturedAt: new Date().toISOString() };
      await clickText('Refresh rider location');
      await waitFor(`document.querySelector('iframe[title="Rider location map"]').contentWindow.markers.rider.getLatLng().lat === 13.625`);
      assert.ok((await evaluate('document.body.innerText')).includes('GPS accuracy: approximately 10 metres'));
    }
    gpsLocation.capturedAt = new Date(Date.now() - 60000).toISOString(); await clickText('Refresh rider location');
    await waitFor('document.body.innerText.includes("Last known rider location")');
    assert.ok((await evaluate('document.body.innerText')).includes('not the rider’s confirmed current location'));
    trackingReadFailure = true; await clickText('Refresh rider location');
    await waitFor('document.body.innerText.includes("Could not refresh rider location")');
    trackingReadFailure = false; gpsLocation = null; await clickText('Retry rider location');
    await waitFor('document.body.innerText.includes("Waiting for a location update")');
    await waitFor(`!document.querySelector('iframe[title="Rider location map"]').contentWindow.markers.rider`);
    trackingPhase = 'Completed'; await clickText('Refresh rider location');
    await waitFor('document.body.innerText.includes("Trip finished")');
    console.log('PASS rider GPS consent/start/stop, foreground pause/resume, customer map movement, accuracy, stale/error/paused/completed states and mobile/desktop layout');
    return;
  }
  if (bookingTest) {
    user.isRider = false; user.isShopOwner = true; orders[0].workflowStatus = 'BookingPending';
    for (const width of [320, 1440]) {
      bookingState = 'BookingPending'; bookingVersion = 0;
      await visit('/shop/customers/orders/42', width, 'Confirm booking');
      const before = bookingWrites.length;
      await clickText('Confirm booking');
      await waitFor('document.body.innerText.includes("Enter an acceptance explanation before confirming")');
      assert.equal(bookingWrites.length, before, 'Blank explanation is blocked locally');
      await evaluate(`(()=>{const e=document.querySelector('[aria-label="Acceptance explanation"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'ok');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await clickText('Confirm booking'); await clickText('Continue');
      await waitFor('document.body.innerText.includes("Pickup Queued") && !document.body.innerText.includes("Confirm booking")');
      assert.equal(bookingWrites.length, before + 1);
      await clickText('Add a note');
      assert.equal(await evaluate(`document.querySelector('[aria-label="Notes / issue details"]').value`), '', 'Successful confirmation clears the explanation');
    }
    bookingState = 'BookingPending'; bookingVersion = 0; bookingConflict = true;
    await visit('/shop/customers/orders/42', 390, 'Confirm booking');
    await evaluate(`(()=>{const e=document.querySelector('[aria-label="Acceptance explanation"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'ok');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await clickText('Confirm booking'); await clickText('Continue');
    await waitFor('document.body.innerText.includes("Order changed. Refresh and try again.")');
    await clickText('Confirm booking'); await clickText('Continue');
    await waitFor('document.body.innerText.includes("Pickup Queued")');
    console.log('PASS short booking explanation, local validation, cleared notes and refreshed conflict retry on mobile/desktop');
    return;
  }
  if (pullTest) {
    const panelRest = '(()=>{const p=document.querySelector("[data-testid=rider-dashboard-panel]");if(!p)return false;const m=new DOMMatrix(getComputedStyle(p).transform);return Math.abs(m.m41)<0.1&&Math.abs(m.m42)<0.1})()';
    const panelClosed = '!document.querySelector("[data-testid=rider-dashboard-panel]")';
    await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    boardOnline=false; boardHasPosition=false;
    await command('Browser.setPermission',{permission:{name:'geolocation'},setting:'denied',origin:'http://127.0.0.1:4178'});
    await visit('/rider',390,'Go online to receive jobs','rider-offline-go-online-phone');
    assert.equal(await evaluate('document.querySelectorAll("[data-testid^=available-job-]").length'),0);
    await clickText('Open rider tools');
    await waitFor(panelRest);
    await clickText('Update dispatch position');
    await waitFor('document.body.innerText.includes("Location access is off")');
    assert.equal(boardOnline,false,'Location permission never changes availability');
    await clickText('Close Rider tools');
    await waitFor(panelClosed);
    await clickText('Go online');
    await waitFor('document.body.innerText.includes("You are online")&&!!document.querySelector("[data-testid=available-job-42]")');
    assert.equal(boardHasPosition,false);
    assert.ok(await evaluate('document.body.innerText.includes("Distance unavailable")'),'Jobs appear without location permission or a position');
    boardHasPosition=true;
    for (const width of [320, 390, 768, 1440]) {
      await visit('/rider', width, '2 jobs', `pull-job-board-${width}`);
      const text = await evaluate('document.body.innerText');
      assert.ok(!text.includes('Private Claimed Customer') && !text.includes('123 Private Customer Street'));
      await clickText('Pickup');
      assert.equal(await evaluate('!!document.querySelector("[data-testid=available-job-43]")'),false);
      await clickText('All'); await clickText('Filter and sort jobs');
      await waitFor('!!document.querySelector("[data-testid=rider-dashboard-panel]")');
      await waitFor(panelRest);
      const bounds=await evaluate('(()=>{const r=document.querySelector("[data-testid=rider-dashboard-panel]").getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})()');
      assert.ok(bounds.left>=-1&&bounds.right<=width+1&&bounds.top>=-1&&bounds.bottom<=(width<768?845:1001),'Filter panel fits viewport: '+JSON.stringify(bounds));
      await clickText('Nearest first');
      if(width===390) {
        await pause(250);
        const shot=await command('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(artifacts,'rider-filters-sheet-phone.png'),Buffer.from(shot.data,'base64'));
      }
      await clickText('Show 2 jobs');
      assert.equal(await evaluate('document.querySelector("[data-testid^=available-job-]").getAttribute("data-testid")'), 'available-job-42');
      assert.ok(await evaluate('document.querySelector("[data-testid=available-job-42]").getBoundingClientRect().height<260'),'Dashboard job cards are compact');
      if(width===390) {
        const motion=await evaluate(`new Promise((resolve,reject)=>{let first=null;const until=performance.now()+2000;document.querySelector('[aria-label="View pickup job #42"]').click();function sample(){const p=document.querySelector('[data-testid=rider-dashboard-panel]');if(p){const y=new DOMMatrix(getComputedStyle(p).transform).m42;if(y>1&&first===null)first=y;if(first!==null&&Math.abs(y)<0.1){resolve({first,last:y});return;}}if(performance.now()>until){reject(new Error('Sheet did not slide up'));return;}requestAnimationFrame(sample);}requestAnimationFrame(sample);})`);
        assert.ok(motion.first>motion.last,'Mobile sheet translates upward into place');
      } else await clickText('View pickup job #42');
      await waitFor('!!document.querySelector("[data-testid=rider-dashboard-panel]")');
      await waitFor(panelRest);
      await waitFor('!!document.querySelector("[data-testid=job-route-summary]")');
      await waitFor(`document.querySelector('iframe[title="Job route map"]')?.contentWindow.line!==null&&document.querySelector('iframe[title="Job route map"]')?.contentWindow.latest?.coordinates.length===3`);
      assert.ok(await evaluate('document.querySelector("[data-testid=rider-dashboard-panel]").innerText.includes("Customer → laundry shop")'));
      assert.ok(await evaluate('document.querySelector("[data-testid=rider-dashboard-panel]").innerText.includes("Booked")'),'Details retain booking information');
      assert.ok(await evaluate(`!!document.querySelector('[data-testid=rider-panel-footer] [aria-label="Claim pickup job #42 from details"]')`));
      await pause(250);
      const detailShot=await command('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(artifacts,`rider-job-details-${width}.png`),Buffer.from(detailShot.data,'base64'));
      await clickText('Close Pickup · Order #42');
      await waitFor(panelClosed);
      if(width===390) {
        await clickText('Filter and sort jobs');
        await waitFor('document.activeElement?.getAttribute("aria-label")==="Close Filter jobs"');
        await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        await waitFor('!document.querySelector("[data-testid=rider-dashboard-panel]")');
      }
    }
    await clickText('Open rider tools');
    await waitFor(panelRest);
    const drawer=await evaluate('(()=>{const r=document.querySelector("[data-testid=rider-dashboard-panel]").getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height}})()');
    assert.equal(drawer.right,1440); assert.equal(drawer.width,400); assert.equal(drawer.height,1000);
    await pause(250);
    const drawerShot=await command('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(artifacts,'rider-tools-drawer-desktop.png'),Buffer.from(drawerShot.data,'base64'));
    await clickText('Sign Out'); await waitFor('!!document.querySelector("[data-testid=app-dialog]")'); await clickText('Cancel');
    await waitFor('!document.querySelector("[data-testid=app-dialog]")');
    missingRoutePin=true;
    const beforeMissing=roadRouteRequests.length;
    await clickText('View pickup job #42'); await waitFor('document.body.innerText.includes("Route unavailable:")');
    assert.equal(roadRouteRequests.length,beforeMissing,'Missing pins do not invent a road route');
    await clickText('Close Pickup · Order #42'); await waitFor(panelClosed);
    missingRoutePin=false; roadRouteFailure=true;
    await clickText('View pickup job #42'); await waitFor('document.body.innerText.includes("Only saved pins are shown")');
    await waitFor(`document.querySelector('iframe[title="Job route map"]')?.contentWindow.latest?.coordinates.length===0`);
    roadRouteFailure=false; await clickText('Retry road route'); await waitFor('!!document.querySelector("[data-testid=job-route-summary]")');
    await clickText('Close Pickup · Order #42'); await waitFor(panelClosed);
    assert.deepEqual(roadRouteRequests[0],[[123.19,13.62],[123.2,13.63]],'Pickup road route runs customer to shop');
    await clickText('Claim pickup job #42'); await clickText('Cancel'); assert.equal(publicClaimWrites.length, 0);
    await clickText('View pickup job #42'); await clickText('Claim pickup job #42 from details'); await clickText('Claim job');
    await waitFor('location.pathname === "/rider/jobs" && document.body.innerText.includes("Start pickup trip")');
    assert.equal(publicClaimWrites.length, 1);
    assert.ok((await evaluate('document.body.innerText')).includes('Private Claimed Customer'));
    assert.ok(!(await evaluate('document.body.innerText')).includes('Accept job'), 'Claimed jobs do not require a second acceptance');
    claimConflict = true;
    await visit('/rider', 390, '1 job');
    await clickText('View delivery job #43'); await waitFor('!!document.querySelector("[data-testid=job-route-summary]")');
    assert.ok(await evaluate('document.querySelector("[data-testid=rider-dashboard-panel]").innerText.includes("Laundry shop → customer")'));
    assert.deepEqual(roadRouteRequests.at(-1),[[123.2,13.63],[123.21,13.64]],'Delivery road route runs shop to return address');
    await clickText('Close Delivery · Order #43'); await waitFor(panelClosed);
    await clickText('Claim delivery job #43'); await clickText('Claim job');
    await waitFor('document.body.innerText.includes("This job was claimed or changed") && !document.querySelector("[data-testid=available-job-43]")');
    publicBoardJobs.forEach(job => { job.claimed = false; }); boardWorkload = 3;
    await visit('/rider', 320, 'Your job slots are full');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Claim pickup job #42"]').getAttribute('aria-disabled')`), 'true');
    boardOnline = false;
    await visit('/rider', 390, 'You are offline');
    assert.equal(await evaluate('!!document.querySelector("[data-testid^=available-job-]")'),false);
    await clickText('Go online');
    await waitFor('document.body.innerText.includes("You are online")');
    assert.equal(boardOnline, true);
    await clickText('Go offline');
    await waitFor('document.body.innerText.includes("Go online to receive jobs")&&!document.querySelector("[data-testid^=available-job-]")');
    assert.equal(boardOnline,false);
    await clickText('Go online');
    await waitFor('document.body.innerText.includes("You are online")');
    publicBoardJobs.forEach(job => { job.claimed = true; }); boardWorkload = 0;
    await visit('/rider', 390, 'No available jobs right now');
    console.log('PASS pull board mobile/desktop privacy, filters, sorting, cancel, immediate claim, conflict refresh, capacity, online toggle and empty state');
    return;
  }
  if (responseTest) {
    await visit('/rider/jobs', 390, 'Accept job');
    await clickText('Accept job');
    await evaluate(`(()=>{const e=Array.from(document.querySelectorAll('[role=button]')).find(e=>e.innerText.trim()==='Confirm');e.click();e.click();})()`);
    await waitFor('document.body.innerText.includes("Start pickup trip") && !document.body.innerText.includes("Accept assignment")');
    assert.equal(assignmentResponses.length, 1, 'Repeated Confirm clicks send one response');
    deliveryJobs[0].status = 'Offered'; deliveryJobs[0].order.status = 'PickupAssigned';
    expireAssignmentResponse = true;
    await visit('/rider/jobs', 1440, 'Accept job');
    await clickText('Accept job'); await clickText('Confirm');
    await waitFor('document.body.innerText.includes("This offer expired") && !document.body.innerText.includes("Accept assignment")');
    assert.equal(assignmentResponses.length, 2);
    assert.ok(!(await evaluate('document.body.innerText')).includes('Accept job'), 'Outdated offer is removed after a conflict');
    console.log('PASS assignment double-submit protection, conflict feedback, automatic refresh and closing stale offer dialogs');
    return;
  }
  if (weightTest) {
    user.isRider = false; user.isShopOwner = true;
    orders[0].workflowStatus = 'Folding';
    for (const width of [320, 390, 1440]) {
      await visit('/shop/customers/orders/42', width, 'Update weight & scale photo', `scale-photo-form-${width}`);
      await clickText('Update weight & scale photo');
      await clickText('Save weight, photo & final price');
      await waitFor('document.body.innerText.includes("Add a scale photo before updating")');
      const before = weightWrites.length;
      await clickText('Choose scale photo');
      await waitFor('!!document.querySelector("input[type=file]")');
      const { root: documentRoot } = await command('DOM.getDocument');
      const { nodeId } = await command('DOM.querySelector', { nodeId: documentRoot.nodeId, selector: 'input[type=file]' });
      await command('DOM.setFileInputFiles', { nodeId, files: [path.join(artifacts, 'upload-test.jpg')] });
      await waitFor('document.body.innerText.includes("Remove selected photo")');
      await evaluate(`(()=>{for(const [label,value] of [['Measured weight (kg)','7.5'],['Weight explanation','Weighed without the laundry basket.']]){const e=document.querySelector('[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
      await clickText('Save weight, photo & final price'); await clickText('Cancel');
      assert.equal(weightWrites.length, before, 'Cancelling does not save weight or photo');
      await clickText('Save weight, photo & final price'); await clickText('Continue');
      await waitFor('document.body.innerText.includes("Measured weight & scale photos")');
      await clickText('Measured weight & scale photos');
      await waitFor('document.body.innerText.includes("Test Laundry Partner")');
      assert.equal(weightWrites.length, before + 1);
      assert.equal(weightWrites.at(-1).kilos, 7.5);
      user.isShopOwner = false;
      await visit('/order/tracking/42', width, 'Measured weight & scale photos', `scale-photo-customer-${width}`);
      await clickText('Measured weight & scale photos');
      await waitFor(`!!document.querySelector('[aria-label="Shop scale photo for 7.5 kilograms"]')`);
      assert.ok(!(await evaluate('document.body.innerText')).includes('Save weight, photo & final price'), 'Customer cannot edit measured weight');
      await clickText('Enlarge scale photo'); await waitFor('document.body.innerText.includes("Close scale photo")');
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
      await clickText('Close scale photo');
      user.isShopOwner = true;
    }
    user.isShopOwner = false; weightPhotoFailure = true;
    await visit('/order/tracking/42', 390, 'Measured weight & scale photos');
    await clickText('Measured weight & scale photos');
    await waitFor('document.body.innerText.includes("Retry scale photo")');
    weightPhotoFailure = false; await clickText('Retry scale photo');
    await waitFor(`!!document.querySelector('[aria-label="Shop scale photo for 7.5 kilograms"]')`);
    console.log('PASS scale photo required, preview, cancel, save, customer privacy, history, enlarge, retry and mobile/desktop layout');
    return;
  }
  if (deliveryTest) {
    for (const width of [320,390,768,1440]) {
      await visit('/rider/jobs',width,'Rider dashboard',`rider-jobs-${width}`);
      assert.ok((await evaluate('document.body.innerText')).includes('Accept job'));
      await clickText('Confirm delivery'); await waitFor('document.body.innerText.includes("6-digit handoff code")');
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
      await clickText('Cancel');
      await visit('/rider/history',width,'Your delivery record');
    }
    await visit('/rider/notifications',390,'No notifications yet');
    user.isAdmin=true;user.isRider=false;
    for (const width of [390,1440]) await visit('/admin/operations',width,'Delivery Operations',`delivery-operations-${width}`);
    user.isAdmin=false;user.isShopOwner=false;orders[0].workflowStatus='Folding';
    for (const width of [390,1440]) await visit('/order/tracking/42',width,'Step 3 of 5',`delivery-customer-${width}`);
    user.isShopOwner=true;
    for (const width of [390,1440]) await visit('/shop/customers/orders/42',width,'Mark laundry ready',`delivery-partner-${width}`);
    for (const width of [320, 390, 1440]) {
      handoffFixture = { kind: 'pickup', arrived: false, released: false };
      deliveryJobs[0].status = 'Accepted'; deliveryJobs[0].order.status = 'PickupEnRoute'; deliveryJobs[0].order.handoff = handoffFixture;
      user.isShopOwner = false; user.isRider = true;
      await visit('/rider/jobs',width,'Arrived at customer');
      await clickText('Arrived at customer'); await clickText('Confirm');
      await waitFor('document.body.innerText.includes("Waiting for the customer to confirm")');
      assert.equal(await evaluate('Array.from(document.querySelectorAll("[role=button]")).find(button => button.innerText.trim() === "Confirm laundry received").getAttribute("aria-disabled")'), 'true');
      user.isRider = false;
      await visit('/order/tracking/42',width,'I handed over the laundry');
      await clickText('I handed over the laundry'); await clickText('Continue');
      await waitFor('document.body.innerText.includes("Waiting for the rider to finish this step")');
      user.isRider = true;
      await visit('/rider/jobs',width,'Handover confirmed. Finish this step');
      await clickText('Confirm laundry received'); await clickText('Confirm');
      await waitFor('document.body.innerText.includes("Arrived at laundry shop")');
      assert.equal(deliveryJobs[0].order.status, 'LaundryPickedUp');
    }
    console.log('PASS rider mobile/desktop jobs, proof dialog, history, notifications and admin dispatch layouts');
    return;
  }
  if (logoutTest) {
    const visible = '!!document.querySelector("[data-testid=app-dialog]")';
    const closed = '!document.querySelector("[data-testid=app-dialog]")';
    async function openLogout(label='Logout') {
      await evaluate(`(()=>{const e=Array.from(document.querySelectorAll('[role="button"]')).find(e=>e.innerText.trim()===${JSON.stringify(label)});e.focus();e.click();})()`);
      await waitFor(visible);await waitFor('document.activeElement?.getAttribute("aria-label")==="Cancel"');
      await waitFor('Number(getComputedStyle(document.querySelector("[data-testid=app-dialog]").parentElement).opacity)>.99');
      assert.ok((await evaluate('document.querySelector("[data-testid=app-dialog]").innerText')).includes('Are you sure you want to log out?'));
      const blur=await evaluate('getComputedStyle(document.querySelector("[data-testid=dialog-backdrop-blur]")).backdropFilter');
      assert.ok(blur.includes('blur('),'Backdrop actually applies blur');
    }
    for(const width of [320,390,768,1440]) {
      await visit('/profile',width,'Settings');
      const before=await evaluate('({path:location.href,token:sessionStorage.getItem("auth_token"),user:sessionStorage.getItem("auth_user"),history:history.length})');
      await openLogout();
      assert.equal(await evaluate('location.href'),before.path,'Opening logout keeps the same page');
      const bounds=await evaluate('(()=>{const r=document.querySelector("[data-testid=app-dialog]").getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})()');
      assert.ok(bounds.left>=0&&bounds.right<=width&&bounds.top>=0,'Modal fits viewport');
      if(width===390||width===1440){const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,`logout-modal-${width}.png`),Buffer.from(shot.data,'base64'));}
      await clickText('Cancel');await waitFor(closed);
      assert.deepEqual(await evaluate('({path:location.href,token:sessionStorage.getItem("auth_token"),user:sessionStorage.getItem("auth_user"),history:history.length})'),before,'Cancel preserves page, credentials and history');
    }
    await openLogout();for(let i=0;i<8;i++){await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});}
    assert.ok(await evaluate('document.querySelector("[data-testid=app-dialog]").contains(document.activeElement)'),'Focus remains trapped');
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await waitFor(closed);
    await waitFor('document.activeElement?.getAttribute("aria-label")==="Logout"');
    assert.equal(await evaluate('location.pathname'),'/profile');
    await openLogout();await evaluate(`document.querySelector('[aria-label="Dismiss dialog"]').click()`);await waitFor(closed);
    await evaluate(`window.originalRemoveItem=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(key==='auth_user')throw new Error('Simulated storage failure');return window.originalRemoveItem.call(this,key);};`);
    await openLogout();await clickText('Log Out');await waitFor('document.body.innerText.includes("We couldn\'t log you out")');
    assert.equal(await evaluate('location.pathname'),'/profile');assert.equal(await evaluate('sessionStorage.getItem("auth_token")'),'isolated-ui-test','Failed logout restores partially removed credentials');
    await evaluate('Storage.prototype.removeItem=window.originalRemoveItem');
    await evaluate(`(()=>{const e=document.querySelector('[data-testid=app-dialog] [aria-label="Log Out"]');e.click();e.click();})()`);
    await waitFor('location.pathname==="/login"');await waitFor(closed);
    assert.equal(await evaluate('sessionStorage.getItem("auth_token")'),null);assert.equal(await evaluate('sessionStorage.getItem("auth_user")'),null);
    await visit('/shop/profile',390,'Account Information');await openLogout();assert.equal(await evaluate('location.pathname'),'/shop/profile');await clickText('Cancel');await waitFor(closed);assert.equal(await evaluate('location.pathname'),'/shop/profile');
    user.isAdmin=true;await visit('/admin',1440,'Shop management');await clickText('Approved');await openLogout('Sign Out');await clickText('Cancel');await waitFor(closed);
    const selectedTabs=await evaluate('Array.from(document.querySelectorAll("[role=tab]")).map(e=>({text:e.innerText.trim(),selected:e.getAttribute("aria-selected")}))');
    assert.ok(selectedTabs.some(tab=>tab.text==='Approved'&&tab.selected==='true'),'Admin filters remain selected after cancelling: '+JSON.stringify(selectedTabs));
    await openLogout('Sign Out');await clickText('Log Out');await waitFor('location.pathname==="/login"');await waitFor(closed);
    assert.equal(await evaluate('sessionStorage.getItem("auth_token")'),null);assert.deepEqual(nativeDialogs,[]);assert.deepEqual(errors,[]);
    console.log('PASS logout blur at four sizes; customer/shop/admin current-page cancellation, focus, Escape, backdrop, storage failure, retry and success-only redirect');
    return;
  }
  if (servicesTest) {
    const editor = '!!document.querySelector("[data-testid=service-editor]")';
    const closed = '!document.querySelector("[data-testid=service-editor]")';
    async function checkFit(noScroll = true) {
      const geometry = await evaluate(`(()=>{const card=document.querySelector('[data-testid=service-editor]'),body=document.querySelector('[data-testid=service-editor-body]'),footer=document.querySelector('[data-testid=service-editor-actions]');const c=card.getBoundingClientRect(),f=footer.getBoundingClientRect();return {top:c.top,bottom:c.bottom,right:c.right,footerBottom:f.bottom,scroll:body.scrollHeight-body.clientHeight};})()`);
      assert.ok(geometry.top >= 0 && geometry.bottom <= (await evaluate('innerHeight'))+1,'Dialog fits viewport: '+JSON.stringify(geometry));
      assert.ok(geometry.footerBottom <= geometry.bottom,'Footer remains inside dialog');
      assert.ok(geometry.right <= (await evaluate('innerWidth')),'Dialog fits width');
      if (noScroll) assert.ok(geometry.scroll <= 1,'No vertical scrolling with the keyboard closed: '+JSON.stringify(geometry));
    }
    for (const [width,height] of [[320,640],[390,844],[768,1000],[1440,1000]]) {
      await visit('/shop/services',width,'Full Service');
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await clickText('Add Service'); await waitFor(editor); await checkFit(false);
      if (width===390) { const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,'service-editor-compact-phone.png'),Buffer.from(shot.data,'base64')); }
      await clickText('Price per kilogram');
      assert.equal(await evaluate(`!!document.querySelector('input[aria-label="Weight per load"]')`),false);
      await checkFit(false); await clickText('Fixed price per load'); await checkFit(false);
      await clickText('Close service editor'); await waitFor(closed);
    }
    await visit('/shop/services',390,'Full Service','service-color-cards');
    assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-testid=service-card-1]")).backgroundColor'),'rgb(50, 16, 120)');
    assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-testid=service-card-2]")).backgroundColor'),'rgb(208, 193, 232)');
    await clickText('Add Service'); await waitFor(editor);
    async function input(label,value) {
      await evaluate(`(()=>{const e=document.querySelector('input[aria-label="'+${JSON.stringify(label)}+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    }
    await input('Service Name','Compact Test'); await input('Weight per load','8'); await input('Price per load','255');
    await input('Standard washing time','30'); await input('Standard drying time','45');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Service color #D0C1E8"]').getAttribute('aria-disabled')`),'true');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Service color #321078"]').getAttribute('aria-disabled')`),'true');
    for(const color of ['#7EA8BE','#28536B','#5C374C','#052F5F']) assert.ok(await evaluate(`!!document.querySelector('[aria-label="Service color ${color}"]')`));
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Service color #AA5042"]')`),false);
    await clickText('Service color #7EA8BE');
    await evaluate(`document.querySelector('[data-testid=service-editor-actions] [aria-label="Add Service"]').click()`);
    await waitFor(closed); await waitFor('!!document.querySelector("[data-testid=service-card-3]")');
    assert.deepEqual(serviceWrites[0].body,{serviceName:'Compact Test',price:255,packageKilos:8,washingMinutes:30,dryingMinutes:45,color:'#7EA8BE'});
    assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-testid=service-card-3]")).backgroundColor'),'rgb(126, 168, 190)');
    await evaluate('document.querySelector("[data-testid=service-card-3] [aria-label=Edit]").click()');
    await waitFor(editor); await checkFit(false);
    assert.equal(await evaluate(`document.querySelector('input[aria-label="Service Name"]').value`),'Compact Test');
    assert.notEqual(await evaluate(`document.querySelector('[aria-label="Service color #7EA8BE"]').getAttribute('aria-disabled')`),'true','Own color stays available while editing');
    await clickText('Price per kilogram'); await input('Price per kilogram','35'); await clickText('Service color #5C374C');
    await clickText('Save Changes'); await waitFor(closed);
    assert.equal(serviceWrites.at(-1).body.packageKilos,null);
    assert.equal(serviceWrites.at(-1).body.color,'#5C374C');
    await clickText('Add Price Range'); await waitFor(editor);
    assert.equal(await evaluate('document.querySelectorAll("[data-testid=service-editor] input[type=range]").length'),2);
    async function arrow(label,key,times) {
      await evaluate(`document.querySelector('input[aria-label="'+${JSON.stringify(label)}+'"]').focus()`);
      for(let i=0;i<times;i++) {
        await command('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:key==='ArrowRight'?39:37});
        await command('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:key==='ArrowRight'?39:37});
      }
    }
    await arrow('Minimum weight','ArrowRight',3); await arrow('Maximum weight','ArrowLeft',3);
    assert.equal(await evaluate(`document.querySelector('input[aria-label="Minimum weight"]').value`),'4');
    assert.equal(await evaluate(`document.querySelector('input[aria-label="Maximum weight"]').value`),'9');
    const rangeShot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,'price-range-slider-phone.png'),Buffer.from(rangeShot.data,'base64'));
    for (const label of ['Price per Kilogram']) {
      await input(label,'letters');
      assert.equal(await evaluate(`document.querySelector('input[aria-label="'+${JSON.stringify(label)}+'"]').value`),'');
      await input(label,'25.50');
      await input(label,'25.50abc');
      assert.equal(await evaluate(`document.querySelector('input[aria-label="'+${JSON.stringify(label)}+'"]').value`),'25.50');
    }
    await clickText('Add Range'); await waitFor(closed);
    assert.deepEqual(priceRangeWrites[0],{minKilo:4,maxKilo:9,pricePerKilo:25.5});
    await clickText('Add Service'); await waitFor(editor);
    await command('Emulation.setDeviceMetricsOverride',{width:390,height:360,deviceScaleFactor:1,mobile:false});
    await pause(100); await checkFit(false);
    await clickText('Cancel'); await waitFor(closed);
    assert.deepEqual(errors,[]);
    console.log('PASS compact service editor, fixed footer, pricing switch, standard times and persisted card colors');
    return;
  }
  if (dialogTest) {
    const dialogVisible = '!!document.querySelector("[data-testid=app-dialog]")';
    const dialogClosed = '!document.querySelector("[data-testid=app-dialog]")';
    async function openDelete() {
      await waitFor('Array.from(document.querySelectorAll("[role=button]")).some(e=>e.getAttribute("aria-label")==="Delete"&&e.getAttribute("aria-disabled")!=="true")');
      await evaluate(`(()=>{const e=Array.from(document.querySelectorAll('[role="button"]')).find(e=>e.getAttribute('aria-label')==='Delete');e.focus();e.click();})()`);
      await waitFor(dialogVisible);
      await waitFor('document.activeElement?.getAttribute("aria-label")==="Cancel"');
      assert.ok((await evaluate('document.querySelector("[data-testid=app-dialog]").innerText')).includes('Full Service'));
    }
    await visit('/login',390,'Log In'); await clickText('Log In'); await waitFor(dialogVisible);
    assert.ok((await evaluate('document.body.innerText')).includes('Please fill in all fields'));
    await clickText('Got it'); await waitFor(dialogClosed);
    await visit('/shop/services',1440,'Full Service'); await openDelete();
    const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,'delete-service-modal-desktop.png'),Buffer.from(shot.data,'base64'));
    for(let i=0;i<8;i++){await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});}
    assert.ok(await evaluate('document.querySelector("[data-testid=app-dialog]").contains(document.activeElement)'),'Keyboard focus stays in the modal');
    await clickText('Cancel'); await waitFor(dialogClosed); assert.equal(dialogWrites.length,0);
    await waitFor('document.activeElement?.getAttribute("aria-label")==="Delete"');
    await openDelete();
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await waitFor(dialogClosed);assert.equal(dialogWrites.length,0);
    await openDelete();await evaluate(`document.querySelector('[aria-label="Dismiss dialog"]').click()`);await waitFor(dialogClosed);
    await openDelete();await evaluate(`document.querySelector('[aria-label="Close dialog"]').click()`);await waitFor(dialogClosed);
    for(const width of [320,390]) {
      await visit('/shop/services',width,'Full Service');await openDelete();
      assert.ok(await evaluate('document.querySelector("[data-testid=app-dialog]").getBoundingClientRect().right<=innerWidth'),'Dialog fits narrow screens');
      const mobileShot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifacts,`delete-service-modal-${width}.png`),Buffer.from(mobileShot.data,'base64'));
      await clickText('Cancel');await waitFor(dialogClosed);
    }
    assert.equal(dialogWrites.length,0,'All dismissal paths preserve services');
    failServiceDelete=true;await openDelete();await clickText('Delete Service');await waitFor(dialogClosed);
    await waitFor('document.body.innerText.includes("Unable to delete this service")');assert.equal(dialogWrites.length,1);assert.equal(shops[0].services.length,2);
    failServiceDelete=false;await openDelete();await evaluate(`(()=>{const e=document.querySelector('[data-testid=app-dialog] [aria-label="Delete Service"]');e.click();e.click();})()`);
    await waitFor('!document.body.innerText.includes("Full Service")');assert.equal(dialogWrites.length,2,'Double confirmation sends one request');assert.equal(shops[0].services.length,1);
    assert.deepEqual(nativeDialogs,[],'No browser-native dialogs');assert.deepEqual(errors,[]);
    console.log('PASS branded notices and service deletion: keyboard focus, Cancel, Escape, backdrop, close, narrow screens, API failure and single-submit confirmation');
    return;
  }
  if (applicationTest) {
    for (const width of [320,390,768,1187,1440]) {
      await visit('/register-shop',width,'Waiting for admin approval',width===390?'application-pending-phone':width===1187?'application-pending-desktop':undefined);
      const nameBounds = await evaluate(`(()=>{const e=Array.from(document.querySelectorAll('[data-testid="shop-application-status"] div')).find(e=>e.textContent===${JSON.stringify(shops[0].shopName)}&&!e.childElementCount);const range=document.createRange();range.setStart(e.firstChild,0);range.setEnd(e.firstChild,2);return {nameLeft:range.getBoundingClientRect().left,iconRight:e.parentElement.previousElementSibling.getBoundingClientRect().right};})()`);
      assert.ok(nameBounds.nameLeft >= nameBounds.iconRight + 6,`Shop name must not overlap its icon at ${width}px: ${JSON.stringify(nameBounds)}`);
    }
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('[role="button"]')).filter(e=>e.innerText.trim()==='Continue as Customer').length`),1,'Application has one primary customer action');
    await clickText('Refresh Status'); await waitFor('document.body.innerText.includes("Last checked at")');
    await clickText('Continue as Customer'); await waitFor('location.pathname==="/profile"');
    for (const [status,expected] of [['Rejected','Your application needs an update'],['Suspended','Your shop access is paused'],['Approved','Your shop is ready to go']]) {
      shops[0].approvalStatus=status;
      shops[0].reviewReason=status==='Approved'?null:'Please confirm the business contact details before your shop can receive orders.';
      await visit('/register-shop',390,expected,`application-${status.toLowerCase()}-phone`);
      if (status==='Rejected') { await clickText('Edit and Resubmit'); await waitFor('document.body.innerText.includes("Resubmit for Approval")'); await clickText('Cancel'); await waitFor('document.body.innerText.includes("Admin\'s feedback")'); }
      if (status==='Approved') { await clickText('Open My Shop'); await waitFor('location.pathname==="/shop/home"'); }
    }
    assert.deepEqual(errors,[]);
    console.log('PASS application layout at five widths, all four statuses, refresh, customer navigation, rejection editing and approved shop access');
    return;
  }
  if (approvalTest) {
    await visit('/login',390,'Log In');
    await evaluate(`(()=>{for(const [label,value] of [['Email','admin-test@example.test'],['Password','test-password-only']]){const e=document.querySelector('input[aria-label="'+label+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
    await clickText('Log In'); await waitFor('document.body.innerText.includes("Shop management")');
    assert.equal(await evaluate('location.pathname'),'/admin','Admin login opens the dashboard');
    for (const width of [390,1440]) await visit('/admin',width,'Shop management',`admin-approvals-${width}`);
    const navLabels = await evaluate(`Array.from(document.querySelectorAll('[role="tablist"] [role="tab"]')).map(e=>e.innerText.trim())`);
    assert.ok(navLabels.includes('Dashboard'),'Admin navigation includes Dashboard');
    assert.ok(!navLabels.some(label=>['Home','Activities','Profile','Orders','Services','Customers'].includes(label)),'Admin navigation is separate from customer and shop tabs');
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Back"]')`),false,'Admin dashboard has no back arrow');
    assert.ok(!(await evaluate('document.body.innerText')).includes('Customer View'),'No customer-mode switch');
    for (const path of ['/home','/profile','/shop/home','/register-shop']) {
      await visit(path,390,'Shop management');
      assert.equal(await evaluate('location.pathname'),'/admin','Admin direct links stay in the admin panel');
    }
    await command('Page.reload'); await waitFor('document.body.innerText.includes("Shop management")');
    await evaluate('history.back()'); await waitFor('document.body.innerText.includes("Shop management")');
    assert.equal(await evaluate('location.pathname'),'/admin','Browser Back keeps admins in their panel');
    await clickText('Dashboard');
    await clickText('Reject Application'); await clickText('Reject Application');
    await waitFor('document.body.innerText.includes("Enter a reason")'); assert.equal(reviews.length,0);
    await evaluate(`(()=>{const e=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Please correct your business contact.');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await clickText('Reject Application'); await waitFor('document.body.innerText.includes("No matching applications")');
    assert.equal(reviews[0].status,'Rejected');
    user.isAdmin=false;
    await visit('/register-shop',390,'Please correct your business contact.','application-rejected');
    await clickText('Edit and Resubmit'); await waitFor('document.body.innerText.includes("Resubmit for Approval")');
    await clickText('Resubmit for Approval'); await waitFor('document.body.innerText.includes("Pending Approval")');
    await visit('/shop/home',390,'Pending Approval','application-pending');
    assert.ok((await evaluate('location.pathname')).includes('register-shop'),'Unapproved owner direct URL is guarded');
    user.isAdmin=true;
    await visit('/admin',390,'Approve Shop'); await clickText('Approve Shop'); await clickText('Cancel');
    assert.equal(reviews.length,1,'Cancelled approval does not submit');
    await clickText('Approve Shop'); await clickText('Approve Shop'); await waitFor('document.body.innerText.includes("No matching applications")');
    user.isAdmin=false;
    await visit('/shop/home',390,'Recent orders');
    user.isAdmin=true;
    await visit('/admin',390,'Shop management'); await clickText('Approved'); await clickText('Suspend Shop');
    await evaluate(`(()=>{const e=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Verification requires review.');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await clickText('Suspend Shop'); await waitFor('!document.body.innerText.includes("Test Laundry & Fabric Care")');
    user.isAdmin=false;
    await visit('/shop/home',390,'Verification requires review.','application-suspended');
    user.isAdmin=false; await visit('/admin',390,'Admin access required','admin-denied');
    assert.equal(await evaluate(`!!document.querySelector('[role="tab"][aria-label="Dashboard"]')`),false,'Customers do not receive admin navigation');
    user.isAdmin=true; await visit('/admin',390,'Shop management');
    await clickText('Sign Out'); await waitFor('!!document.querySelector("[data-testid=app-dialog]")'); await clickText('Log Out'); await waitFor('document.body.innerText.includes("Log In")');
    assert.equal(await evaluate('sessionStorage.getItem("auth_token")'),null,'Admin sign out clears the session');
    assert.deepEqual(reviews.map(review => review.status),['Rejected','Approved','Suspended']);
    console.log('PASS approval dashboard, reason validation, rejection, resubmission, direct URL guards, approval, suspension and admin denial');
    return;
  }
  if (photoTest) {
    await visit('/home',390,'Shop photo coming soon','customer-photo-cards');
    await clickText('Full Service');
    await waitFor('!document.querySelector("[data-testid=customer-shop-discovery]").innerText.includes("Test Neighborhood Laundry")');
    await visit('/shop/profile/shop-details',390,'Upload shop photo','shop-photo-editor');
    await evaluate(`(()=>{const input=document.querySelector('input[aria-label="Shop Name *"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Unsaved shop name');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    async function choosePhoto(label) {
      await clickText(label);
      await waitFor('!!document.querySelector("input[type=file]")');
      const { root } = await command('DOM.getDocument');
      const { nodeId } = await command('DOM.querySelector',{nodeId:root.nodeId,selector:'input[type=file]'});
      await command('DOM.setFileInputFiles',{nodeId,files:[path.join(artifacts,'upload-test.jpg')]});
    }
    await choosePhoto('Upload shop photo');
    await waitFor('document.body.innerText.includes("Shop photo updated")');
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('input')).find(input=>input.getAttribute('aria-label')==='Shop Name *').value`),'Unsaved shop name','Photo upload preserves unsaved shop details');
    await waitFor('Array.from(document.images).some(image=>image.src.includes("/photo?")&&image.complete&&image.naturalWidth>0)');
    await visit('/home',390,'Test Laundry');
    await waitFor('Array.from(document.images).some(image=>image.src.includes("/photo?")&&image.complete&&image.naturalWidth>0)');
    await visit('/shop/profile/shop-details',390,'Change shop photo');
    mode='error'; await choosePhoto('Change shop photo'); await waitFor('document.body.innerText.includes("Test photo upload failed")');
    assert.ok(hasPhoto,'Failed replacement retains original photo'); mode='populated';
    await clickText('Remove photo'); await waitFor('!!document.querySelector("[data-testid=app-dialog]")'); await clickText('Cancel'); assert.ok(hasPhoto,'Cancel removal preserves photo');
    await clickText('Remove photo'); await waitFor('!!document.querySelector("[data-testid=app-dialog]")'); await clickText('Remove Photo'); await waitFor('document.body.innerText.includes("Shop photo removed")');
    await visit('/home',390,'Shop photo coming soon');
    hasPhoto=true; brokenPhoto=true; shops[0].photoUrl=`/api/shops/101/photo?v=${Date.now()}`;
    // Force a fresh app boot so React Query can't serve the earlier successful
    // photo URL from the customer shop list cache.
    await visit(`/home?photo-fallback=${Date.now()}`,390,'Shop photo unavailable');
    assert.deepEqual(errors,[]);
    assert.deepEqual(nativeDialogs,[],'Photo removal uses an in-app modal');
    console.log('PASS photo picker, upload, display, filters, errors, confirmation, removal and image fallback');
    return;
  }
  if (analyticsTest) {
    for (const width of [320,390,768,1440]) {
      await visit('/shop/home',width,'Popular services',width===390?'dashboard-analytics-phone':width===1440?'dashboard-analytics-desktop':undefined);
      assert.equal(await evaluate('document.querySelector("[data-testid=dashboard-chart-total]").innerText'), '12 orders');
      await clickText('Show revenue graph');
      await waitFor('document.querySelector("[data-testid=dashboard-chart-total]").innerText.includes("645.00")');
      assert.equal(await evaluate('document.querySelectorAll("[data-testid=dashboard-line-chart] path[fill=none]").length'),1,'Only the selected metric has a line');
      await evaluate('document.querySelector("[data-testid=dashboard-line-chart] [role=button]").click()');
      await waitFor('document.querySelector("[data-testid=dashboard-performance]").innerText.includes("215.00")');
      if (width === 390) {
        await evaluate('document.querySelector("[data-testid=dashboard-performance]").scrollIntoView({block:"start"})');
        await pause(100);
        const shot = await command('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(artifacts,'dashboard-revenue-phone.png'),Buffer.from(shot.data,'base64'));
      }
    }
    const beforeToggle = analyticsRequests.length;
    await clickText('Show orders graph');
    assert.equal(analyticsRequests.length,beforeToggle,'Toggling metrics reuses the selected range');
    await clickText('Dashboard Today'); await waitFor('document.body.innerText.includes("Hourly totals")');
    await clickText('Dashboard Custom');
    async function dateInput(label,value) {
      await evaluate(`(()=>{const e=document.querySelector('input[aria-label=${JSON.stringify(label)}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    }
    await dateInput('Analytics start date','2020-01-03'); await dateInput('Analytics end date','2020-01-01');
    await clickText('Apply dates'); await waitFor('document.body.innerText.includes("End date must be on or after")');
    await dateInput('Analytics start date','2020-01-01'); await dateInput('Analytics end date','2020-06-01');
    await clickText('Apply dates'); await waitFor('document.body.innerText.includes("Monthly totals")');
    assert.deepEqual(analyticsRequests.at(-1), { start: '2020-01-01', end: '2020-06-01' });
    await clickText('3 Pending'); await waitFor('location.pathname==="/shop/transactions"&&!!document.querySelector("[data-testid=shop-order-42]")');
    mode='empty'; await visit('/shop/home',390,'No completed services in this period.');
    assert.equal(await evaluate('document.querySelector("[data-testid=dashboard-chart-total]").innerText'),'0 orders');
    await clickText('Show revenue graph'); await waitFor('document.querySelector("[data-testid=dashboard-chart-total]").innerText.includes("0.00")');
    mode='error'; await visit('/shop/home',390,'Unable to load');
    assert.equal(await evaluate('!!document.querySelector("[data-testid=dashboard-performance]")'),false,'Errors never show invented chart data');
    assert.deepEqual(errors,[]);
    console.log('PASS dashboard metric toggle, exact values, presets, custom validation, aggregation, workload links, empty and error states');
    return;
  }
  if (manualTimersTest) {
    for(const width of [320,390]) await visit('/shop/transactions/shop-transaction?id=42',width,'Start washing',`manual-timers-waiting-${width}`);
    assert.equal(await evaluate('document.querySelector("[data-testid=order-step-content] [data-testid=processing-timer]").innerText.includes("0:00 · Time elapsed")'),false,'Old processing time starts no timer');
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('[role=button]')).find(e=>e.innerText.trim()==='Start drying').getAttribute('aria-disabled')`),'true');
    assert.equal(manualTimerWrites.length,0);
    await clickText('Start washing');
    await waitFor(`!Array.from(document.querySelectorAll('[role=button]')).some(e=>e.innerText.trim()==='Start washing')`);
    assert.deepEqual(manualTimerWrites,[{phase:'washing'}]);
    assert.equal(orders[0].dryingStartedAt,null);
    const initial=await evaluate('document.querySelector("[data-testid=order-step-content] [data-testid=processing-timer]").innerText');
    await waitFor(`document.querySelector('[data-testid=order-step-content] [data-testid=processing-timer]').innerText!==${JSON.stringify(initial)}`,4000);
    assert.ok(await evaluate('document.querySelector("[data-testid=order-step-content] [data-testid=processing-timer]").innerText.includes("Not started")'));
    await visit('/shop/transactions/shop-transaction?id=42',390,'Start drying','manual-timers-washing-phone');
    assert.equal(manualTimerWrites.length,1,'Reopening never restarts washing');
    orders[0].washingStartedAt=new Date(Date.now()-2*3600000).toISOString();
    await visit('/shop/transactions/shop-transaction?id=42',390,'0:00 · Time elapsed');
    assert.equal(orders[0].dryingStartedAt,null,'Washing expiry never starts drying');
    await clickText('Start drying');
    await waitFor(`!Array.from(document.querySelectorAll('[role=button]')).some(e=>e.innerText.trim()==='Start drying')`);
    assert.deepEqual(manualTimerWrites,[{phase:'washing'},{phase:'drying'}]);
    assert.ok(await evaluate('document.querySelector("[data-testid=order-step-content] [data-testid=processing-timer]").innerText.includes("Finished")'));
    assert.equal(orders[0].status,'Processing');
    await visit('/shop/transactions/shop-transaction?id=42',390,'Mark laundry ready','manual-timers-drying-phone');
    user.isShopOwner=false;
    await visit('/transaction-details?id=42',390,'Wash & dry timers','manual-timers-customer-phone');
    assert.ok(await evaluate('document.querySelector("[data-testid=order-step-content] [data-testid=processing-timer]").innerText.includes("remaining")'));
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('[role=button]')).some(e=>['Start washing','Start drying'].includes(e.innerText.trim()))`),false,'Customer sees read-only timers');
    assert.equal(manualTimerWrites.length,2);
    assert.deepEqual(errors,[]);
    console.log('PASS manual timers: independent owner starts, old timestamps ignored, countdown, reload, no automatic drying, customer read-only and mobile layouts');
    return;
  }
  if (originalOrderStepsTest) {
    orders[0].washingMinutes=30; orders[0].dryingMinutes=45;
    for (const [status, step] of [['Pending',1],['Accepted',2],['Queued',2],['Processing',3],['Ready',4],['Completed',5],['Cancelled',1]]) {
      Object.assign(orders[0],{ status, receivedAt:null,processingStartedAt:status==='Processing'?new Date(Date.now()-5*60000).toISOString():null,readyAt:null,completedAt:null });
      await visit('/shop/transactions/shop-transaction?id=42',390,`Step ${step} of 5`);
      assert.equal(await evaluate('document.querySelectorAll("[data-testid=order-step-indicator] [role=tab]").length'),5,status);
    }
    orders[0].status='Pending';
    await visit('/shop/transactions/shop-transaction?id=42',390,'Accept order');
    await clickText('Order step 5: Complete'); assert.equal(workflowWrites.length,0);
    await clickText('Back to current step');
    await evaluate(`(()=>{const e=document.querySelector('[aria-label="Acceptance explanation (required)"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'We can accept this order today.');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    for (const [button, expected] of [['Accept order','Confirm laundry received'],['Confirm laundry received','Start processing'],['Start processing','Mark laundry ready'],['Mark laundry ready','Confirm delivered to customer'],['Confirm delivered to customer','Order complete']]) {
      await clickText(button); await clickText('Confirm'); await waitFor(`document.body.innerText.includes(${JSON.stringify(expected)})`);
    }
    assert.deepEqual(workflowWrites.map(body=>body.status),['Accepted','Queued','Processing','Ready','Completed']);
    assert.ok(workflowWrites.every(body=>!body.action),'Status updates retain the original endpoint and payload');
    orders[0].status='Processing';
    for (const width of [320,390,768]) await visit('/shop/transactions/shop-transaction?id=42',width,'Mark laundry ready',`original-order-processing-${width}`);
    await clickText('Ready time estimate');
    await waitFor(`!!document.querySelector('[aria-label="Ready date"]')`);
    await clickText('Order information'); await waitFor('document.body.innerText.includes("Customer Details")');
    await clickText('Payment information'); assert.ok(await evaluate('document.body.innerText.includes("Cash on Delivery")'));
    user.isShopOwner=false;
    for (const [status, step] of [['Pending',1],['Accepted',2],['Queued',2],['Processing',3],['Ready',4],['Completed',5],['Cancelled',1]]) {
      orders[0].status=status;
      if(status==='Cancelled') Object.assign(orders[0],{receivedAt:null,processingStartedAt:null,readyAt:null,completedAt:null});
      await visit('/transaction-details?id=42',390,`Step ${step} of 5`,status==='Processing'?'original-order-customer-phone':undefined);
      if(status==='Processing') assert.equal(await evaluate('document.querySelectorAll("[data-testid=processing-timer]").length'),1);
      if(status==='Pending') assert.ok(await evaluate('document.body.innerText.includes("Cancel Order")'));
      if(status==='Completed') assert.ok(await evaluate('document.body.innerText.includes("Order Again")'));
    }
    assert.deepEqual(errors,[]);
    console.log('PASS original order steps for all statuses, both roles, legacy actions, timers, estimates, payment and mobile layouts');
    return;
  }
  if (orderStepsTest) {
    for (const width of [320,390,768]) await visit('/shop/transactions/shop-transaction?id=42',width,'Start washing',`order-steps-received-${width}`);
    assert.equal(await evaluate('document.querySelectorAll("[data-testid=order-step-indicator] [role=tab]").length'),5);
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Measured weight (kg)"]')`),false,'Weight form is initially collapsed');
    assert.equal(await evaluate('document.body.innerText.includes("234567")'),false,'Return code is absent during receipt');
    await clickText('Order step 5: Complete');
    await waitFor('document.querySelector("[data-testid=order-step-content]").innerText.includes("Not reached")');
    assert.equal(workflowWrites.length,0,'Reviewing future steps never advances the order');
    await clickText('Back to current step');
    await clickText('Update weight & scale photo');
    await evaluate(`(()=>{const e=document.querySelector('[aria-label="Measured weight (kg)"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'7.2');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await clickText('Update weight & scale photo'); await clickText('Update weight & scale photo');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Measured weight (kg)"]').value`),'7.2','Collapsing preserves unsaved input');
    await clickText('Order step 1: Booking'); await clickText('Back to current step');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Measured weight (kg)"]').value`),'7.2','Reviewing a step preserves unsaved input');
    await clickText('Start washing'); await clickText('Continue');
    await waitFor('document.querySelector("[data-testid=order-step-content]").innerText.includes("Step 3 of 5")');
    assert.equal(workflowWrites.length,1);
    assert.ok(await evaluate('document.querySelector("[data-testid=order-step-content]").innerText.includes("Wash & dry timers")'));
    await visit('/shop/transactions/shop-transaction?id=42',390,'Start drying','order-steps-processing-phone');
    await clickText('Start drying'); await clickText('Continue'); await waitFor('document.body.innerText.includes("Start folding")');
    await clickText('Start folding'); await clickText('Continue'); await waitFor('document.body.innerText.includes("Mark laundry ready")');
    await clickText('Mark laundry ready'); await clickText('Continue'); await waitFor('document.querySelector("[data-testid=order-step-content]").innerText.includes("Step 4 of 5")');
    await clickText('Handoff confirmation'); await waitFor('document.body.innerText.includes("234567")');
    await clickText('Order history'); assert.ok(await evaluate('document.body.innerText.includes("Laundry Received")'));
    user.isShopOwner=false; orders[0].workflowStatus='Delivered';
    await visit('/order/tracking/42',390,'Confirm receipt','order-steps-customer-return');
    await clickText('Confirm receipt'); await clickText('Continue');
    await waitFor('document.querySelector("[data-testid=order-step-content]").innerText.includes("Step 5 of 5")');
    assert.equal(await evaluate('document.body.innerText.includes("Confirm receipt")'),false);
    assert.equal(await evaluate('document.body.innerText.includes("Cancellation & issues")'),false);
    user.isShopOwner=true; orders[0].workflowStatus='Cancelled';
    orders[0].events=[{id:1,toStatus:'LaundryReceived',createdAt:new Date().toISOString(),actor:{name:user.name}}];
    await visit('/shop/transactions/shop-transaction?id=42',390,'Order cancelled.');
    assert.equal(await evaluate('document.body.innerText.includes("Start washing")'),false);
    assert.equal(await evaluate('document.body.innerText.includes("Clean laundry received by the customer.")'),false);
    assert.deepEqual(errors,[]);
    console.log('PASS order steps: responsive layout, review-only navigation, preserved form input, current actions, timers, return handoff, completion and cancellation');
    return;
  }
  if (processingTimerTest) {
    await visit('/shop/transactions/shop-live-operations',390,'Wash & dry timers','processing-timers-shop');
    const washSelector = '[data-testid=live-order-43] [data-testid=processing-timer]';
    const read = () => evaluate(`document.querySelector(${JSON.stringify(washSelector)}).innerText`);
    const first = await read();
    assert.ok(first.includes('Not started'));
    await waitFor(`document.querySelector(${JSON.stringify(washSelector)}).innerText!==${JSON.stringify(first)}`,4000);
    assert.ok((await read()).match(/24:\d{2}/),'Washing counts down from recorded start, not page open');
    const drying = await evaluate('document.querySelector("[data-testid=live-order-42] [data-testid=processing-timer]").innerText');
    assert.ok(drying.includes('Finished')&&drying.match(/39:\d{2}/),'Drying has its own countdown');
    await evaluate(`document.querySelector('[aria-label="Compact live operations"]').click()`);
    assert.ok((await read()).includes('remaining'),'Compact mode keeps processing timers');
    await visit('/shop/transactions/shop-live-operations',320,'Wash & dry timers','processing-timers-small-phone');
    await visit('/shop/transactions',390,'Wash & dry timers');
    user.isShopOwner = false;
    await visit('/activities',390,'Wash & dry timers','processing-timers-customer');
    await clickText(`View order 43 from ${shops[0].shopName}`);
    await waitFor('document.body.innerText.includes("Step 3 of 5")&&!!document.querySelector("[data-testid=processing-timer]")');
    assert.ok(await evaluate('Array.from(document.querySelectorAll("[data-testid=processing-timer]")).filter(e=>e.getBoundingClientRect().width>0).some(e=>e.innerText.includes("Not started"))'));
    orders[1].workflowStatus = null;
    await visit('/activities',390,'Not started');
    // Expiry is an indicator; it must never write an order transition.
    orders[1].workflowStatus = 'Washing';
    orders[1].processingStartedAt = new Date(Date.now() - 60 * 60000).toISOString();
    await visit('/activities',390,'Time elapsed');
    assert.equal(orders[1].workflowStatus,'Washing');
    assert.equal(workflowWrites.length,0);
    orders[0].workflowStatus='Completed'; orders[1].workflowStatus='ReadyForCollection';
    await visit('/activities',390,'Active Orders');
    assert.equal(await evaluate('document.querySelectorAll("[data-testid=processing-timer]").length'),0);
    assert.deepEqual(errors,[]);
    console.log('PASS processing timers for shop and customer, ticking, actual phase starts, compact mode, legacy estimates, expiry and ready');
    return;
  }
  if (liveOperationsTest) {
    await visit('/shop/home',390,'Recent orders');
    await clickText('Live operations');
    await waitFor('location.pathname==="/shop/home/shop-live-operations"&&!!document.querySelector("[data-testid=live-operations-board]")');
    assert.equal(await evaluate('document.querySelectorAll("[data-testid^=live-stage-]").length'),5);
    assert.equal(await evaluate('document.querySelectorAll("[data-testid^=live-order-]").length'),8,'Closed orders excluded');
    for (const [stage, id] of [['awaiting',50],['queue',52],['processing',53],['ready',54],['returning',55]])
      assert.equal(await evaluate(`!!document.querySelector('[data-testid=live-stage-${stage}] [data-testid=live-order-${id}]')`),true);
    assert.ok(await evaluate('document.body.innerText.includes("Past ready estimate")'));
    await clickText('Open live order 42, Test Customer With A Long Name');
    await waitFor('location.pathname==="/shop/home/shop-transaction"&&!!document.querySelector("[data-testid=order-step-indicator]")');
    await clickText('Back');
    await waitFor('!!document.querySelector("[data-testid=live-operations-board]")');
    await visit('/shop/transactions',390,'Your laundry orders');
    await clickText('Live operations');
    await waitFor('location.pathname==="/shop/transactions/shop-live-operations"&&!!document.querySelector("[data-testid=live-operations-board]")');
    await clickText('Live service: Wash Only');
    assert.equal(await evaluate('document.querySelectorAll("[data-testid^=live-order-]").length'),1);
    assert.equal(await evaluate('!!document.querySelector("[data-testid=live-order-43]")'),true);
    const detailedHeight = await evaluate('document.querySelector("[data-testid=live-order-43]").getBoundingClientRect().height');
    await evaluate(`document.querySelector('[aria-label="Compact live operations"]').click()`);
    await waitFor('!document.body.innerText.includes("Last fetched:")');
    assert.equal(await evaluate('document.querySelectorAll("[data-testid^=live-order-]").length'),1,'Compact toggle preserves service filter');
    assert.ok(await evaluate('document.querySelector("[data-testid=live-order-43]").getBoundingClientRect().height') < detailedHeight,'Compact cards take less height');
    const compactCard = await evaluate('document.querySelector("[data-testid=live-order-43]").innerText');
    for (const text of ['#43',user.name,'Wash Only','8 kg','245.00','Laundry in progress','Past ready estimate']) assert.ok(compactCard.includes(text),'Compact keeps '+text);
    assert.equal(compactCard.includes('Drop-off'),false,'Compact hides transport details');
    assert.equal(compactCard.includes('(PHT)'),false,'Compact hides timestamp details');
    await evaluate(`document.querySelector('[aria-label="Compact live operations"]').click()`);
    await waitFor('document.body.innerText.includes("Last fetched:")');
    assert.equal(await evaluate('document.querySelector("[data-testid=live-order-43]").getBoundingClientRect().height'),detailedHeight,'Detailed view can be restored');
    const outline = await evaluate('(()=>{const s=getComputedStyle(document.querySelector("[data-testid=live-order-43]"));return [s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth,s.borderTopColor,s.borderRightColor,s.borderBottomColor,s.borderLeftColor]})()');
    assert.deepEqual(outline.slice(0,4),['2px','2px','2px','2px']);
    assert.deepEqual(outline.slice(4),Array(4).fill('rgb(208, 193, 232)'),'Service color outlines all four sides');
    await clickText('Live service: All services');
    async function search(value) {
      await evaluate(`(()=>{const e=document.querySelector('input[aria-label="Search order, customer or service"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    }
    await search('#52');
    await waitFor('document.querySelectorAll("[data-testid^=live-order-]").length===1');
    assert.equal(await evaluate('!!document.querySelector("[data-testid=live-stage-queue] [data-testid=live-order-52]")'),true);
    await search('no match'); await waitFor('document.body.innerText.includes("No matching orders")');
    await clickText('Clear filters');
    for (const width of [320,390,768]) {
      await visit('/shop/transactions/shop-live-operations',width,'Oldest orders first',`live-operations-${width}`);
      await evaluate(`document.querySelector('[aria-label="Compact live operations"]').click()`);
      await waitFor('!document.body.innerText.includes("Bookings, pickups & arrivals")');
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'Compact fits viewport');
      const shot=await command('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(artifacts,`live-operations-compact-${width}.png`),Buffer.from(shot.data,'base64'));
    }
    // Refreshed server state moves the same card and removes completed work.
    orders[0].status = 'Queued';
    orders.find(order => order.id===55).workflowStatus = 'Completed';
    await clickText('Refresh live operations');
    await waitFor('!!document.querySelector("[data-testid=live-stage-queue] [data-testid=live-order-42]")&&!document.querySelector("[data-testid=live-order-55]")');
    // The existing 15-second fallback also moves cards without a manual refresh.
    orders[0].status = 'Processing';
    await waitFor('!!document.querySelector("[data-testid=live-stage-processing] [data-testid=live-order-42]")',22000);
    mode='empty'; await visit('/shop/transactions/shop-live-operations',390,'No ongoing orders');
    mode='error'; await visit('/shop/transactions/shop-live-operations',390,'Unable to load');
    assert.deepEqual(errors,[]);
    console.log('PASS Live Operations navigation, five mobile rows, search, services, refresh, polling, empty/error');
    return;
  }
  if (shopOrdersTest) {
    await visit('/shop/transactions',390,'Your laundry orders');
    const ids = () => evaluate('Array.from(document.querySelectorAll("[data-testid^=shop-order-]")).map(e=>e.getAttribute("data-testid"))');
    assert.equal((await ids()).length,5,'Orders are paginated');
    await clickText('Next'); await waitFor('document.body.innerText.includes("Page 2 of 2")');
    assert.equal((await ids()).length,3);
    await clickText('Filter Ready'); await waitFor('!!document.querySelector("[data-testid=shop-order-55]")');
    assert.equal((await ids()).length,2,'Ready includes orders out for delivery');
    assert.ok((await evaluate('document.body.innerText')).includes('Out for delivery'));
    await clickText('Past Orders'); await waitFor('!!document.querySelector("[data-testid=shop-order-44]")');
    assert.equal((await ids()).length,2,'Switching section resets the status filter');
    await clickText('Show pending orders'); await waitFor('!!document.querySelector("[data-testid=shop-order-42]")');
    assert.equal((await ids()).length,1);
    await visit('/shop/customers/shop-customers?status=Completed',390,'Your laundry orders');
    await waitFor('location.pathname==="/shop/transactions"&&!!document.querySelector("[data-testid=shop-order-44]")');
    assert.equal((await ids()).length,1,'Legacy status shortcut preserves its filter');
    await visit('/shop/transactions',390,'Your laundry orders');
    await clickText('Newest first'); await waitFor('document.body.innerText.includes("Oldest first")');
    assert.equal((await ids())[0],'shop-order-50','Oldest sort is chronological');
    for (const width of [320,390,768,1440]) await visit('/shop/transactions',width,'Your laundry orders',width===390?'shop-orders-phone':width===1440?'shop-orders-desktop':undefined);
    assert.deepEqual(errors,[]);
    console.log('PASS merged Orders workflow status, pagination, sort, legacy filters and responsive layouts');
    return;
  }
  for (const width of [320,390,768,1440]) {
    await visit('/home',width,'Test Laundry',width===390?'customer-phone':width===1440?'customer-desktop':undefined);
    await visit('/shop/home',width,'Recent orders',width===390?'shop-phone':width===1440?'shop-desktop':undefined);
    await visit('/shop/transactions',width,'Test Customer');
  }
  for (const width of [390,1440]) for (const [route,expected] of [
    ['/activities','View order details'],['/profile','Personal details'],['/shops/101','Browse services'],['/shops','All laundry shops'],
    ['/shop/services','Full Service'],['/shop/customers','Your laundry orders'],['/shop/profile','Account Information'],['/shop/profile/security','Current Password'],
    ['/shop/customers/orders/42','Order #42'],['/order/101','Review Order'],['/search','Search History']]) await visit(route,width,expected);
  await visit('/activities',390,'Active Orders (2)');
  await clickText('Past Orders (2)'); await waitFor('document.body.innerText.includes("Order #44")');
  await clickText('Cancelled'); await waitFor('document.body.innerText.includes("Order #45")&&!document.body.innerText.includes("Order #44")');
  await clickText('Active Orders (2)'); await clickText('Processing');
  await waitFor('document.body.innerText.includes("Order #43")&&!document.body.innerText.includes("Order #42")');
  await visit('/shop/transactions',390,'Test Customer');
  await clickText('Filter Pending'); await pause(100);
  assert.ok(!(await evaluate('document.body.innerText')).includes('#43'), 'Pending filter excludes processing orders');
  await clickText('Filter All');
  await clickText('Past Orders'); await waitFor('!!document.querySelector("[data-testid=shop-order-44]")');
  assert.equal(await evaluate('!!document.querySelector("[data-testid=shop-order-42]")'),false,'Past excludes pending');
  await clickText('Filter Cancelled'); await waitFor('!!document.querySelector("[data-testid=shop-order-45]")');
  assert.equal(await evaluate('!!document.querySelector("[data-testid=shop-order-44]")'),false,'Cancelled excludes completed');
  await clickText('Show in progress orders'); await waitFor('!!document.querySelector("[data-testid=shop-order-43]")');
  assert.equal(await evaluate('!!document.querySelector("[data-testid=shop-order-42]")'),false,'In progress excludes pending');
  await clickText('Show ready orders'); await waitFor('document.body.innerText.includes("No matching orders")');
  await clickText('Clear filters'); await waitFor('!!document.querySelector("[data-testid=shop-order-42]")');
  await evaluate(`(()=>{const e=document.querySelector('input[aria-label="Search customer, order ID or service"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'#42');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor('!!document.querySelector("[data-testid=shop-order-42]")&&!document.querySelector("[data-testid=shop-order-43]")');
  await clickText('View order 42, Test Customer With A Long Name');
  await waitFor('location.pathname==="/shop/transactions/shop-transaction"&&!!document.querySelector("[data-testid=order-step-indicator]")');
  await visit('/shop/transactions?status=Completed',390,'Your laundry orders');
  await waitFor('!!document.querySelector("[data-testid=shop-order-44]")');
  assert.equal(await evaluate('!!document.querySelector("[data-testid=shop-order-42]")'),false,'URL status selects Past');
  for (const width of [320,390,768,1440]) await visit('/shop/transactions',width,'Your laundry orders',width===390?'shop-orders-phone':width===1440?'shop-orders-desktop':undefined);
  await visit('/shop/services',390,'Full Service'); await clickText('Add Service'); await waitFor('document.body.innerText.includes("Service Name")');
  await clickText('Cancel');
  await visit('/order/101',390,'Review Order');
  await evaluate(`document.querySelector('[role="checkbox"]').click()`); await clickText('Review Order'); await waitFor('document.body.innerText.includes("Place Order")');
  await visit('/search',390,'Search History');
  await evaluate(`(()=>{const e=document.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'no-such-shop');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor('document.body.innerText.includes("No laundry shops matched")');
  mode='empty'; await visit('/home',390,'No shops available yet'); await visit('/activities',390,'No active orders'); await visit('/shop/transactions',390,'No active orders');
  mode='error'; await visit('/home',390,'Unable to load'); await visit('/shop/home',390,'Unable to load');
  mode='loading'; await command('Page.navigate',{ url:'http://127.0.0.1:4178/home' });
  await waitFor('!!document.querySelector("[role=progressbar]")'); console.log('PASS loading indicator');
  fs.writeFileSync(path.join(artifacts,'verification.txt'),'Chrome production UI checks passed.\nViewports: 320, 390, 768, 1440.\nBoth themes, shared flows, long text, search, filters, service dialog, order review, loading, empty and error states verified with intercepted fixtures.\nLive API, native maps, geolocation permission and physical-device behavior require device verification.\n');
  console.log('Application console warnings/errors:', JSON.stringify([...consoleMessages]));
})().catch(error => { console.error(error);process.exitCode=1; }).finally(async () => {
  closing = true;
  for (const item of pending.values()) { clearTimeout(item.timer); item.resolve({}); }
  pending.clear();
  try { if(socket?.readyState===1) socket.send(JSON.stringify({ id: ++nextId, method: 'Browser.close' })); } catch {}
  socket?.close(); browser?.kill(); server.closeAllConnections(); server.close();
});
