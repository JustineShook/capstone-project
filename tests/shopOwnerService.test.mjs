// Run with: node --test tests/shopOwnerService.test.mjs
// Isolated service tests: no Firebase credentials or production writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

function load(relative, dependencies = {}) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    }, module, module.exports,
  );
  return module.exports;
}

const workflow = load("../types/shopBooking.ts");
const listingTypes = load("../types/providerListing.ts");
const validProfile = { uid: "shop", role: "shop-owner", businessName: "Repair Shop", phone: "09171234567",
  address: "Quezon City", latitude: 14.67, longitude: 121.04, status: "open", verified: true, rating: 4.5 };

const validListing = { providerId: "another-shop", role: "shop-owner", category: "Auto Shops", businessName: "Approved Shop",
  visibility: "active", availability: "available", emergencyServiceAvailable: true,
  location: { latitude: 14.67, longitude: 121.04 }, serviceAreaLabel: "Quezon City", startingPrice: null };
const validVehicle = { vehicleId: "vehicle", make: "Toyota", model: "Vios", year: 2020, plateNumber: "ABC123" };
const bookingInput = { providerId: "another-shop", providerName: "Stale shop name", vehicleId: "vehicle",
  vehicle: "Stale vehicle", vehicleYear: 1999, vehiclePlate: "OLD", latitude: 14.6, longitude: 121,
  problem: " Engine won't start ", notes: " Needs diagnosis ", startingPrice: "Free" };

function setup({ status = "pending", providerId = "shop", bookingType = "shop-owner", profile = validProfile,
  signedIn = true, exists = true, listing = null, vehicle = validVehicle, accountRole = "owner" } = {}) {
  const writes = [];
  const auth = { currentUser: signedIn ? { uid: "shop", displayName: "Shop Owner", email: "shop@example.test" } : null };
  const booking = { status, providerId, bookingType };
  let listener;
  let listenerError;
  let subscribedQuery;
  let stopped = false;
  const firestore = {
    doc: (_db, ...parts) => parts.length ? parts.join("/") : { path: "bookings/new-request", id: "new-request" },
    collection: (_db, name) => name,
    where: (...parts) => parts,
    query: (...parts) => parts,
    serverTimestamp: () => "SERVER_TIME",
    Timestamp: class Timestamp { toDate() { return new Date("2026-09-09T00:00:00Z"); } },
    runTransaction: async (_db, action) => action({
      get: async (path) => {
        const data = path.startsWith("bookings/") ? (exists ? booking : undefined)
          : path.startsWith("providerListings/") ? listing
          : path.includes("/vehicles/") ? vehicle
          : path.startsWith("users/") ? { role: accountRole, displayName: "Vehicle Owner" } : profile;
        return { exists: () => Boolean(data), data: () => data };
      },
      update: (path, values) => writes.push({ path, values }),
      set: (reference, values) => writes.push({ path: reference.path, values }),
    }),
    updateDoc: async (path, values) => { writes.push({ path, values }); },
    addDoc: async (path, values) => { writes.push({ path, values }); return { id: "new-request" }; },
    onSnapshot: (query, next, error) => {
      subscribedQuery = query; listener = next; listenerError = error;
      return () => { stopped = true; };
    },
  };
  const service = load("../services/shopOwnerService.ts", {
    "firebase/firestore": firestore, "./firebase": { auth, db: {} }, "../types/shopBooking": workflow, "../types/providerListing": listingTypes,
  });
  return { service, writes, booking, firestore, emit: (docs) => listener({ docs }),
    emitBooking: (data) => listener({ id: "request", data: () => data }), fail: (error) => listenerError(error),
    get query() { return subscribedQuery; }, get stopped() { return stopped; } };
}

test("all stages persist only status and server time to the existing booking", async () => {
  const fixture = setup();
  for (const status of ["accepted", "vehicle_arrived", "diagnosing", "repairing", "completed"]) {
    await fixture.service.updateShopBookingStatus("request", status);
    assert.deepEqual(fixture.writes.at(-1), { path: "bookings/request", values: { status, updatedAt: "SERVER_TIME" } });
    fixture.booking.status = status;
  }
  assert.equal(fixture.writes.length, 5);
});

