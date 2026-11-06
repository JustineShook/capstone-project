import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../utils/owner/getBookingLocation.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const NOW = 1_800_000_000_000;
const fix = (overrides = {}) => ({ timestamp: NOW, coords: { latitude: 14.6, longitude: 121.02, accuracy: 10 }, ...overrides });
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function harness(platform, plan = () => {}) {
  let clock = NOW;
  let nextTimer = 0;
  const timers = new Map();
  const calls = [];
  const subscriptions = [];
  const location = { Accuracy: { High: 4 }, watchPositionAsync: (options, success, failure) => {
    const subscription = { removed: 0, remove() { this.removed++; } };
    subscriptions.push(subscription);
    const call = { options, success, failure, subscription, now: clock };
    calls.push(call);
    return plan(call, calls.length) ?? Promise.resolve(subscription);
  } };
  const module = { exports: {} };
  const context = {
    module, exports: module.exports, Date: { now: () => clock },
    setTimeout: (callback, ms) => { const id = ++nextTimer; timers.set(id, { at: clock + ms, callback }); return id; },
    clearTimeout: id => timers.delete(id),
    navigator: { geolocation: { getCurrentPosition: (success, failure, options) => {
      const call = { success, failure, options };
      calls.push(call);
      plan(call, calls.length);
    } } },
    require: name => {
      if (name === "expo-location") return location;
      assert.equal(name, "react-native");
      return { Platform: { OS: platform } };
    },
  };
  runInNewContext(compiled, context, { filename: "getBookingLocation.ts" });
  return { capture: module.exports.getBookingLocation, calls, subscriptions, timers, context,
    async tick(ms) {
      clock += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
      await flush();
    },
  };
}

test("web requires a fresh high-accuracy fix with caching disabled and preserves coordinate order", async () => {
  const h = harness("web", call => call.success(fix()));
  const result = await h.capture();
  assert.equal(result.coords.latitude, 14.6);
  assert.equal(result.coords.longitude, 121.02);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.enableHighAccuracy, true);
  assert.equal(h.calls[0].options.maximumAge, 0);
  assert.equal(h.calls[0].options.timeout, 10_000);
  assert.equal(h.timers.size, 0);
});

test("web rejects a stale fix before accepting a subsequent fresh fix", async () => {
  const h = harness("web", (call, count) => call.success(fix({ timestamp: count === 1 ? NOW - 10_001 : NOW })));
  await h.capture();
  assert.equal(h.calls.length, 2);
  assert.equal(h.timers.size, 0);
});

test("documented acceptance boundaries allow 10-second age, 50m uncertainty, and zero coordinates", async () => {
  const h = harness("web", call => call.success(fix({ timestamp: NOW - 10_000, coords: { latitude: 0, longitude: 0, accuracy: 50 } })));
  const result = await h.capture();
  assert.equal(result.coords.latitude, 0);
  assert.equal(result.coords.longitude, 0);
});

for (const [label, value, message] of [
  ["poor accuracy", fix({ coords: { latitude: 14, longitude: 121, accuracy: 51 } }), /50 metres or better/],
  ["missing accuracy", fix({ coords: { latitude: 14, longitude: 121, accuracy: null } }), /valid GPS accuracy/],
  ["nonfinite accuracy", fix({ coords: { latitude: 14, longitude: 121, accuracy: NaN } }), /valid GPS accuracy/],
  ["negative accuracy", fix({ coords: { latitude: 14, longitude: 121, accuracy: -1 } }), /valid GPS accuracy/],
  ["invalid latitude", fix({ coords: { latitude: 91, longitude: 121, accuracy: 10 } }), /invalid GPS coordinates/],
  ["invalid longitude", fix({ coords: { latitude: 14, longitude: -181, accuracy: 10 } }), /invalid GPS coordinates/],
  ["nonfinite coordinates", fix({ coords: { latitude: NaN, longitude: 121, accuracy: 10 } }), /invalid GPS coordinates/],
  ["invalid timestamp", fix({ timestamp: NaN }), /invalid timestamp/],
  ["missing timestamp", fix({ timestamp: undefined }), /invalid timestamp/],
  ["future timestamp", fix({ timestamp: NOW + 1_001 }), /invalid timestamp/],
]) test(`web never silently accepts ${label}`, async () => {
  const h = harness("web", call => call.success(value));
  await assert.rejects(h.capture(), error => {
    assert.match(error.message, message);
    assert.match(error.message, /Booking was not sent.*Confirm Booking to retry/);
    return true;
  });
  assert.equal(h.calls.length, 3);
  assert.equal(h.timers.size, 0);
});

