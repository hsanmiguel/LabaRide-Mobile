const assert=require('node:assert/strict');
const{test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const compiled={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/design/job-route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(compiled,compiled.exports);
const{directionsUrl,parseRoadRoute,validRoutePoint}=compiled.exports;
test('directions preserve pickup-to-destination order in longitude-latitude format, including zero',()=>{
 const url=new URL(directionsUrl({latitude:0,longitude:1},{latitude:2,longitude:3},'pk.test'));
 assert.ok(url.pathname.endsWith('/1,0;3,2'));
 assert.equal(url.searchParams.get('geometries'),'geojson');
 assert.equal(validRoutePoint(null),false);
 assert.throws(()=>directionsUrl({latitude:91,longitude:1},{latitude:0,longitude:0},'test'),/invalid/);
});
test('road routes require real valid geometry and finite distance/duration; errors never become a straight-line fallback',()=>{
 const valid={code:'Ok',routes:[{distance:1500,duration:360,geometry:{type:'LineString',coordinates:[[123.19,13.62],[123.191,13.625],[123.2,13.63]]}}]};
 assert.deepEqual(parseRoadRoute(valid),{coordinates:valid.routes[0].geometry.coordinates,distanceMeters:1500,durationSeconds:360});
 for(const payload of [null,{code:'NoRoute',routes:[]},{...valid,routes:[{...valid.routes[0],duration:-1}]},{...valid,routes:[{...valid.routes[0],geometry:{type:'LineString',coordinates:[[NaN,13],[123,14]]}}]}]) assert.throws(()=>parseRoadRoute(payload),/No driving route/);
});
