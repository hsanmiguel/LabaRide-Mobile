const assert = require('node:assert/strict');
const { test } = require('node:test');
const { startProcessingTimerSchema } = require('../dist/validators/transaction.validator');
const databasePath = require.resolve('../dist/config/database');
const db = {};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const { TransactionController } = require('../dist/controllers/transaction.controller');

function fixture(fields={}) {
  const old = new Date('2020-01-01T00:00:00Z');
  const row = { id:64, userId:17, shopId:101, serviceName:'Wash Only', status:'Processing', workflowStatus:null, processingStartedAt:old,
    washingStartedAt:null, dryingStartedAt:null, washingMinutes:null, dryingMinutes:null, shop:{userId:7,approvalStatus:'Approved'}, ...fields };
  const services = [{serviceName:'Wash Only',washingMinutes:30,dryingMinutes:45}];
  let writes=0, chain=Promise.resolve();
  const notices=[], events=[], operations=[];
  db.$transaction = callback => { const job=chain.then(()=>callback(db)); chain=job.catch(()=>{}); return job; };
  db.$queryRaw = async () => { operations.push('lock'); return []; };
  db.transaction = {
    findUnique:async({where})=>{ operations.push('read'); return where.id===64?row:null; },
    update:async({data})=>{ writes++; Object.assign(row,data); const {shop,...order}=row; return {...order}; },
  };
  db.shopService={findMany:async()=>services};
  db.notification={createMany:async({data})=>{notices.push(...data);return{count:data.length};}};
  async function start(phase,userId=7,id='64') {
    let error;
    const res={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    const req={params:{id},body:{phase},user:{userId},app:{get:()=>({to:room=>({emit:(name,payload)=>events.push({room,name,payload})})})}};
    await TransactionController.startTimer(req,res,failure=>{error=failure;});
    return {res,error};
  }
  return{row,old,services,start,notices,events,operations,writes:()=>writes};
}

test('manual start is restricted to the owning approved shop and original processing orders', async()=>{
  for(const who of [17,9]) {
    const f=fixture(); assert.equal((await f.start('washing',who)).error.statusCode,403); assert.equal(f.writes(),0);
  }
  const unapproved=fixture({shop:{userId:7,approvalStatus:'Suspended'}});
  assert.equal((await unapproved.start('washing')).error.statusCode,403);
  for(const status of ['Pending','Accepted','Queued','Ready','Completed','Cancelled']) {
    const f=fixture({status}); assert.equal((await f.start('washing')).error.statusCode,409); assert.equal(f.writes(),0);
  }
  const managed=fixture({workflowStatus:'Washing'});
  assert.equal((await managed.start('washing')).error.statusCode,409);
  assert.equal((await fixture().start('washing',7,'999')).error.statusCode,404);
});

test('washing uses the server clock, preserves processing time and stays unchanged on duplicate/concurrent starts',async()=>{
  const f=fixture(), before=Date.now();
  const results=await Promise.all([f.start('washing'),f.start('washing')]);
  assert.ok(results.every(result=>!result.error));
  assert.equal(f.writes(),1);
  assert.equal(f.row.processingStartedAt,f.old);
  assert.ok(f.row.washingStartedAt.getTime()>=before && f.row.washingStartedAt.getTime()<=Date.now());
  assert.equal(f.row.dryingStartedAt,null);
  assert.equal(f.row.washingMinutes,30); assert.equal(f.row.dryingMinutes,45);
  assert.equal(f.notices.length,2); assert.equal(f.events.length,2);
  assert.deepEqual(f.operations,['lock','read','lock','read']);
  const saved=f.row.washingStartedAt; f.services[0].washingMinutes=90;
  await f.start('washing'); assert.equal(f.row.washingStartedAt,saved); assert.equal(f.row.washingMinutes,30);
});

test('drying waits for manual washing and records its own real start even after an overdue wash',async()=>{
  const f=fixture();
  assert.match((await f.start('drying')).error.message,/Start washing/);
  assert.equal(f.writes(),0);
  await f.start('washing');
  f.row.washingStartedAt=new Date(Date.now()-2*3600000);
  const wash=f.row.washingStartedAt, before=Date.now(); f.services[0].dryingMinutes=90;
  assert.equal(f.row.dryingStartedAt,null);
  assert.equal((await f.start('drying')).error,undefined);
  assert.ok(f.row.dryingStartedAt.getTime()>=before);
  assert.equal(f.row.washingStartedAt,wash); assert.equal(f.row.dryingMinutes,45);
  const dry=f.row.dryingStartedAt; await f.start('drying'); assert.equal(f.row.dryingStartedAt,dry);
  assert.equal(f.notices.length,4); assert.equal(f.events.length,4);
});

test('unconfigured durations give an actionable error without starting, and client timestamps are rejected',async()=>{
  const f=fixture(); f.services[0].washingMinutes=null;
  assert.match((await f.start('washing')).error.message,/duration in Services/);
  assert.equal(f.row.washingStartedAt,null); assert.equal(f.writes(),0);
  f.services[0].washingMinutes=30; assert.equal((await f.start('washing')).error,undefined);
  for(const body of [{phase:'other'},{phase:'washing',washingStartedAt:'2020-01-01T00:00:00Z'},{phase:'drying',duration:1}])
    assert.equal(startProcessingTimerSchema.safeParse({params:{id:'64'},body}).success,false);
});