test("web permission denial stops immediately and does not retry", async () => {
  const h = harness("web", call => call.failure({ code: 1 }));
  await assert.rejects(h.capture(), /permission was denied.*browser settings/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.timers.size, 0);
});

test("web unavailable and timed-out fixes retry only three times", async () => {
  for (const code of [2, 3]) {
    const h = harness("web", call => call.failure({ code }));
    await assert.rejects(h.capture(), /Booking was not sent/);
    assert.equal(h.calls.length, 3);
  }
});

test("web missing geolocation reports a clear error without retry timers", async () => {
  const h = harness("web");
  delete h.context.navigator.geolocation;
  await assert.rejects(h.capture(), /unavailable in this browser/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers.size, 0);
});

test("Android waits for improved accuracy within an attempt and removes its temporary watcher", async () => {
  const h = harness("android");
  const pending = h.capture();
  h.calls[0].success(fix({ coords: { latitude: 14, longitude: 121, accuracy: 200 } }));
  await flush();
  assert.equal(h.subscriptions[0].removed, 0);
  h.calls[0].success(fix());
  const result = await pending;
  assert.equal(result.coords.latitude, 14.6);
  assert.equal(h.calls[0].options.accuracy, 4);
  assert.equal(h.calls[0].options.timeInterval, 1_000);
  assert.equal(h.calls[0].options.distanceInterval, 0);
  assert.equal(h.subscriptions[0].removed, 1);
  assert.equal(h.calls.length, 1);
  assert.equal(h.timers.size, 0);
});

for (const stale of [false, true]) test(`Android rejects ${stale ? "stale" : "poor"} fixes through all three bounded attempts`, async () => {
  const h = harness("android", call => call.success(fix({ timestamp: call.now - (stale ? 10_001 : 0), coords: { latitude: 14, longitude: 121, accuracy: stale ? 10 : 200 } })));
  const pending = assert.rejects(h.capture(), stale ? /out of date.*Booking was not sent/ : /GPS uncertainty.*Booking was not sent/);
  await flush();
  for (let i = 0; i < 3; i++) await h.tick(10_000);
  await pending;
  assert.equal(h.calls.length, 3);
  assert(h.subscriptions.every(s => s.removed === 1));
  assert.equal(h.timers.size, 0);
});

test("synchronous browser GPS failure clears its watchdog and stops retrying", async () => {
  const h = harness("web", () => { throw new Error("SecurityError"); });
  await assert.rejects(h.capture(), /Could not access browser GPS/);
  assert.equal(h.calls.length, 1);
  assert.equal(h.timers.size, 0);
});

test("Android permission errors stop immediately; temporary startup failure can retry", async () => {
  const denied = harness("android", () => Promise.reject(new Error("Location permission denied")));
  await assert.rejects(denied.capture(), /Enable location access in device settings/);
  assert.equal(denied.calls.length, 1);
  assert.equal(denied.timers.size, 0);
  const transient = harness("android", (call, attempt) => {
    if (attempt === 1) return Promise.reject(new Error("GPS temporarily unavailable"));
    call.success(fix());
  });
  await transient.capture();
  await flush();
  assert.equal(transient.calls.length, 2);
  assert.equal(transient.subscriptions[1].removed, 1);
});

test("Android hanging startup respects the 30s budget and removes late subscriptions", async () => {
  const resolvers = [];
  const h = harness("android", call => new Promise(resolve => resolvers.push(() => resolve(call.subscription))));
  const pending = assert.rejects(h.capture(), /took too long.*Booking was not sent/);
  for (let i = 0; i < 3; i++) await h.tick(10_000);
  await pending;
  assert.equal(h.calls.length, 3);
  resolvers.forEach(resolve => resolve());
  await flush();
  assert(h.subscriptions.every(s => s.removed === 1));
  h.calls[0].success(fix()); // A late fix cannot restart capture or create a booking.
  assert.equal(h.calls.length, 3);
  assert.equal(h.timers.size, 0);
});

test("web hanging callbacks respect the same timeout budget and ignore late fixes", async () => {
  const h = harness("web");
  const pending = assert.rejects(h.capture(), /took too long.*Confirm Booking to retry/);
  for (let i = 0; i < 3; i++) await h.tick(10_000);
  await pending;
  h.calls[0].success(fix());
  assert.equal(h.calls.length, 3);
  assert.equal(h.timers.size, 0);
});

