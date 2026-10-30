const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function setup(polling = false) {
  const handlers = {}, rooms = [];
  let connections = 0;
  const socket = { on: (event, handler) => { handlers[event] = handler; }, emit: (...args) => rooms.push(args), disconnect: () => handlers.disconnect?.() };
  const compiled = { exports: {} };
  const dependencies = {
    'socket.io-client': { io: () => { connections++; return socket; } },
    '../api/client': { API_URL: 'https://example.test' },
    '../store/authStore': { useAuthStore: { getState: () => ({ token: 'test' }) } },
  };
  new Function('module', 'exports', 'require', 'process', 'console', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/services/socket.service.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(compiled, compiled.exports, dependency => dependencies[dependency], { env: { EXPO_PUBLIC_REALTIME_MODE: polling ? 'polling' : undefined } }, { log() {} });
  return { service: compiled.exports.socketService, handlers, rooms, connections: () => connections };
}

test('connection subscribers track reconnects, room membership survives reconnect, and cleanup removes subscribers', () => {
  const { service, handlers, rooms, connections } = setup();
  const updates = [];
  const unsubscribe = service.subscribeConnection(() => updates.push(service.getConnectionStatus()));
  assert.equal(service.getConnectionStatus(), 'polling');
  service.joinUserRoom(7); service.joinShopRoom(101);
  assert.equal(connections(), 1);
  handlers.connect(); handlers.connect(); handlers.disconnect(); handlers.connect();
  assert.deepEqual(updates, ['connected', 'polling', 'connected']);
  assert.deepEqual(rooms.slice(-2), [['join_user_room', { user_id: 7 }], ['join_shop_room', { shop_id: 101 }]]);
  unsubscribe(); service.disconnect();
  assert.equal(service.getConnectionStatus(), 'polling');
  assert.equal(updates.length, 3);
});

test('polling mode never claims to have a live socket connection', () => {
  const { service, connections } = setup(true);
  service.joinShopRoom(101);
  assert.equal(service.getConnectionStatus(), 'polling');
  assert.equal(connections(), 0);
});