test("stale acceptance, skipped stages and terminal requests cannot be changed", async () => {
  for (const [before, after] of [["accepted", "accepted"], ["pending", "completed"], ["accepted", "repairing"],
    ["completed", "repairing"], ["rejected", "accepted"], ["cancelled", "accepted"]]) {
    const fixture = setup({ status: before });
    await assert.rejects(fixture.service.updateShopBookingStatus("request", after), /request has changed/);
    assert.equal(fixture.writes.length, 0);
  }
});

test("unauthenticated, missing and other-provider bookings are rejected", async () => {
  for (const options of [{ signedIn: false }, { exists: false }, { providerId: "someone-else" }, { bookingType: "towing-company" }]) {
    const fixture = setup(options);
    await assert.rejects(fixture.service.updateShopBookingStatus("request", "accepted"));
    assert.equal(fixture.writes.length, 0);
  }
});

test("a closed shop cannot accept, but can reject and finish existing work", async () => {
  const closed = { ...validProfile, status: "closed" };
  const pending = setup({ profile: closed });
  await assert.rejects(pending.service.updateShopBookingStatus("request", "accepted"), /Open your shop/);
  await pending.service.updateShopBookingStatus("request", "rejected");
  assert.equal(pending.writes.length, 1);
  const repairing = setup({ profile: closed, status: "repairing" });
  await repairing.service.updateShopBookingStatus("request", "completed");
  assert.equal(repairing.writes[0].values.status, "completed");
});

test("opening needs a complete shop profile; closing only changes availability", async () => {
  for (const partial of [{ phone: "" }, { address: "" }, { latitude: 0, longitude: 0 }, { latitude: NaN }, { longitude: 181 }]) {
    const fixture = setup({ profile: { ...validProfile, ...partial } });
    await assert.rejects(fixture.service.setShopAvailability("open"), /Complete your shop/);
    assert.equal(fixture.writes.length, 0);
    await fixture.service.setShopAvailability("closed");
    assert.deepEqual(fixture.writes[0], { path: "providers/shop", values: { status: "closed" } });
  }
});

test("profile editing preserves role, rating, verification and availability", async () => {
  const fixture = setup();
  await fixture.service.saveShopProfile({ ...validProfile, businessName: " Updated Shop ", verified: false, rating: 0 });
  assert.deepEqual(fixture.writes[0], { path: "providers/shop", values: {
    businessName: "Updated Shop", phone: validProfile.phone, address: validProfile.address,
    latitude: validProfile.latitude, longitude: validProfile.longitude,
  } });
  await assert.rejects(fixture.service.saveShopProfile({ ...validProfile, businessName: " " }), /shop name/);
  await assert.rejects(fixture.service.saveShopProfile({ ...validProfile, latitude: Infinity }), /coordinates/);
  assert.equal(fixture.writes.length, 1);
});

test("subscription filters other roles, sorts requests and propagates errors/unsubscribe", () => {
  const fixture = setup();
  let received;
  let failure;
  const stop = fixture.service.subscribeToShopRequests((items) => { received = items; }, (error) => { failure = error; });
  const item = (id, bookingType, createdAt) => ({ id, data: () => ({ bookingType, createdAt, updatedAt: null }) });
  fixture.emit([item("old", "shop-owner", "2026-09-01T00:00:00Z"), item("tow", "towing-company", "2026-09-10T00:00:00Z"),
    item("new", "shop-owner", new fixture.firestore.Timestamp())]);
  assert.deepEqual(fixture.query, ["bookings", ["providerId", "==", "shop"]]);
  assert.deepEqual(received.map((request) => request.id), ["new", "old"]);
  assert.equal(received[0].updatedAt, "");
  fixture.fail(new Error("Permission denied"));
  assert.equal(failure.message, "Permission denied");
  stop();
  assert.equal(fixture.stopped, true);
});

test("shop creation uses shared bookings and authenticated identity, with no appointment fields", async () => {
  const fixture = setup({ listing: validListing });
  const id = await fixture.service.createShopBooking({ ...bookingInput,
    customerId: "spoofed", bookingType: "towing-company", status: "completed", problem: "Engine won't start" });
  assert.equal(id, "new-request");
  const { path, values } = fixture.writes[0];
  assert.equal(path, "bookings/new-request");
  assert.equal(values.customerId, "shop");
  assert.equal(values.bookingType, "shop-owner");
  assert.equal(values.status, "pending");
  assert.equal(values.createdAt, "SERVER_TIME");
  assert.equal("appointmentDate" in values, false);
});

