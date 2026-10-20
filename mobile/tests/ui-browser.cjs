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
const applicationTest = process.argv.includes('--application');
const dialogTest = process.argv.includes('--dialogs');
const nativeDialogs = [], dialogWrites = [];
let failServiceDelete = false;
let photoBytes, hasPhoto = false, brokenPhoto = false;
fs.mkdirSync(artifacts, { recursive: true });
const user = { id: 7, name: 'Test Customer With A Long Name', email: 'ui-test@example.test', isShopOwner: true, isAdmin: approvalTest,
  address_line_1: '123 Long Street Name, Building Two', city: 'Naga', state_province: 'Camarines Sur', postal_code: '4400', country: 'Philippines', address_type: 'Home', latitude: 13.6217, longitude: 123.1948 };
const shops = [{ ...user, id: 101, userId: 7, approvalStatus: approvalTest || applicationTest ? 'Pending' : 'Approved', applicationVersion: 1, createdAt: new Date().toISOString(), shopName: 'Test Laundry & Fabric Care With A Long Shop Name', openingTime: '08:00', closingTime: '18:00', contactNumber: '09123456789', services: [{ id: 1, serviceName: 'Full Service', price: 215, packageKilos: 8 }, { id: 2, serviceName: 'Wash Only', price: 25 }], kiloPrices: [], clothingTypes: [], householdItems: [] },
  { ...user, id: 102, userId: 8, approvalStatus: 'Approved', applicationVersion: 1, createdAt: new Date().toISOString(), shopName: 'Test Neighborhood Laundry', latitude: 13.63, services: [] }];
