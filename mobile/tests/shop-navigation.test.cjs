const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
const { getRoutes } = require("expo-router/build/getRoutesCore");
const { getReactNavigationConfig } = require("expo-router/build/getReactNavigationConfig");

// Run Expo's real URL matcher in Node without importing the native UI bridge.
// Its sole bridge dependency is the real, platform-independent path validator.
const bridgeFile = require.resolve("expo-router/build/react-navigation/native");
const originalBridge = require.cache[bridgeFile];
const validatorBridge = new Module(bridgeFile, module);
validatorBridge.exports = require("expo-router/build/react-navigation/core/validatePathConfig");
validatorBridge.loaded = true;
let getStateFromPath;
let getPathFromState;
try {
  require.cache[bridgeFile] = validatorBridge;
  ({ getStateFromPath } = require("expo-router/build/fork/getStateFromPath"));
  ({ getPathFromState } = require("expo-router/build/fork/getPathFromState"));
} finally {
  if (originalBridge) require.cache[bridgeFile] = originalBridge;
  else delete require.cache[bridgeFile];
}

const appDirectory = path.resolve(__dirname, "../app");
const keys = fs.readdirSync(appDirectory, { recursive: true })
  .filter((file) => /\.[jt]sx?$/.test(file))
  .map((file) => `./${file.replaceAll(path.sep, "/")}`);
// Only the file tree is needed here; UI modules belong to the native runtime.
const context = () => ({});
context.keys = () => keys;
const routes = getRoutes(context, { platform: "web", ignoreEntryPoints: true });
const config = getReactNavigationConfig(routes, true);
const tabs = ["home", "transactions", "services", "customers", "profile"];

const targetFile = path.resolve(__dirname, "../src/navigation/flow-target.ts");
const targetModule = new Module(targetFile, module);
targetModule._compile(ts.transpileModule(fs.readFileSync(targetFile, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, targetFile);
const { flowTarget, legacyShopFlows } = targetModule.exports;

function focusedRoutes(state) {
  assert.ok(state, "URL must resolve to navigation state");
  const route = state.routes[state.index ?? state.routes.length - 1];
  return [route.name, ...(route.state ? focusedRoutes(route.state) : [])];
}

for (const tab of tabs) {
  test(`direct access and refresh of /shop/${tab} select the shared shop layout`, () => {
    const url = `/shop/${tab}`;
    const state = getStateFromPath(url, config);
    assert.deepEqual(focusedRoutes(state), ["shop", tab, "index"]);
    assert.equal(getPathFromState(state, config), url);
    const refreshed = getStateFromPath(getPathFromState(state, config), config);
    assert.deepEqual(focusedRoutes(refreshed), ["shop", tab, "index"]);
  });

  test(`Profile and ${tab} navigation stay in shop mode`, () => {
    assert.deepEqual(
      focusedRoutes(getStateFromPath("/shop/profile", config, ["shop", tab])),
      ["shop", "profile", "index"],
    );
    assert.deepEqual(
      focusedRoutes(getStateFromPath(`/shop/${tab}`, config, ["shop", "profile"])),
      ["shop", tab, "index"],
    );
  });

  test(`secondary screens stay beneath the ${tab} tab`, () => {
    const target = flowTarget("security", { method: "Email", id: "42" }, ["shop", tab, "index"]);
    const url = target.pathname.replace("[flow]", target.params.flow);
    const state = getStateFromPath(url, config);
    assert.deepEqual(focusedRoutes(state), ["shop", tab, "[flow]"]);
    assert.equal(getPathFromState(state, config), url);
    assert.deepEqual(target.params, { method: "Email", id: "42", flow: "security" });
    // Deeper actions and replacements retain the current tab as well.
    const next = flowTarget("enter-2fa", { method: "Email" }, ["shop", tab, "[flow]"]);
    assert.equal(next.pathname, `/shop/${tab}/[flow]`);
    for (const otherTab of tabs) {
      assert.deepEqual(
        focusedRoutes(getStateFromPath(`/shop/${otherTab}`, config, ["shop", tab, "[flow]"])),
        ["shop", otherTab, "index"],
      );
    }
  });
}

test("all five pages belong to the same shop navigator", () => {
  const shopLayout = routes.children.find((route) => route.route === "shop");
  assert.ok(shopLayout);
  assert.equal(shopLayout.contextKey, "./shop/_layout.tsx");
  for (const tab of tabs) {
    const tabStack = shopLayout.children.find((route) => route.route === tab);
    assert.ok(tabStack);
    assert.equal(tabStack.type, "layout");
    assert.ok(tabStack.children.some((route) => route.route === "index"));
    assert.ok(tabStack.children.some((route) => route.route === "[flow]"));
  }
});

test("customer mode remains separate, including deliberate mode switches", () => {
  assert.deepEqual(focusedRoutes(getStateFromPath("/profile", config)), ["(user)", "profile/index"]);
  assert.deepEqual(focusedRoutes(getStateFromPath("/home", config)), ["(user)", "home"]);
  assert.deepEqual(
    focusedRoutes(getStateFromPath("/(user)/profile", config, ["shop", "profile"])),
    ["(user)", "profile/index"],
  );
  assert.deepEqual(
    focusedRoutes(getStateFromPath("/shop/profile", config, ["(user)", "profile"])),
    ["shop", "profile", "index"],
  );
});

test("profile settings, notifications, filtered customers, and order actions refresh in shop mode", () => {
  const pages = [
    ["profile", "account-information"], ["profile", "shop-details"],
    ["profile", "security"], ["profile", "change-password"],
    ["profile", "choose-2fa"], ["profile", "enter-2fa"], ["profile", "logout"],
    ["home", "shop-notifications"], ["home", "shop-location"],
    ["home", "shop-information"], ["home", "shop-menu"], ["home", "checkout"],
    ["transactions", "shop-transaction"], ["customers", "shop-customers"],
    ["customers", "decline-order"], ["customers", "decline-busy"],
    ["customers", "order-declined"],
  ];
  for (const [tab, screen] of pages) {
    const url = `/shop/${tab}/${screen}?id=42&status=Pending`;
    const state = getStateFromPath(url, config);
    assert.deepEqual(focusedRoutes(state), ["shop", tab, "[flow]"]);
    const refreshed = getStateFromPath(getPathFromState(state, config), config);
    assert.deepEqual(focusedRoutes(refreshed), ["shop", tab, "[flow]"]);
  }
});

test("order details belong to the Customers stack rather than an extra hidden tab", () => {
  const state = getStateFromPath("/shop/customers/orders/42", config);
  assert.deepEqual(focusedRoutes(state), ["shop", "customers", "orders/[id]"]);
  assert.equal(getPathFromState(state, config), "/shop/customers/orders/42");
});

test("legacy shop flows redirect to pages inside the same five-tab shell", () => {
  for (const [screen, tab] of Object.entries(legacyShopFlows)) {
    const target = flowTarget(screen, { id: "42" }, ["shop", tab]);
    const state = getStateFromPath(target.pathname.replace("[flow]", screen), config);
    assert.deepEqual(focusedRoutes(state), ["shop", tab, "[flow]"]);
  }
});

test("customer flows stay unchanged and account deletion leaves the signed-in shell", () => {
  assert.equal(flowTarget("checkout", {}, ["(user)", "home"]).pathname, "/(flows)/[flow]");
  assert.equal(flowTarget("account-deleted", {}, ["shop", "profile", "[flow]"]).pathname, "/(flows)/[flow]");
});