test("customer creation copies authoritative shop and saved vehicle snapshots", async () => {
  const fixture = setup({ listing: validListing });
  await fixture.service.createShopBooking({ ...bookingInput, appointmentDate: "tomorrow", shopLatitude: 0 });
  const data = fixture.writes[0].values;
  assert.equal(data.providerName, "Approved Shop");
  assert.equal(data.vehicle, "Toyota Vios");
  assert.equal(data.vehicleYear, 2020);
  assert.equal(data.vehiclePlate, "ABC123");
  assert.equal(data.customerName, "Vehicle Owner");
  assert.equal(data.startingPrice, "Price on assessment");
  assert.equal(data.shopLatitude, 14.67);
  assert.equal(data.problem, "Engine won't start");
  assert.equal("appointmentDate" in data, false);
});

test("creation rejects unavailable/hidden/non-shop listings and missing vehicles", async () => {
  for (const listing of [null, { ...validListing, availability: "offline" }, { ...validListing, availability: "busy" },
    { ...validListing, visibility: "inactive" }, { ...validListing, emergencyServiceAvailable: false },
    { ...validListing, role: "onsite-mechanic" }, { ...validListing, providerId: "shop" }]) {
    const fixture = setup({ listing });
    await assert.rejects(fixture.service.createShopBooking(bookingInput), /no longer open/);
    assert.equal(fixture.writes.length, 0);
  }
  const missing = setup({ listing: validListing, vehicle: null });
  await assert.rejects(missing.service.createShopBooking(bookingInput), /no longer saved/);
  const provider = setup({ listing: validListing, accountRole: "shop-owner" });
  await assert.rejects(provider.service.createShopBooking(bookingInput), /Vehicle Owner/);
});

test("creation rejects missing auth, blank problem, oversized notes and invalid coordinates", async () => {
  await assert.rejects(setup({ signedIn: false }).service.createShopBooking(bookingInput), /sign in/);
  for (const invalid of [{ problem: " " }, { problem: "x".repeat(301) }, { notes: "x".repeat(1001) },
    { latitude: NaN }, { latitude: 91 }, { longitude: -181 }, { latitude: 0, longitude: 0 }]) {
    const fixture = setup({ listing: validListing });
    await assert.rejects(fixture.service.createShopBooking({ ...bookingInput, ...invalid }));
    assert.equal(fixture.writes.length, 0);
  }
});

test("customer history uses customer ownership and keeps rejected/active/completed records", () => {
  const fixture = setup();
  let received;
  fixture.service.subscribeToMyShopBookings((items) => { received = items; }, () => {});
  fixture.emit(["pending", "accepted", "rejected", "completed"].map((status) => ({ id: status, data: () => ({ bookingType: "shop-owner", status }) })));
  assert.deepEqual(fixture.query, ["bookings", ["customerId", "==", "shop"]]);
  assert.equal(received.length, 4);
});

test("customer detail follows live statuses and rejects another customer's document", () => {
  const fixture = setup();
  let received;
  const stop = fixture.service.subscribeToMyShopBooking("request", (value) => { received = value; }, () => {});
  for (const status of [...workflow.SHOP_STATUS_FLOW, "rejected"]) {
    fixture.emitBooking({ bookingType: "shop-owner", customerId: "shop", status });
    assert.equal(received.status, status);
  }
  fixture.emitBooking({ bookingType: "shop-owner", customerId: "another-customer", status: "accepted" });
  assert.equal(received, null);
  fixture.emitBooking({ bookingType: "towing-company", customerId: "shop" });
  assert.equal(received, null);
  fixture.emitBooking(undefined);
  assert.equal(received, null);
  stop();
  assert.equal(fixture.stopped, true);
});

test("availability and profile updates keep an approved active public listing in sync", async () => {
  const fixture = setup({ listing: { ...validListing, providerId: "shop" } });
  await fixture.service.setShopAvailability("closed");
  assert.deepEqual(fixture.writes, [
    { path: "providers/shop", values: { status: "closed" } },
    { path: "providerListings/shop", values: { availability: "offline" } },
  ]);
  await fixture.service.saveShopProfile({ ...validProfile, businessName: "New shop name" });
  assert.deepEqual(fixture.writes.at(-1), { path: "providerListings/shop", values: {
    businessName: "New shop name", location: { latitude: 14.67, longitude: 121.04 },
  } });
});