const reviews = [];
const orders = ['Pending', 'Processing', 'Completed', 'Cancelled'].map((status,i) => ({ id: 42+i, userId: 7, shopId: 101, userName: user.name,
  serviceName: 'Full Service', kiloAmount: 8, subtotal: 215, deliveryFee: 30, voucherDiscount: 0, totalAmount: 245,
  deliveryType: 'Deliver', scheduledDate: '2026-10-15', scheduledTime: '10:00 AM', paymentMethod: 'Cash on Delivery', status,
  createdAt: new Date().toISOString(), shop: shops[0], ...Object.fromEntries(Object.entries(user).filter(([key]) => ['address_line_1','city','state_province','country','postal_code','address_type'].includes(key))) }));
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
  const script = await command('Page.addScriptToEvaluateOnNewDocument',{source:`sessionStorage.setItem('auth_token','isolated-ui-test');sessionStorage.setItem('auth_user',${JSON.stringify(JSON.stringify(user))});`});
  sessionScriptId = script.identifier;
  await command('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 844 : 1000, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: `http://127.0.0.1:4178${route}` });
  await waitFor(`document.body?.innerText?.includes(${JSON.stringify(expected)})`);
  await pause(250);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, route + ' must fit viewport');
  const wrong = route.startsWith('/shop/') ? ['rgb(36, 87, 173)', 'rgb(56, 103, 255)'] : ['rgb(50, 16, 120)', 'rgb(104, 66, 217)'];
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
  const clicked = await evaluate(`(()=>{const e=Array.from(document.querySelectorAll('[role="button"],[role="tab"],a')).find(e=>e.innerText.trim()===${JSON.stringify(text)});if(e){e.click();return true}return false})()`);
  assert.ok(clicked,'Missing interactive control: '+text);
}
(async () => {
  if (photoTest) {
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
        if (!request.url.includes('/api/')) { await command('Fetch.continueRequest',{ requestId }); return; }
        const endpoint = new URL(request.url).pathname;
        const photoEndpoint = endpoint === '/api/shops/101/photo';
        assert.ok(['GET','OPTIONS'].includes(request.method) || photoTest && photoEndpoint && ['PUT','DELETE'].includes(request.method)
          || dialogTest && request.method === 'DELETE' && endpoint === '/api/shops/101/services/1'
          || approvalTest && request.method === 'PUT' && ['/api/admin/shops/101/review','/api/shops/101/application'].includes(endpoint)
          || applicationTest && request.method === 'POST' && endpoint === '/api/auth/verify-token'
          || approvalTest && request.method === 'POST' && endpoint === '/api/auth/login', 'UI smoke tests must not mutate real records');
        if (mode === 'loading') await pause(2500);
        if (closing) return;
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
        if (approvalTest && request.method === 'PUT') {
          const body = JSON.parse(request.postData);
          if (endpoint.includes('/review')) {
            assert.equal(body.expectedStatus, shops[0].approvalStatus); assert.equal(body.expectedVersion, shops[0].applicationVersion);
            shops[0].approvalStatus = body.status; shops[0].reviewReason = body.reason; shops[0].reviewedAt = new Date().toISOString();
            reviews.push(body);
          } else { Object.assign(shops[0], body, { approvalStatus: 'Pending', reviewReason: null, applicationVersion: shops[0].applicationVersion + 1 }); }
        }
        const data = ['/api/auth/login','/api/auth/verify-token'].includes(endpoint) ? { user, token: 'isolated-ui-test' } : endpoint.startsWith('/api/users/') ? user : endpoint === '/api/admin/shops' ? shops.map(shop => ({ ...shop, user, reviewedBy: user }))
          : endpoint === '/api/shops' ? mode==='empty'?[]:shops.filter(shop => shop.approvalStatus === 'Approved') : endpoint.startsWith('/api/shops/') ? shops[0] : endpoint.startsWith('/api/transactions/') ? mode==='empty'?[]:orders : [];
        await command('Fetch.fulfillRequest',{ requestId, responseCode: mode==='error'?503:200,
          responseHeaders: [{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'Content-Type, Authorization'}, {name:'Access-Control-Allow-Methods',value:'GET, PUT, DELETE, OPTIONS'}],
          body: Buffer.from(JSON.stringify(mode==='error'?{success:false,error:{message:'Test service unavailable'}}:{success:true,data})).toString('base64') });
      } catch(error) { if(!closing && !/Invalid InterceptionId|Target closed|Fetch domain is not enabled/.test(error.message)) console.error(error.message); }
    }
  });
  await command('Page.enable'); await command('Runtime.enable');
  await command('Fetch.enable',{ patterns:[{urlPattern:'*/api/*'}] });
  if (dialogTest) {
    const dialogVisible = '!!document.querySelector("[data-testid=app-dialog]")';
    const dialogClosed = '!document.querySelector("[data-testid=app-dialog]")';
    async function openDelete() {
      await waitFor('Array.from(document.querySelectorAll("[role=button]")).some(e=>e.innerText.trim()==="Delete"&&e.getAttribute("aria-disabled")!=="true")');
      await evaluate(`(()=>{const e=Array.from(document.querySelectorAll('[role="button"]')).find(e=>e.innerText.trim()==='Delete');e.focus();e.click();})()`);
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
    await clickText('Log In'); await waitFor('document.body.innerText.includes("Shop approvals")');
    assert.equal(await evaluate('location.pathname'),'/admin','Admin login opens the dashboard');
    for (const width of [390,1440]) await visit('/admin',width,'Shop approvals',`admin-approvals-${width}`);
    const navLabels = await evaluate(`Array.from(document.querySelectorAll('[role="tablist"] [role="tab"]')).map(e=>e.innerText.trim())`);
    assert.ok(navLabels.includes('Dashboard'),'Admin navigation includes Dashboard');
    assert.ok(!navLabels.some(label=>['Home','Activities','Profile','Orders','Services','Customers'].includes(label)),'Admin navigation is separate from customer and shop tabs');
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Back"]')`),false,'Admin dashboard has no back arrow');
    assert.ok(!(await evaluate('document.body.innerText')).includes('Customer View'),'No customer-mode switch');
    for (const path of ['/home','/profile','/shop/home','/register-shop']) {
      await visit(path,390,'Shop approvals');
      assert.equal(await evaluate('location.pathname'),'/admin','Admin direct links stay in the admin panel');
    }
    await command('Page.reload'); await waitFor('document.body.innerText.includes("Shop approvals")');
    await evaluate('history.back()'); await waitFor('document.body.innerText.includes("Shop approvals")');
    assert.equal(await evaluate('location.pathname'),'/admin','Browser Back keeps admins in their panel');
    await clickText('Dashboard');
    await clickText('Reject Application'); await clickText('Confirm Decision');
    await waitFor('document.body.innerText.includes("Enter a reason")'); assert.equal(reviews.length,0);
    await evaluate(`(()=>{const e=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Please correct your business contact.');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await clickText('Confirm Decision'); await waitFor('document.body.innerText.includes("No matching applications")');
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
    await clickText('Approve Shop'); await clickText('Confirm Decision'); await waitFor('document.body.innerText.includes("No matching applications")');
    user.isAdmin=false;
    await visit('/shop/home',390,'Recent transactions');
    user.isAdmin=true;
    await visit('/admin',390,'Shop approvals'); await clickText('Approved'); await clickText('Suspend Shop');
    await evaluate(`(()=>{const e=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Verification requires review.');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await clickText('Confirm Decision'); await waitFor('!document.body.innerText.includes("Test Laundry & Fabric Care")');
    user.isAdmin=false;
    await visit('/shop/home',390,'Verification requires review.','application-suspended');
    user.isAdmin=false; await visit('/admin',390,'Admin access required','admin-denied');
    assert.equal(await evaluate(`!!document.querySelector('[role="tab"][aria-label="Dashboard"]')`),false,'Customers do not receive admin navigation');
    user.isAdmin=true; await visit('/admin',390,'Shop approvals');
    await clickText('Sign Out'); await waitFor('document.body.innerText.includes("Log In")');
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
  for (const width of [320,390,768,1440]) {
    await visit('/home',width,'Test Laundry',width===390?'customer-phone':width===1440?'customer-desktop':undefined);
    await visit('/shop/home',width,'Recent transactions',width===390?'shop-phone':width===1440?'shop-desktop':undefined);
    await visit('/shop/transactions',width,'Test Customer');
  }
  for (const width of [390,1440]) for (const [route,expected] of [
    ['/activities','Order ID:'],['/profile','Personal Details'],['/shops/101','Browse services'],['/shops','All laundry shops'],
    ['/shop/services','Full Service'],['/shop/customers','New Orders'],['/shop/profile','Account Information'],['/shop/profile/security','Current Password'],
    ['/shop/customers/orders/42','Customer Details'],['/order/101','Review Order'],['/search','Search History']]) await visit(route,width,expected);
  await visit('/shop/transactions',390,'Test Customer');
  await clickText('Pending'); await pause(100);
  assert.ok(!(await evaluate('document.body.innerText')).includes('#43'), 'Pending filter excludes processing orders');
  await clickText('All');
  await visit('/shop/services',390,'Full Service'); await clickText('Add Service'); await waitFor('document.body.innerText.includes("Service Name")');
  await clickText('Cancel');
  await visit('/order/101',390,'Review Order');
  await evaluate(`document.querySelector('[role="checkbox"]').click()`); await clickText('Review Order'); await waitFor('document.body.innerText.includes("Place Order")');
  await visit('/search',390,'Search History');
  await evaluate(`(()=>{const e=document.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'no-such-shop');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor('document.body.innerText.includes("No laundry shops matched")');
  mode='empty'; await visit('/home',390,'No shops available yet'); await visit('/activities',390,'No recent transactions'); await visit('/shop/transactions',390,'No transactions found');
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
