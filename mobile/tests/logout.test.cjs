const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function compile(file, imports) {
  const exports = {};
  const source = fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: name => { assert.ok(name in imports, name); return imports[name]; }, console });
  return exports;
}

function storeHarness({ platform = 'web', failKey } = {}) {
  const values = new Map(), removed = [];
  const remove = key => { removed.push(key); if (key === failKey) throw new Error('Storage unavailable'); values.delete(key); };
  const { useAuthStore } = compile('store/authStore.ts', {
    zustand: { create: () => initializer => require('zustand/vanilla').createStore(initializer) },
    'react-native': { Platform: { OS: platform } },
    'expo-secure-store': { getItemAsync: async key => values.get(key), setItemAsync: async (key, value) => values.set(key, value), deleteItemAsync: async key => remove(key) },
  });
  return { useAuthStore, values, removed };
}

function nativeStore(failKey) { return storeHarness({ platform: 'android', failKey }); }

test('successful native logout clears credentials and the authenticated state', async () => {
  const app = nativeStore();
  await app.useAuthStore.getState().setAuth({ id: 7, name: 'User', isShopOwner: true }, 'test-token');
  await app.useAuthStore.getState().logout();
  assert.equal(app.values.size, 0); assert.equal(app.useAuthStore.getState().user, null); assert.equal(app.useAuthStore.getState().token, null);
});

test('a failed native logout retains in-memory state and restores partially removed credentials', async () => {
  for (const key of ['auth_token', 'auth_user']) {
    const app = nativeStore(key);
    const user = { id: 7, name: 'User', isShopOwner: true };
    await app.useAuthStore.getState().setAuth(user, 'test-token');
    await assert.rejects(app.useAuthStore.getState().logout());
    assert.equal(app.useAuthStore.getState().user, user);
    assert.equal(app.useAuthStore.getState().token, 'test-token');
    assert.equal(app.values.get('auth_token'), 'test-token'); assert.equal(JSON.parse(app.values.get('auth_user')).id, 7);
  }
});

function hookHarness({ failure, pending } = {}) {
  let dialog, finishDialog, ref;
  const calls = [];
  const { useLogout } = compile('design/useLogout.ts', {
    react: { useRef: value => ref ||= { current: value } },
    'expo-router': { router: { replace: route => calls.push(['navigate', route]) } },
    '@tanstack/react-query': { useQueryClient: () => ({ cancelQueries: async () => calls.push(['cancelQueries']), clear: () => calls.push(['clear']) }) },
    '../store/authStore': { useAuthStore: { getState: () => ({ logout: async () => { calls.push(['logout']); if (failure) throw failure; if (pending) await pending; } }) } },
    '../services/socket.service': { socketService: { disconnect: () => calls.push(['disconnect']) } },
    './dialog-service': { showDialog: options => { dialog = options; return new Promise(resolve => { finishDialog = resolve; }); } },
  });
  return { request: useLogout(), calls, get dialog() { return dialog; }, dismiss: () => finishDialog(false) };
}

test('opening and cancelling logout never navigates, clears cache or changes authentication', async () => {
  const app = hookHarness();
  const result = app.request();
  assert.equal(app.dialog.message, 'Are you sure you want to log out?'); assert.equal(app.dialog.confirmLabel, 'Log Out'); assert.equal(app.dialog.backdrop, 'blur');
  assert.deepEqual(app.calls, []);
  await app.request(); assert.deepEqual(app.calls, [], 'Repeated clicks do not create another logout');
  app.dismiss(); await result; assert.deepEqual(app.calls, []);
});

test('logout redirects and clears cached data only after the existing async logout succeeds', async () => {
  let finish;
  const app = hookHarness({ pending: new Promise(resolve => { finish = resolve; }) });
  const request = app.request();
  const confirm = app.dialog.onConfirm();
  assert.deepEqual(app.calls, [['logout']]);
  finish(); await confirm;
  assert.deepEqual(app.calls, [['logout'], ['cancelQueries'], ['clear'], ['disconnect'], ['navigate', '/(auth)/login']]);
  app.dismiss(); await request;
});

test('logout errors preserve the current page and application cache', async () => {
  const app = hookHarness({ failure: new Error('Secure storage unavailable') });
  const request = app.request();
  await assert.rejects(app.dialog.onConfirm(), /couldn't log you out/);
  assert.deepEqual(app.calls, [['logout']]);
  app.dismiss(); await request;
});

function nativeDialogHarness() {
  const service = compile('design/dialog-service.ts', {});
  const react = require('react');
  const { AppDialogHost } = compile('design/AppDialogHost.tsx', {
    react: { useEffect() {}, useRef: value => ({ current: value }), useState: value => [value, () => {}], useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390 }), Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View',
      StyleSheet: { absoluteFill: {} }, AccessibilityInfo: {}, Animated: { Value: class { interpolate() { return 1; } }, View: 'AnimatedView' } },
    'expo-router': { usePathname: () => '/shop/profile' },
    'expo-blur': { BlurView: 'BlurView' },
    'lucide-react-native': Object.fromEntries(['CircleHelp','Info','LogOut','Trash2','X'].map(name => [name,name])),
    '../store/authStore': { useAuthStore: select => select({ user: { id: 7 } }) },
    './ui': { Button: 'Button', Txt: 'Txt', usePalette: () => ({ primary: 'blue', muted: 'gray', line: 'gray', soft: 'white', ink: 'black' }) },
    './dialog-service': service,
  });
  function elements(element, type) {
    if (Array.isArray(element)) return element.flatMap(child => elements(child, type));
    if (!react.isValidElement(element)) return [];
    return [...(element.type === type ? [element] : []), ...elements(element.props.children, type)];
  }
  return { service, render: AppDialogHost, elements };
}

test('Android native back dismisses the actual logout modal without executing logout', async () => {
  const app = nativeDialogHarness();
  let calls = 0;
  const result = app.service.showDialog({ title: 'Log out?', message: 'Are you sure you want to log out?', kind: 'confirm', backdrop: 'blur', onConfirm: async () => { calls++; } });
  const target = { current: { nativeTag: 1 } };
  const modal = app.render({ blurTarget: target });
  assert.equal(modal.type, 'Modal');
  const blur = app.elements(modal, 'BlurView')[0];
  assert.equal(blur.props.blurTarget, target); assert.equal(blur.props.blurMethod, 'dimezisBlurView');
  modal.props.onRequestClose();
  assert.equal(await result, false); assert.equal(calls, 0);
});

test('Android back cannot interrupt a logout already being committed', async () => {
  const app = nativeDialogHarness();
  let finish;
  const result = app.service.showDialog({ title: 'Log out?', message: 'Confirm logout', kind: 'confirm', onConfirm: () => new Promise(resolve => { finish = resolve; }) });
  const id = app.service.getDialog().id;
  app.service.settleDialog(id, true);
  app.render({}).props.onRequestClose();
  assert.equal(app.service.getDialog().busy, true);
  finish(); assert.equal(await result, true);
});