test("unapproved shops cannot accept customer requests", async () => {
  const fixture = setup({ profile: { ...validProfile, verified: false } });
  await assert.rejects(fixture.service.updateShopBookingStatus("request", "accepted"), /approved/);
  assert.equal(fixture.writes.length, 0);
});

test("active filters exclude pending, completed, rejected and cancelled requests", () => {
  for (const status of ["accepted", "vehicle_arrived", "diagnosing", "repairing"]) assert.equal(workflow.isActiveShopService(status), true);
  for (const status of ["pending", "completed", "rejected", "cancelled"]) assert.equal(workflow.isActiveShopService(status), false);
});

test("map loading never falls back to demo shops on empty results or permission errors", async () => {
  for (const failure of [false, true]) {
    const service = load("../services/owner/providerMapService.ts", {
      "firebase/firestore": {
        collection: () => "providerListings", where: () => {}, query: () => {},
        getDocs: async () => { if (failure) throw new Error("Permission denied"); return { docs: [] }; },
      },
      "../../data/owner/mockProviders": { MOCK_PROVIDERS: [{ id: "demo-shop", category: "Auto Shops" }, { id: "demo-tow", category: "Towing" }] },
      "../../types/providerListing": listingTypes, "../firebase": { db: {} }, "./ratingService": {},
    });
    // The application logs load failures; keep expected test output quiet.
    const original = console.error;
    try {
      console.error = () => {};
      const providers = await service.loadCustomerMapProviders();
      assert.deepEqual(providers.map((item) => item.id), ["demo-tow"]);
    } finally { console.error = original; }
  }
});

test("live map excludes closed, busy, hidden and non-emergency shops", () => {
  let listener;
  const service = load("../services/owner/providerMapService.ts", {
    "firebase/firestore": { collection: () => "providerListings", where: () => {}, query: () => {},
      onSnapshot: (_query, next) => { listener = next; return () => {}; } },
    "../../data/owner/mockProviders": {}, "../../types/providerListing": listingTypes,
    "../firebase": { db: {} }, "./ratingService": {},
  });
  let received;
  service.subscribeToCustomerMapShops((items) => { received = items; }, () => {});
  const listing = { ...validListing, services: ["Engine Diagnostics"], vehicleTypes: ["Car"], ratingSummary: { average: 0, count: 0 } };
  listener({ docs: [listing, { ...listing, availability: "offline" }, { ...listing, availability: "busy" },
    { ...listing, visibility: "inactive" }, { ...listing, emergencyServiceAvailable: false }].map((data) => ({ data: () => data })) });
  assert.equal(received.length, 1);
  assert.equal(received[0].category, "Auto Shops");
  assert.equal(received[0].isPositiveStatus, true);
});

test("shop publication requires approval and derives public identity/availability from the shop profile", async () => {
  for (const verified of [false, true]) {
    let written;
    const service = load("../services/publicProviderListingService.ts", {
      "firebase/firestore": { doc: (_db, ...parts) => parts.join("/"),
        runTransaction: async (_db, action) => action({
          get: async () => ({ data: () => ({ ...validProfile, verified, status: "closed" }) }),
          set: (path, data) => { written = { path, data }; },
        }) },
      "./firebase": { db: {} },
    });
    const input = { ...validListing, services: ["Engine Diagnostics"], vehicleTypes: ["Car"], operatingHours: "Daily" };
    if (!verified) {
      await assert.rejects(service.updatePublicProviderListing("shop", "shop-owner", input), /approved/);
      assert.equal(written, undefined);
    } else {
      await service.updatePublicProviderListing("shop", "shop-owner", input);
      assert.equal(written.path, "providerListings/shop");
      assert.equal(written.data.category, "Auto Shops");
      assert.equal(written.data.availability, "offline");
      assert.equal(written.data.businessName, validProfile.businessName);
      assert.deepEqual(written.data.location, { latitude: 14.67, longitude: 121.04 });
    }
  }
});
