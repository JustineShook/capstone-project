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
const timingTypes = load("../types/bookingTiming.ts");
const finalPrice = load("../utils/finalPrice.ts");
const timing = load("../utils/bookingTiming.ts", {
  "firebase/firestore": { Timestamp: class Timestamp { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } toDate() { return new Date(this.ms); } } },
  "../types/bookingTiming": timingTypes,
});
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
    getDocs: async () => ({ docs: [] }),
    serverTimestamp: () => "SERVER_TIME",
    Timestamp: class Timestamp { constructor(value = Date.parse("2026-09-09T00:00:00Z")) { this.value = value; } toMillis() { return this.value; } toDate() { return new Date(this.value); } },
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
    "../types/user": {}, "./owner/bookingService": {}, "../types/owner/vehicle": {}, "../types/bookingTiming": timingTypes,
    "../utils/bookingTiming": timing,
    "../utils/finalPrice": finalPrice,
    "./customerNotificationService": { addBookingStatusNotification: () => {} },
    "./shopNotificationService": { writeShopNotification: () => {} },
    "./ownerVerificationProfileService": { requireVerifiedOwner: async () => {} },
    "./scheduledBookingReservationService": { claimScheduledReservation: async () => {}, releaseScheduledReservation: async () => {} },
  });
  return { service, writes, booking, firestore, emit: (docs) => listener({ docs }),
    emitBooking: (data) => listener({ id: "request", data: () => data }), fail: (error) => listenerError(error),
    get query() { return subscribedQuery; }, get stopped() { return stopped; } };
}

test("all stages persist only status and server time to the existing booking", async () => {
  const fixture = setup();
  for (const status of ["accepted", "vehicle_arrived", "diagnosing", "repairing", "completed"]) {
    await fixture.service.updateShopBookingStatus("request", status, status === "completed" ? "Done" : undefined, status === "completed" ? 125.5 : undefined);
    assert.deepEqual(fixture.writes.at(-1), { path: "bookings/request", values: status === "completed"
      ? { status, updatedAt: "SERVER_TIME", finalPrice: 125.5, completedAt: "SERVER_TIME", completionNote: "Done" }
      : { status, updatedAt: "SERVER_TIME" } });
    fixture.booking.status = status;
  }
  assert.equal(fixture.writes.length, 5);
});