test("Android watcher permission denial also stops retries and removes the watcher", async () => {
  const h = harness("android", call => call.failure("Location permission denied"));
  await assert.rejects(h.capture(), /Enable location access in device settings/);
  await flush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.subscriptions[0].removed, 1);
  assert.equal(h.timers.size, 0);
});

const screenSource = readFileSync(new URL("../app/(v_owner)/mechanic-booking/book-mechanic.tsx", import.meta.url), "utf8");
const screen = ts.createSourceFile("book-mechanic.tsx", screenSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let submitExpression;
function findSubmit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(screen) === "handleConfirm") submitExpression = node.initializer.getText(screen);
  ts.forEachChild(node, findSubmit);
}
findSubmit(screen);

function submissionFixture({ permission = "granted", capture = async () => fix(), submitting = false } = {}) {
  const calls = { booking: [], loading: [], errors: [], navigation: [], review: [], capture: 0, permission: 0 };
  const timing = { timingMode: "scheduled", urgency: "standard", scheduledAt: "2030-01-01T08:00:00Z" };
  const context = {
    Error, canConfirm: true, submitting,
    selectedVehicle: { vehicleId: "vehicle", make: "Toyota", model: "Vios", year: 2020, plateNumber: "ABC123" },
    provider: { id: "mechanic", name: "Fixture Mechanic", phone: "09171234567", startingPrice: "Price on assessment" },
    selectedProblem: "Battery", notes: "Parked by the gate", timing,
    Location: { requestForegroundPermissionsAsync: async () => { calls.permission++; return { status: permission }; } },
    getBookingLocation: async () => { calls.capture++; return capture(); },
    createBooking: async payload => { calls.booking.push(payload); return { id: "booking" }; },
    setSubmitting: value => calls.loading.push(value), setReviewVisible: value => calls.review.push(value),
    router: { replace: route => calls.navigation.push(route) }, Alert: { alert: (...args) => calls.errors.push(args) },
  };
  assert.ok(submitExpression);
  const code = ts.transpileModule(`(${submitExpression})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return { calls, timing, submit: () => runInNewContext(code, context) };
}

test("new mechanic submission preserves payload, permission check, loading, review and navigation", async () => {
  const h = submissionFixture();
  await h.submit();
  assert.equal(h.calls.permission, 1);
  assert.equal(h.calls.capture, 1);
  assert.equal(JSON.stringify(h.calls.booking[0]), JSON.stringify({ providerId: "mechanic", providerName: "Fixture Mechanic",
    providerPhone: "09171234567", vehicleId: "vehicle", vehicle: "Toyota Vios", vehicleYear: 2020,
    vehiclePlate: "ABC123", latitude: 14.6, longitude: 121.02, problem: "Battery", notes: "Parked by the gate",
    startingPrice: "Price on assessment", timing: h.timing }));
  assert.deepEqual(h.calls.loading, [true, false]);
  assert.deepEqual(h.calls.review, [false]);
  assert.equal(h.calls.navigation[0].pathname, "/(v_owner)/mechanic-booking/booking-detail");
  assert.equal(h.calls.navigation[0].params.bookingId, "booking");
  assert.deepEqual(h.calls.errors, []);
});

test("rejected GPS or denied permission cannot submit a new booking and restores the submit button", async () => {
  for (const denied of [false, true]) {
    const h = submissionFixture({ permission: denied ? "denied" : "granted", capture: async () => { throw new Error("Poor GPS. Confirm Booking to retry."); } });
    await h.submit();
    assert.equal(h.calls.capture, denied ? 0 : 1);
    assert.deepEqual(h.calls.booking, []);
    assert.deepEqual(h.calls.navigation, []);
    assert.deepEqual(h.calls.review, []);
    assert.deepEqual(h.calls.loading, [true, false]);
    assert.match(h.calls.errors[0][1], denied ? /Location permission is required/ : /Confirm Booking to retry/);
  }
});

test("in-flight submission guard still prevents duplicate GPS capture or booking creation", async () => {
  const h = submissionFixture({ submitting: true });
  await h.submit();
  assert.equal(h.calls.permission, 0);
  assert.equal(h.calls.capture, 0);
  assert.deepEqual(h.calls.booking, []);
});
