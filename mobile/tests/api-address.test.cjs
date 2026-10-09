const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

const file = path.resolve(__dirname, "../src/api/api-address.ts");
const compiled = new Module(file, module);
compiled._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, file);
const { resolveApiUrl, connectionErrorMessage } = compiled.exports;
const native = { platform: "android", development: true, expoHostUri: "192.168.1.113:8081" };

test("Expo Go without an env URL reaches the development computer", () => {
  assert.equal(resolveApiUrl(native), "http://192.168.1.113:5001");
});

test("stale localhost configuration uses the development computer and preserves the backend port", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.equal(resolveApiUrl({ ...native, configuredUrl: `http://${host}:5001` }), "http://192.168.1.113:5001");
  }
  assert.equal(resolveApiUrl({ ...native, configuredUrl: "http://localhost:7000/backend/" }), "http://192.168.1.113:7000/backend");
  assert.equal(resolveApiUrl({ ...native, platform: "ios", configuredUrl: "http://localhost:5001" }), "http://192.168.1.113:5001");
});

test("explicit LAN, emulator, and hosted addresses are preserved", () => {
  for (const configuredUrl of ["http://192.168.1.50:5001", "http://10.0.2.2:5001", "https://api.example.com"]) {
    assert.equal(resolveApiUrl({ ...native, configuredUrl }), configuredUrl);
  }
  assert.equal(resolveApiUrl({ ...native, configuredUrl: "  https://api.example.com/  " }), "https://api.example.com");
});

test("web and production do not infer their backend from Expo", () => {
  assert.equal(resolveApiUrl({ ...native, platform: "web" }), "http://localhost:5001");
  assert.equal(resolveApiUrl({ ...native, development: false, configuredUrl: "https://api.example.com" }), "https://api.example.com");
});

test("the shared localhost setting follows Wi-Fi changes in Expo Go and stays local in web", () => {
  const configuredUrl = "http://localhost:5001";
  for (const host of ["192.168.1.113", "192.168.1.106"]) {
    const options = { ...native, configuredUrl, expoHostUri: `${host}:8081` };
    assert.equal(resolveApiUrl(options), `http://${host}:5001`);
    assert.equal(resolveApiUrl({ ...options, platform: "web" }), configuredUrl);
  }
});

test("private development networks use the host rather than Metro's port", () => {
  for (const host of ["10.0.0.5", "172.16.0.5", "172.31.0.5", "192.168.2.10"]) {
    assert.equal(resolveApiUrl({ ...native, expoHostUri: `http://${host}:8082` }), `http://${host}:5001`);
  }
});

test("Expo tunnel and missing manifests are not mistaken for backend addresses", () => {
  for (const expoHostUri of [undefined, "localhost:8081", "project.exp.direct", "192.168.1.113.exp.direct:8081", "172.32.0.5:8081", "invalid host"]) {
    assert.equal(resolveApiUrl({ ...native, expoHostUri, configuredUrl: "https://api.example.com" }), "https://api.example.com");
    assert.equal(resolveApiUrl({ ...native, expoHostUri }), "http://localhost:5001");
  }
});

test("the Expo native URL implementation also resolves the LAN address", () => {
  const nodeUrl = globalThis.URL;
  try {
    globalThis.URL = require("whatwg-url-minimum").URL;
    assert.equal(resolveApiUrl(native), "http://192.168.1.113:5001");
    assert.equal(resolveApiUrl({ ...native, configuredUrl: "http://localhost:5001" }), "http://192.168.1.113:5001");
  } finally {
    globalThis.URL = nodeUrl;
  }
});

test("network errors report the actual destination and distinguish timeouts", () => {
  assert.match(connectionErrorMessage("http://192.168.1.113:5001"), /Cannot connect.*192\.168\.1\.113:5001/);
  assert.match(connectionErrorMessage("http://192.168.1.113:5001"), /http:\/\/192\.168\.1\.113:5001\/health/);
  assert.match(connectionErrorMessage("http://192.168.1.113:5001", true), /did not respond in time/);
});

test("browser connection errors give browser instructions instead of Expo Go instructions", () => {
  const message = connectionErrorMessage("http://localhost:5001", false, "web");
  assert.match(message, /http:\/\/localhost:5001\/health/);
  assert.match(message, /in your browser/);
  assert.match(message, /refresh this page/);
  assert.doesNotMatch(message, /phone|Expo Go|QR code/);
  assert.match(connectionErrorMessage("not a URL", false, "web"), /restart Expo and refresh this page/);
});

test("connection errors do not expose URL credentials or query secrets", () => {
  const message = connectionErrorMessage("https://private-user:private-password@api.example.com?token=private-token");
  assert.match(message, /https:\/\/api\.example\.com/);
  assert.doesNotMatch(message, /private-user|private-password|private-token|token=/);
  assert.match(connectionErrorMessage("not a URL"), /backend URL is invalid/);
});