test("Auto Shop completion requires a valid two-decimal final price and keeps the optional note", async () => {
  for (const invalid of [undefined, 12.345, -1, 100000000.01]) {
    const fixture = setup({ status: "repairing" });
    await assert.rejects(fixture.service.updateShopBookingStatus("request", "completed", "Finished", invalid), /valid final price/);
    assert.equal(fixture.writes.length, 0);
  }
  const fixture = setup({ status: "repairing" });
  await fixture.service.updateShopBookingStatus("request", "completed", "Finished", 125.5);
  assert.equal(fixture.writes[0].values.finalPrice, 125.5);
  assert.equal(fixture.writes[0].values.completionNote, "Finished");
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
  await pending.service.updateShopBookingStatus("request", "rejected", undefined, undefined, "Shop is temporarily closed.");
  assert.equal(pending.writes.length, 1);
  assert.equal(pending.writes[0].values.declineReason, "Shop is temporarily closed.");
  const repairing = setup({ profile: closed, status: "repairing" });
  await repairing.service.updateShopBookingStatus("request", "completed", undefined, 80);
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

test("shop creation uses shared bookings, authenticated identity and default Now timing", async () => {
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
  assert.equal(values.timingMode, "now");
  assert.equal(values.urgency, "standard");
  assert.equal("scheduledAt" in values, false);
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
  assert.equal(data.timingMode, "now");
  assert.equal(data.urgency, "standard");
  assert.equal("appointmentDate" in data, false);
});

test("creation rejects unavailable/hidden/non-shop listings and missing vehicles", async () => {
  for (const listing of [null, { ...validListing, availability: "offline" }, { ...validListing, availability: "busy" },
    { ...validListing, visibility: "inactive" },
    { ...validListing, role: "onsite-mechanic" }, { ...validListing, providerId: "shop" }]) {
    const fixture = setup({ listing });
    await assert.rejects(fixture.service.createShopBooking(bookingInput), /not publicly available|unavailable now/);
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

test("shop scheduling accepts opted-in offline providers and gates Emergency by support", async () => {
  const listing = { ...validListing, acceptsScheduledBookings: true, availability: "offline" };
  const fixture = setup({ listing });
  const nextWholeHour = Math.ceil((Date.now() + 3_600_000) / 3_600_000) * 3_600_000;
  const scheduledAt = new fixture.firestore.Timestamp(nextWholeHour);
  assert.ok(scheduledAt.toMillis() > Date.now(), "scheduled appointment should be in the future");
  assert.equal(scheduledAt.toMillis() % 3_600_000, 0, "scheduled appointment should start on the hour");
  await fixture.service.createShopBooking({ ...bookingInput, timing: { timingMode: "scheduled", urgency: "standard", scheduledAt } });
  assert.equal(fixture.writes.find((write) => write.path === "bookings/new-request").values.timingMode, "scheduled");
  assert.equal(fixture.writes.find((write) => write.path === "bookings/new-request").values.scheduledAt, scheduledAt);
  const noEmergency = setup({ listing: { ...validListing, emergencyServiceAvailable: false } });
  await assert.rejects(noEmergency.service.createShopBooking({ ...bookingInput, timing: { timingMode: "now", urgency: "emergency" } }), /not accepting emergency/);
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

test("shared labels distinguish Now, Emergency and scheduled appointments in Manila time", () => {
  assert.equal(timing.formatBookingTimingLabel({ timingMode: "now", urgency: "standard" }), "Now");
  assert.equal(timing.formatBookingTimingLabel({ timingMode: "now", urgency: "emergency" }), "Emergency");
  assert.equal(timing.formatBookingTimingLabel({ timingMode: "scheduled", scheduledAt: new Date("2026-10-25T02:00:00Z") }), "Scheduled · Oct 25, 10:00 AM");
  assert.equal(timing.formatBookingTimingLabel({}), "Now", "legacy bookings without timing fields remain readable");
  assert.equal(timing.getManilaDayKey(new Date("2026-10-25T02:00:00Z")), "2026-10-25");
  assert.equal(timing.getManilaHour(new Date("2026-10-25T02:00:00Z")), 10);
});

test("Mechanic preserves but blocks standard Now while Towing retains explicit Now", () => {
  const source = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  for (const path of ["../app/(v_owner)/mechanic-booking/book-mechanic.tsx", "../app/(v_owner)/towing-booking/book-towing.tsx"]) {
    const form = source(path);
    assert.match(form, /acceptsScheduledBookings:\s*listing\.acceptsScheduledBookings\s*===\s*true/);
    assert.match(form, /initialTimingMode === "now" \? \{ timingMode: "now", urgency: "standard" \} : null/);
    assert.match(form, /BookingTimingActions/);
    assert.match(form, /isBookingTimingReady\(timing\)/);
    if (path.includes("towing-booking")) assert.match(form, /timing\?\.urgency === "standard" && initialTimingMode === "now"/);
    else {
      assert.match(form, /: false;/, "Mechanic standard Now is kept as a value but cannot be submitted");
      assert.match(form, /Now from discovery remains a standard Now selection/);
    }
  }
  const actions = source("../components/owner/BookingTimingActions.tsx");
  assert.match(actions, />Emergency</);
  assert.match(actions, />Schedule</);
  assert.match(actions, /Acceptance and response time are not guaranteed/);
  assert.match(actions, /Subject to provider confirmation/);
  assert.match(actions, /Review Booking/);
  assert.match(actions, /Emergency disabled: this provider has not enabled urgent requests/);
  assert.match(actions, /Schedule disabled: this provider has not enabled future bookings/);
});

test("Mechanic discovery keeps active listings visible and booking actions respect Emergency or Schedule support", () => {
  const source = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const listingForm = source("../components/provider/PublicListingForm.tsx");
  assert.match(listingForm, /role === "onsite-mechanic" \? "Emergency only" : "Now requests only"/);

  const discovery = source("../services/owner/providerMapService.ts");
  assert.match(discovery, /: listing\.availability === "available"\);/);
  const detail = source("../components/owner/ProviderDetailCard.tsx");
  assert.match(detail, /mechanicHasBookingOption = provider\.category === "Onsite Mechanics"/);
  assert.match(detail, /Unavailable for new bookings: Emergency is off and Schedule is disabled/);

  const mechanicForm = source("../app/(v_owner)/mechanic-booking/book-mechanic.tsx");
  assert.match(mechanicForm, /: false;/, "standard Now from discovery is preserved but is not a valid new Mechanic request");
  assert.match(mechanicForm, /hideUnsupportedSchedule standardNowMessage=\{standardNowMessage\}/);
  assert.match(mechanicForm, /unavailableMessage=\{providerUnavailable \?/);
  const service = source("../services/owner/bookingService.ts");
  assert.match(service, /timing\.timingMode === "now" && timing\.urgency === "standard"/);
});

test("changing a scheduled day clears its hour and submission requires a valid future hour", () => {
  const selector = readFileSync(fileURLToPath(new URL("../components/owner/BookingTimingActions.tsx", import.meta.url)), "utf8");
  assert.match(selector, /if \(index === dayOffset\) return; setDayOffset\(index\); setSelectedHour\(null\); onChange\(clearScheduledHour\(\)\);/);
  assert.match(selector, /draftReady = !!selectedTimestamp && selectedTimestamp\.getTime\(\) > Date\.now\(\) && selectedTimestamp\.getTime\(\) % 3_600_000 === 0/);
  assert.match(selector, /disabled=\{!draftReady\} onPress=\{confirmSchedule\}/);

  const cleared = timing.clearScheduledHour();
  assert.deepEqual(cleared, { timingMode: "scheduled", urgency: "standard" });
  assert.equal(timing.isBookingTimingReady(cleared), false);
  const now = Date.now();
  const nextHour = Math.ceil((now + 1) / 3_600_000) * 3_600_000;
  const timestamp = { toMillis: () => nextHour };
  assert.equal(timing.isBookingTimingReady({ ...cleared, scheduledAt: timestamp }, now), true);
  assert.equal(timing.isBookingTimingReady({ ...cleared, scheduledAt: { toMillis: () => now } }, now), false);
  assert.equal(timing.isBookingTimingReady({ ...cleared, scheduledAt: { toMillis: () => nextHour + 1 } }, now), false);
});

test("provider request detail screens show timing labels and Auto Shop confirmation is read-only", () => {
  const source = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  for (const path of [
    "../app/(onsite-mechanic)/request-details.tsx",
    "../app/(towing-company)/request-details.tsx",
    "../components/owner/HomeGarageBookingDetail.tsx",
  ]) assert.match(source(path), /BookingTimingBanner/);
  assert.match(source("../app/(homegarage)/repair-request-detail.tsx"), /providerMode/);

  const shop = source("../app/(v_owner)/shop-booking/book-shop.tsx");
  const confirmationModal = shop.match(/<Modal[\s\S]*?<\/Modal>/)?.[0];
  assert.ok(confirmationModal, "Auto Shop confirmation modal should be present");
  assert.doesNotMatch(confirmationModal, /BookingTimingSelector/);
  assert.match(confirmationModal, /RequestInfo label="Timing" value=\{formatBookingTimingLabel\(timing\)\}/);
});

test("all four owner booking forms and provider request screens render footer timing actions or labels", () => {
  const source = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const servicePaths = [
    "../services/owner/bookingService.ts",
    "../services/shopOwnerService.ts",
    "../services/owner/towingService.ts",
    "../services/homeGarageBookingService.ts",
  ];
  for (const path of servicePaths) {
    assert.match(source(path), /timingFields/);
    assert.match(source(path), /validateBookingTiming/);
    assert.match(source(path), /claimScheduledReservation/);
    assert.match(source(path), /releaseScheduledReservation/);
  }
  const forms = [
    "../app/(v_owner)/mechanic-booking/book-mechanic.tsx",
    "../app/(v_owner)/shop-booking/book-shop.tsx",
    "../app/(v_owner)/towing-booking/book-towing.tsx",
    "../app/(v_owner)/homegarage-booking/book-homegarage.tsx",
  ];
  for (const path of forms) {
    assert.match(source(path), /BookingTimingActions/);
    assert.doesNotMatch(source(path), /BookingTimingSelector/);
  }
  const providerScreens = [
    "../app/(onsite-mechanic)/requests.tsx",
    "../components/shop-owner/ShopRequests.tsx",
    "../app/(towing-company)/requests.tsx",
    "../app/(homegarage)/repair-requests.tsx",
  ];
  for (const path of providerScreens) assert.match(source(path), /formatBookingTimingLabel/);
  const ownerDetails = [
    "../app/(v_owner)/mechanic-booking/booking-detail.tsx",
    "../components/owner/CustomerShopRequest.tsx",
    "../app/(v_owner)/towing-booking/booking-detail.tsx",
    "../components/owner/HomeGarageBookingDetail.tsx",
  ];
  for (const path of ownerDetails) assert.match(source(path), /BookingTimingBanner/);
  assert.match(source("../app/(v_owner)/history.tsx"), /formatBookingTimingLabel/);
});

test("all four booking forms submit only from a review confirmation step", () => {
  const source = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const mechanic = source("../app/(v_owner)/mechanic-booking/book-mechanic.tsx");
  const towing = source("../app/(v_owner)/towing-booking/book-towing.tsx");
  const shop = source("../app/(v_owner)/shop-booking/book-shop.tsx");
  const garage = source("../app/(v_owner)/homegarage-booking/book-homegarage.tsx");
  for (const form of [mechanic, towing]) {
    assert.match(form, /<Modal visible=\{reviewVisible\}/);
    assert.match(form, /Confirm (Booking|Towing)/);
    assert.match(form, /onEmergency=\{\(\) => \{[\s\S]*if \(requiredFieldsValid\) setReviewVisible\(true\)/);
  }
  for (const form of [shop, garage]) {
    assert.match(form, /footer=\{provider && !loading \? <BookingTimingActions/);
    assert.match(form, /setModal\("review"\)/);
    assert.match(form, /Confirm (Request|Repair Request)/);
  }
  assert.match(source("../components/owner/ShopBookingScreen.tsx"), /\{footer \? <SafeAreaView edges=\{\["bottom"\]\}/);
});

test("owner confirmation routes show the same timing label", () => {
  const source = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const confirmations = [
    ["Onsite Mechanic", "../app/(v_owner)/mechanic-booking/booking-confirmation.tsx"],
    ["Auto Shop", "../app/(v_owner)/shop-booking/booking-confirmation.tsx"],
    ["Towing", "../app/(v_owner)/towing-booking/booking-confirmation.tsx"],
    ["Home Garage repair", "../components/owner/HomeGarageBookingDetail.tsx"],
  ];
  const missing = [];
  for (const [flow, path] of confirmations) {
    const screen = source(path);
    const wrappedConfirmation = flow === "Auto Shop" && /CustomerShopRequest/.test(screen)
      ? source("../components/owner/CustomerShopRequest.tsx") : screen;
    if (!/BookingTimingBanner|formatBookingTimingLabel/.test(wrappedConfirmation)) missing.push(flow);
  }
  assert.deepEqual(missing, [], `owner confirmations missing timing labels: ${missing.join(", ")}`);
});

test("current map subscriptions never fall back to demo providers", () => {
  for (const failure of [false, true]) {
    let listener;
    let onError;
    const service = load("../services/owner/providerMapService.ts", {
      "firebase/firestore": { collection: () => "providerListings", where: () => {}, query: () => {},
        onSnapshot: (_query, next, error) => { listener = next; onError = error; return () => {}; } },
      "../../data/owner/mockProviders": { MOCK_PROVIDERS: [{ id: "demo-tow", category: "Towing" }] },
      "../../types/providerListing": listingTypes, "../firebase": { db: {} }, "./ratingService": { getProviderReviewSummary: async () => ({ average: 0, count: 0, reviews: [] }) },
    });
    let received;
    let receivedError;
    service.subscribeToCustomerMapProviders((items) => { received = items; }, (error) => { receivedError = error; });
    if (failure) onError(new Error("Permission denied"));
    else listener({ docs: [] });
    assert.deepEqual(received, failure ? undefined : []);
    assert.equal(receivedError?.message, failure ? "Permission denied" : undefined);
  }
});

test("live map excludes closed, busy, hidden and non-emergency shops", () => {
  let listener;
  const service = load("../services/owner/providerMapService.ts", {
    "firebase/firestore": { collection: () => "providerListings", where: () => {}, query: () => {},
      onSnapshot: (_query, next) => { listener = next; return () => {}; } },
    "../../data/owner/mockProviders": {}, "../../types/providerListing": listingTypes,
    "../firebase": { db: {} }, "./ratingService": { getProviderReviewSummary: async () => ({ average: 0, count: 0, reviews: [] }) },
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

test("scheduled map includes offline opted-in providers and excludes hidden or non-opted-in listings", async () => {
  let listener;
  let builtQuery;
  const service = load("../services/owner/providerMapService.ts", {
    "firebase/firestore": { collection: () => "providerListings", where: (...args) => args,
      query: (...args) => { builtQuery = args; return args; },
      onSnapshot: (_query, next) => { listener = next; return () => {}; } },
    "../../data/owner/mockProviders": {}, "../../types/providerListing": listingTypes,
    "../firebase": { db: {} }, "./ratingService": { getProviderReviewSummary: async () => ({ average: 0, count: 0, reviews: [] }) },
  });
  let received;
  service.subscribeToCustomerMapProviders((items) => { received = items; }, () => {}, true);
  const activeOffline = { ...validListing, providerId: "offline-shop", role: "shop-owner", availability: "offline", acceptsScheduledBookings: true,
    services: ["Repair"], vehicleTypes: ["Car"], ratingSummary: { average: 0, count: 0 } };
  const notOptedIn = { ...activeOffline, providerId: "no-schedule", acceptsScheduledBookings: false };
  const hidden = { ...activeOffline, providerId: "hidden-shop", visibility: "inactive" };
  listener({ docs: [activeOffline, notOptedIn, hidden].map((data) => ({ data: () => data })) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(builtQuery.some((part) => Array.isArray(part) && part[0] === "acceptsScheduledBookings"));
  assert.deepEqual(received.map((item) => item.id), ["offline-shop"]);
});

test("shop map publishes listing changes immediately and ignores delayed reviews from older snapshots", async () => {
  let listener;
  const pendingReviews = [];
  const service = load("../services/owner/providerMapService.ts", {
    "firebase/firestore": { collection: () => "providerListings", where: () => {}, query: () => {},
      onSnapshot: (_query, next) => { listener = next; return () => {}; } },
    "../../data/owner/mockProviders": {}, "../../types/providerListing": listingTypes,
    "../firebase": { db: {} }, "./ratingService": {
      getProviderReviewSummary: () => new Promise((resolve) => pendingReviews.push(resolve)),
    },
  });
  const received = [];
  service.subscribeToCustomerMapShops((items) => received.push(items), () => {});
  const makeSnapshot = (businessName) => ({ docs: [{ data: () => ({ ...validListing, providerId: "shop", businessName,
    services: ["Repair"], vehicleTypes: ["Car"], ratingSummary: { average: 4, count: 2 } }) }] });
  listener(makeSnapshot("Old Shop Details"));
  assert.equal(received.at(-1)[0].name, "Old Shop Details");
  listener(makeSnapshot("New Shop Details"));
  assert.equal(received.at(-1)[0].name, "New Shop Details");
  pendingReviews[0]({ average: 3, count: 1, reviews: [] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(received.length, 2, "the older review result must not publish its stale listing");
  pendingReviews[1]({ average: 5, count: 4, reviews: [] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(received.at(-1)[0].name, "New Shop Details");
  assert.equal(received.at(-1)[0].rating, 5);
});

test("open shop request listing subscription streams changes and clears shops that stop being bookable", () => {
  let listener;
  let stopped = false;
  const service = load("../services/publicProviderListingService.ts", {
    "firebase/firestore": {
      doc: (_db, ...parts) => parts.join("/"),
      onSnapshot: (_reference, next) => { listener = next; return () => { stopped = true; }; },
    },
    "../types/providerListing": listingTypes,
    "./firebase": { db: {} },
  });
  const received = [];
  const stop = service.subscribeToBookableShopListing("shop", (listing) => received.push(listing), () => {});
  const emit = (listing) => listener({ exists: () => Boolean(listing), data: () => listing });
  emit({ ...validListing, providerId: "shop", businessName: "Original Name" });
  emit({ ...validListing, providerId: "shop", businessName: "Updated Name" });
  assert.deepEqual(received.map((listing) => listing?.businessName), ["Original Name", "Updated Name"]);
  emit({ ...validListing, providerId: "shop", visibility: "inactive" });
  assert.equal(received.at(-1), null);
  stop();
  assert.equal(stopped, true);
});

test("shop publication requires approval and derives public identity/availability from the shop profile", async () => {
  for (const verified of [false, true]) {
    let written;
    const service = load("../services/publicProviderListingService.ts", {
      "firebase/firestore": { doc: (_db, ...parts) => parts.join("/"),
        runTransaction: async (_db, action) => action({
          get: async (reference) => reference === "providers/shop"
            ? { data: () => ({ ...validProfile, verified, status: "closed" }) }
            : { exists: () => false },
          set: (path, data) => { written = { path, data }; },
          update: (path, data) => { written = { path, data }; },
        }) },
      "../types/providerListing": listingTypes,
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
      assert.equal(written.data.businessName, input.businessName);
      assert.deepEqual(written.data.location, { latitude: 14.67, longitude: 121.04 });
    }
  }
});

test("shop listing updates omit an empty public contact number", async () => {
  let updated;
  const currentListing = { exists: () => true };
  const service = load("../services/publicProviderListingService.ts", {
    "firebase/firestore": {
      doc: (_db, ...parts) => parts.join("/"),
      runTransaction: async (_db, action) => action({
        get: async (reference) => reference === "providers/shop"
          ? { data: () => ({ ...validProfile, status: "open" }) }
          : currentListing,
        update: (_reference, data) => { updated = data; },
      }),
    },
    "../types/providerListing": listingTypes,
    "./firebase": { db: {} },
  });
  await service.updatePublicProviderListing("shop", "shop-owner", {
    businessName: "Repair Shop",
    location: { latitude: 14.67, longitude: 121.04 },
    availability: "available",
    serviceAreaLabel: "Quezon City",
    description: "General auto repair",
    contactPhone: "",
    services: ["Oil change"],
    vehicleTypes: ["Cars"],
    operatingHours: "Open 24/7",
    startingPrice: null,
    emergencyServiceAvailable: true,
  });
  assert.ok(updated);
  assert.equal(Object.hasOwn(updated, "contactPhone"), false);
});
