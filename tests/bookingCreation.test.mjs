// Service-level creation coverage for all providers. Firestore imports are
// mocked here so no credentials, production data, or app dependencies are used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

function load(relative, dependencies) {
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

const owner = { uid: "owner", displayName: "Owner", email: "owner@example.test" };
const vehicle = { vehicleId: "vehicle", make: "Toyota", model: "Vios", year: 2020, plateNumber: "ABC123" };
const ownerVerification = { personal: { fullName: "Owner", phone: " +63 (917) 123-4567 ", address: "Quezon City", cityMunicipality: "Quezon City" } };
const notificationStubs = {
  "./customerNotificationService": { addBookingStatusNotification: () => {}, addHomeGaragePriceNotification: () => {} },
  "../customerNotificationService": { addBookingStatusNotification: () => {} },
  "./shopNotificationService": { writeShopNotification: () => {} },
  "./mechanicNotificationService": { writeMechanicNotification: () => {} },
  "../mechanicNotificationService": { writeMechanicNotification: () => {} },
  "../towingNotificationService": { writeTowingNotification: () => {} },
  "./towingNotificationService": { writeTowingNotification: () => {} },
  "./homeGarageNotificationService": { writeHomeGarageProviderNotification: () => {} },
};

function createFixture(providerId, role, category, listingOverrides = {}) {
  const writes = [];
  const reads = [];
  const listing = {
    providerId, role, category, businessName: `${role} provider`, visibility: "active", availability: "available",
    emergencyServiceAvailable: true, acceptsScheduledBookings: false,
    location: { latitude: 14.67, longitude: 121.04 }, serviceAreaLabel: "Quezon City", startingPrice: null,
    contactPhone: "09170000000",
    ...listingOverrides,
  };
  const firestore = {
    Timestamp: class Timestamp {
      toDate() { return new Date("2026-10-22T00:00:00Z"); }
      toMillis() { return Date.parse("2026-10-22T00:00:00Z"); }
    },
    collection: (_db, name) => ({ path: name }),
    doc: (dbOrCollection, ...parts) => {
      const path = dbOrCollection?.path && parts.length === 0 ? `${dbOrCollection.path}/new-booking` : parts.join("/");
      return { path, id: path.split("/").at(-1) };
    },
    where: (...parts) => parts,
    query: (...parts) => parts,
    getDocs: async () => ({ docs: [] }),
    serverTimestamp: () => "SERVER_TIMESTAMP",
    runTransaction: async (_db, action) => action({
      get: async (reference) => {
        reads.push(reference.path);
        if (reference.path.startsWith("providerActiveServices/")) {
          throw new Error("Missing or insufficient permissions: deployed-rules baseline denies providerActiveServices reads");
        }
        const data = reference.path === `providerListings/${providerId}` ? listing
          : reference.path === "users/owner" ? { role: "owner", displayName: "Owner" }
            : reference.path === "users/owner/vehicles/vehicle" ? vehicle : undefined;
        return { exists: () => data !== undefined, data: () => data };
      },
      set: (reference, values) => writes.push({ path: reference.path, values }),
      update: (reference, values) => writes.push({ path: reference.path, values }),
    }),
  };
  const firebase = { db: {}, auth: { currentUser: owner } };
  const verification = { requireVerifiedOwner: async () => {}, getOwnerVerificationProfile: async () => ownerVerification };
  const timingTypes = {};
  const timing = load("../utils/bookingTiming.ts", {
    "firebase/firestore": { Timestamp: firestore.Timestamp }, "../types/bookingTiming": timingTypes,
  });
  const common = {
    "firebase/firestore": firestore, "../firebase": firebase, "./firebase": firebase,
    "../types/bookingTiming": timingTypes, "../../types/bookingTiming": timingTypes,
    "../utils/bookingTiming": timing, "../../utils/bookingTiming": timing,
    "../ownerVerificationProfileService": verification, "./ownerVerificationProfileService": verification,
    "../scheduledBookingReservationService": {}, "./scheduledBookingReservationService": {},
    "../types/shopBooking": { SHOP_TRANSITIONS: {} }, "../types/providerListing": {},
    "../../types/owner/booking": {}, "../../types/owner/towing": {},
    ...notificationStubs,
    "./homeGarageNotificationService": { writeHomeGarageProviderNotification: () => {} },
    "../utils/finalPrice": load("../utils/finalPrice.ts", {}),
    "../../utils/finalPrice": load("../utils/finalPrice.ts", {}),
  };
  return { writes, reads, firestore, deps: { ...common, "./firebase": firebase } };
}

test("mechanic and towing customer booking creation succeeds without active-service reads", async () => {
  for (const item of [createCases[0], createCases[2]]) {
    const providerId = `provider-${item.role}`;
    const fixture = createFixture(providerId, item.role, item.category);
    const service = load(item.file, fixture.deps);
    const args = item.input(providerId);
    if (item.role === "onsite-mechanic") args.timing = { timingMode: "now", urgency: "emergency" };

    const booking = await service[item.exportName](args);

    assert.equal(booking.providerId, providerId);
    assert.ok(fixture.writes.some((write) => write.path === "bookings/new-booking"), `${item.name} writes the booking`);
    assert.deepEqual(fixture.reads, [`providerListings/${providerId}`], `${item.name} reads only the listing in its creation transaction`);
    assert.equal(fixture.reads.some((path) => path.startsWith("providerActiveServices/")), false);
  }
});

const createCases = [
  {
    name: "Onsite Mechanic", file: "../services/owner/bookingService.ts", exportName: "createBooking",
    role: "onsite-mechanic", category: "Onsite Mechanics",
    input: (providerId) => ({ providerId, providerName: "Mechanic", providerPhone: "09170000000", vehicleId: vehicle.vehicleId,
      vehicle: "Toyota Vios", vehicleYear: 2020, vehiclePlate: "ABC123", latitude: 14.6, longitude: 121,
      problem: "No start", notes: "", startingPrice: "Free" }),
  },
  {
    name: "Auto Shop", file: "../services/shopOwnerService.ts", exportName: "createShopBooking",
    role: "shop-owner", category: "Auto Shops",
    input: (providerId) => ({ providerId, providerName: "Shop", vehicleId: vehicle.vehicleId, vehicle: "Toyota Vios",
      vehicleYear: 2020, vehiclePlate: "ABC123", latitude: 14.6, longitude: 121, problem: "No start", notes: "", startingPrice: "Free" }),
  },
  {
    name: "Towing", file: "../services/owner/towingService.ts", exportName: "createTowingBooking",
    role: "towing-company", category: "Towing",
    input: (providerId) => ({ providerId, providerName: "Towing", vehicleId: vehicle.vehicleId, vehicle: "Toyota Vios",
      vehicleYear: 2020, vehiclePlate: "ABC123", latitude: 14.6, longitude: 121, providerLatitude: 14.67,
      providerLongitude: 121.04, destinationLatitude: 14.7, destinationLongitude: 121.1, providerToPickupDistanceKm: 1,
      pickupToDestinationDistanceKm: 2, totalDistanceKm: 3, basePrice: 100, pricePerKm: 10, distanceCharge: 30,
      estimatedTotalPrice: 130, pricingMode: "fixed", dispatcherPhone: "", pickupLocation: "Pickup",
      destination: "Destination", towingType: "Flatbed Towing", vehicleCondition: "Vehicle cannot move",
      notes: "", startingPrice: "₱130" }),
  },
  {
    name: "Home Garage repair", file: "../services/homeGarageBookingService.ts", exportName: "createHomeGarageBooking",
    role: "homegarage", category: "Parking Lots",
    input: (providerId) => [providerId, vehicle, "No start", ""],
  },
];

test("Now booking creation remains standard for non-Mechanic provider flows", async () => {
  for (const item of createCases) {
    if (item.name === "Onsite Mechanic") continue;
    const providerId = `provider-${item.role}`;
    const fixture = createFixture(providerId, item.role, item.category);
    const dependencies = { ...fixture.deps };
    if (item.name === "Auto Shop") {
      dependencies["../types/shopBooking"] = { SHOP_TRANSITIONS: {} };
      dependencies["../types/owner/vehicle"] = {};
      dependencies["./owner/bookingService"] = {};
      dependencies["./customerNotificationService"] = { addBookingStatusNotification: () => {} };
      dependencies["./ownerVerificationProfileService"] = { requireVerifiedOwner: async () => {} };
    }
    const service = load(item.file, dependencies);
    const args = item.input(providerId);
    if (Array.isArray(args)) await service[item.exportName](...args);
    else await service[item.exportName](args);
    const booking = fixture.writes.find((write) => write.path === "bookings/new-booking")?.values;
    assert.ok(booking, `${item.name} must write a booking`);
    assert.equal(booking.timingMode, "now", `${item.name} must default to Now`);
    assert.equal(booking.urgency, "standard", `${item.name} must default to standard urgency`);
    assert.equal(Object.hasOwn(booking, "scheduledAt"), false, `${item.name} Now booking must not include a schedule`);
    assert.equal(booking.status, "pending");
    if (item.name === "Towing") assert.equal(booking.customerPhone, ownerVerification.personal.phone, "Towing must preserve the original verified owner phone snapshot");
  }
});

test("Mechanic booking keeps discovery Now explicit and requires supported Emergency or Schedule", async () => {
  const providerId = "provider-onsite-mechanic";
  const fixture = createFixture(providerId, "onsite-mechanic", "Onsite Mechanics");
  const service = load("../services/owner/bookingService.ts", fixture.deps);
  const input = createCases[0].input(providerId);

  await assert.rejects(service.createBooking({ ...input, timing: { timingMode: "now", urgency: "standard" } }), /Choose Emergency explicitly/);
  assert.equal(fixture.writes.some((write) => write.path === "bookings/new-booking"), false,
    "a standard Now selection is not silently converted or submitted as Emergency");

  await service.createBooking({ ...input, timing: { timingMode: "now", urgency: "emergency" } });
  const emergency = fixture.writes.find((write) => write.path === "bookings/new-booking")?.values;
  assert.equal(emergency?.timingMode, "now");
  assert.equal(emergency?.urgency, "emergency");

  const unsupported = createFixture(providerId, "onsite-mechanic", "Onsite Mechanics", { emergencyServiceAvailable: false });
  const unsupportedService = load("../services/owner/bookingService.ts", unsupported.deps);
  await assert.rejects(unsupportedService.createBooking({ ...input, timing: { timingMode: "now", urgency: "emergency" } }), /not accepting emergency/);
  assert.equal(unsupported.writes.some((write) => write.path === "bookings/new-booking"), false);

  const offline = createFixture(providerId, "onsite-mechanic", "Onsite Mechanics", { availability: "offline" });
  const offlineService = load("../services/owner/bookingService.ts", offline.deps);
  await assert.rejects(offlineService.createBooking({ ...input, timing: { timingMode: "now", urgency: "emergency" } }), /unavailable right now/);
  assert.equal(offline.writes.some((write) => write.path === "bookings/new-booking"), false);

  const noSchedule = createFixture(providerId, "onsite-mechanic", "Onsite Mechanics", { acceptsScheduledBookings: false });
  const noScheduleService = load("../services/owner/bookingService.ts", noSchedule.deps);
  const slot = { toMillis: () => Math.ceil((Date.now() + 1) / 3_600_000) * 3_600_000 };
  await assert.rejects(noScheduleService.createBooking({ ...input, timing: { timingMode: "scheduled", urgency: "standard", scheduledAt: slot } }), /not accepting scheduled/);
  assert.equal(noSchedule.writes.some((write) => write.path === "bookings/new-booking"), false);

  const scheduled = createFixture(providerId, "onsite-mechanic", "Onsite Mechanics", { acceptsScheduledBookings: true, availability: "offline" });
  const scheduledService = load("../services/owner/bookingService.ts", scheduled.deps);
  await scheduledService.createBooking({ ...input, timing: { timingMode: "scheduled", urgency: "standard", scheduledAt: slot } });
  const booking = scheduled.writes.find((write) => write.path === "bookings/new-booking")?.values;
  assert.equal(booking?.timingMode, "scheduled");
  assert.equal(booking?.urgency, "standard");
  assert.equal(booking?.scheduledAt, slot);
});

test("Mechanic listing form persists Emergency-only and preserves Emergency when scheduling is enabled", () => {
  const form = readFileSync(fileURLToPath(new URL("../components/provider/PublicListingForm.tsx", import.meta.url)), "utf8");
  const screen = readFileSync(fileURLToPath(new URL("../app/(onsite-mechanic)/public-listing.tsx", import.meta.url)), "utf8");

  assert.match(screen, /emergencyServiceAvailable:\s*existing\?\.emergencyServiceAvailable\s*===\s*true\s*\|\|\s*profile\.serviceInfo\.emergencyServiceAvailable/,
    "the listing keeps enabled Emergency support and falls back to the verified profile for old false values");
  assert.match(form, /if\s*\(role\s*===\s*"onsite-mechanic"\s*&&\s*!schedulingEnabled\)\s*setEmergencyServiceAvailable\(true\)/,
    "choosing Emergency only must explicitly enable Emergency");
  assert.match(form, /emergencyServiceAvailable:\s*role\s*===\s*"onsite-mechanic"\s*\?\s*emergencyServiceAvailable\s*===\s*true/,
    "the saved Mechanic listing must serialize the actual Emergency state");
  assert.match(form, /setAcceptsScheduledBookings\(schedulingEnabled\)/,
    "the selected Schedule flag must be saved");
  assert.match(form, /if\s*\(role\s*===\s*"onsite-mechanic"\s*&&\s*!schedulingEnabled\)[\s\S]{0,70}setEmergencyServiceAvailable\(true\)/,
    "enabling Schedule must not reset Emergency support");
});

function createStatusFixture({ file, role, booking, listing, userId = "provider" }) {
  let transactionNumber = 0;
  let providerSnapshotListener;
  const reads = [];
  const writes = [];
  const notifications = [];
  const reservationCalls = [];
  const records = new Map([
    [`bookings/${booking.id}`, { ...booking }],
    [`providerListings/${booking.providerId}`, { ...listing }],
  ]);
  const auth = { currentUser: { uid: userId, displayName: "Provider" } };
  class TestTimestamp {
    constructor(value) { this.value = value; }
    toMillis() { return this.value; }
    toDate() { return new Date(this.value); }
  }
  const firestore = {
    Timestamp: TestTimestamp,
    doc: (_db, ...parts) => ({ path: parts.join("/"), id: parts.at(-1) }),
    collection: (_db, name) => ({ path: name }),
    where: (...parts) => parts,
    query: (...parts) => parts,
    getDocs: async () => ({ docs: [] }),
    serverTimestamp: () => "SERVER_TIME",
    onSnapshot: (_query, callback) => { providerSnapshotListener = callback; return () => {}; },
    runTransaction: async (_db, action) => {
      transactionNumber += 1;
      return action({
        get: async (reference) => {
          reads.push(reference.path);
          if (reference.path.startsWith("providerActiveServices/")) {
            throw new Error("Missing or insufficient permissions: deployed-rules baseline denies providerActiveServices reads");
          }
          const value = records.get(reference.path);
          return { exists: () => value !== undefined, data: () => value };
        },
        set: (reference, values) => {
          if (reference.path.startsWith("providerActiveServices/")) throw new Error("Deployed-rules baseline denies providerActiveServices writes");
          writes.push({ type: "set", path: reference.path, values });
          records.set(reference.path, { ...values });
        },
        update: (reference, values) => {
          if (reference.path.startsWith("providerActiveServices/")) throw new Error("Deployed-rules baseline denies providerActiveServices writes");
          writes.push({ type: "update", path: reference.path, values });
          records.set(reference.path, { ...records.get(reference.path), ...values });
        },
        delete: (reference) => {
          if (reference.path.startsWith("providerActiveServices/")) throw new Error("Deployed-rules baseline denies providerActiveServices writes");
          writes.push({ type: "delete", path: reference.path });
          records.delete(reference.path);
        },
      });
    },
    updateDoc: async (reference, values) => records.set(reference.path, { ...records.get(reference.path), ...values }),
  };
  const timingTypes = {};
  const timing = load("../utils/bookingTiming.ts", {
    "firebase/firestore": { Timestamp: TestTimestamp }, "../types/bookingTiming": timingTypes,
  });
  const service = load(file, {
    "firebase/firestore": firestore,
    "../firebase": { auth, db: {} },
    "../types/bookingTiming": timingTypes,
    "../../types/owner/booking": {}, "../../types/owner/towing": {},
    "../../utils/bookingTiming": timing,
    "../ownerVerificationProfileService": { getOwnerVerificationProfile: async () => ({}), requireVerifiedOwner: async () => {} },
    "../customerNotificationService": { addBookingStatusNotification: (...args) => notifications.push({ kind: "customer-status", args }) },
    "../mechanicNotificationService": { writeMechanicNotification: (...args) => notifications.push({ kind: "mechanic", args }) },
    "../towingNotificationService": { writeTowingNotification: (...args) => notifications.push({ kind: "towing", args }) },
    "../scheduledBookingReservationService": {
      claimScheduledReservation: async (...args) => reservationCalls.push({ kind: "claim", args }),
      releaseScheduledReservation: async (...args) => reservationCalls.push({ kind: "release", args }),
    },
    "../../utils/finalPrice": { isValidFinalPrice: (amount) => Number.isFinite(amount) && amount >= 0 },
  });
  return {
    service, records, auth, TestTimestamp, reads, writes, notifications, reservationCalls,
    get transactionCount() { return transactionNumber; },
    emitProviderSnapshot() {
      const docs = [...records.entries()].filter(([path]) => path.startsWith("bookings/")).map(([path, data]) => ({ id: path.slice("bookings/".length), data: () => data }));
      providerSnapshotListener?.({ docs });
    },
  };
}

test("mechanic and towing customer-to-provider flows work with deployed-rules lock denial", async () => {
  const cases = [
    { role: "onsite-mechanic", name: "Mechanic", category: "Onsite Mechanics", file: "../services/owner/bookingService.ts",
      create: "createBooking", update: "updateBookingStatus", complete: "completeMechanicBooking", cancel: "cancelMechanicBookingAsCustomer", createCase: createCases[0] },
    { role: "towing-company", name: "Towing", category: "Towing", file: "../services/owner/towingService.ts",
      create: "createTowingBooking", update: "updateTowingBookingStatus", complete: "completeTowingBooking", cancel: "cancelTowingBookingAsCustomer", createCase: createCases[2] },
  ];

  for (const item of cases) {
    const providerId = `provider-${item.role}`;
    const createFixtureForOwner = createFixture(providerId, item.role, item.category);
    const customerService = load(item.file, createFixtureForOwner.deps);
    const input = item.createCase.input(providerId);
    if (item.role === "onsite-mechanic") input.timing = { timingMode: "now", urgency: "emergency" };
    const created = await customerService[item.create](input);
    assert.equal(created.status, "pending", `${item.name} creation starts pending`);
    assert.deepEqual(createFixtureForOwner.reads, [`providerListings/${providerId}`], `${item.name} customer transaction reads no lock`);

    const providerFixture = createStatusFixture({ file: item.file, role: item.role, booking: created,
      listing: { providerId, role: item.role, visibility: "active", availability: "available" }, userId: providerId });
    await providerFixture.service[item.update](created.id, "accepted");
    assert.equal(providerFixture.records.get(`bookings/${created.id}`).status, "accepted", `${item.name} provider accepts`);
    await providerFixture.service[item.update](created.id, "en_route");
    await providerFixture.service[item.update](created.id, "arrived");
    await providerFixture.service[item.update](created.id, "in_progress");
    await providerFixture.service[item.complete](created.id, 125.5);
    const completed = providerFixture.records.get(`bookings/${created.id}`);
    assert.equal(completed.status, "completed", `${item.name} provider completes`);
    assert.equal(completed.finalPrice, 125.5, `${item.name} final price is retained`);
    assert.ok(providerFixture.notifications.some((event) => event.kind === "customer-status"), `${item.name} customer notifications remain emitted`);
    assert.ok(providerFixture.notifications.some((event) => event.kind === (item.role === "onsite-mechanic" ? "mechanic" : "towing")), `${item.name} provider notifications remain emitted`);
    assert.equal(providerFixture.reads.some((path) => path.startsWith("providerActiveServices/")), false, `${item.name} transitions never read a lock`);
    assert.equal(providerFixture.writes.some((write) => write.path.startsWith("providerActiveServices/")), false, `${item.name} transitions never write a lock`);

    const declineCreate = createFixture(providerId, item.role, item.category);
    const declineCustomer = load(item.file, declineCreate.deps);
    const declineInput = item.createCase.input(providerId);
    if (item.role === "onsite-mechanic") declineInput.timing = { timingMode: "now", urgency: "emergency" };
    const pendingDecline = await declineCustomer[item.create](declineInput);
    const declineProvider = createStatusFixture({ file: item.file, role: item.role, booking: pendingDecline,
      listing: { providerId, role: item.role, visibility: "active", availability: "available" }, userId: providerId });
    await declineProvider.service[item.update](pendingDecline.id, "rejected", "Outside service area");
    assert.equal(declineProvider.records.get(`bookings/${pendingDecline.id}`).declineReason, "Outside service area", `${item.name} decline reason persists`);

    const cancelCreate = createFixture(providerId, item.role, item.category);
    const cancelCustomer = load(item.file, cancelCreate.deps);
    const cancelInput = item.createCase.input(providerId);
    if (item.role === "onsite-mechanic") cancelInput.timing = { timingMode: "now", urgency: "emergency" };
    const pendingCancel = await cancelCustomer[item.create](cancelInput);
    const cancelFixture = createStatusFixture({ file: item.file, role: item.role, booking: pendingCancel,
      listing: { providerId, role: item.role, visibility: "active", availability: "available" }, userId: "owner" });
    await cancelFixture.service[item.cancel](pendingCancel.id, "No longer needed");
    assert.equal(cancelFixture.records.get(`bookings/${pendingCancel.id}`).status, "cancelled", `${item.name} customer cancellation succeeds`);
    assert.equal(cancelFixture.records.get(`bookings/${pendingCancel.id}`).cancellationReason, "No longer needed", `${item.name} cancellation reason persists`);
    assert.equal(cancelFixture.reads.some((path) => path.startsWith("providerActiveServices/")), false, `${item.name} cancellation never reads a lock`);
  }
});

test("scheduled mechanic and towing services retain timing and reservation behavior without locks", async () => {
  const cases = [
    { role: "onsite-mechanic", category: "Onsite Mechanics", file: "../services/owner/bookingService.ts", create: "createBooking", update: "updateBookingStatus", createCase: createCases[0] },
    { role: "towing-company", category: "Towing", file: "../services/owner/towingService.ts", create: "createTowingBooking", update: "updateTowingBookingStatus", createCase: createCases[2] },
  ];
  for (const item of cases) {
    const providerId = `provider-${item.role}`;
    const slotMs = Math.ceil((Date.now() + 1) / 3_600_000) * 3_600_000;
    const createFixtureForOwner = createFixture(providerId, item.role, item.category, { acceptsScheduledBookings: true });
    const customerService = load(item.file, createFixtureForOwner.deps);
    const input = item.createCase.input(providerId);
    input.timing = { timingMode: "scheduled", urgency: "standard", scheduledAt: { toMillis: () => slotMs } };
    const created = await customerService[item.create](input);
    const providerFixture = createStatusFixture({ file: item.file, role: item.role, booking: created,
      listing: { providerId, role: item.role, visibility: "active", availability: "offline" }, userId: providerId });
    providerFixture.records.get(`bookings/${created.id}`).scheduledAt = new providerFixture.TestTimestamp(slotMs);
    await providerFixture.service[item.update](created.id, "accepted");
    assert.equal(providerFixture.reservationCalls.filter((call) => call.kind === "claim").length, 1, `${item.role} scheduled acceptance still claims its reservation`);
    await assert.rejects(providerFixture.service[item.update](created.id, "en_route"), /cannot start before its appointment/);
    providerFixture.records.get(`bookings/${created.id}`).scheduledAt = new providerFixture.TestTimestamp(Date.now() - 60_000);
    await providerFixture.service[item.update](created.id, "en_route");
    assert.equal(providerFixture.records.get(`bookings/${created.id}`).status, "en_route");
    assert.equal(providerFixture.reads.some((path) => path.startsWith("providerActiveServices/")), false);
    assert.equal(providerFixture.writes.some((write) => write.path.startsWith("providerActiveServices/")), false);
  }
});

test("mechanic and towing booking refresh subscriptions emit terminal bookings without lock cleanup", () => {
  const cases = [
    { role: "onsite-mechanic", file: "../services/owner/bookingService.ts", subscribe: "subscribeToMechanicRequests" },
    { role: "towing-company", file: "../services/owner/towingService.ts", subscribe: "subscribeToTowingRequests" },
  ];
  for (const item of cases) {
    const booking = { id: "terminal", providerId: "provider", customerId: "owner", bookingType: item.role,
      status: "completed", createdAt: "2026-10-29T00:00:00.000Z", updatedAt: "2026-10-29T00:00:00.000Z" };
    const fixture = createStatusFixture({ file: item.file, role: item.role, booking,
      listing: { providerId: "provider", role: item.role, visibility: "active", availability: "available" } });
    let received;

    fixture.service[item.subscribe]((bookings) => { received = bookings; });
    fixture.emitProviderSnapshot();

    assert.equal(received.length, 1, `${item.role} subscription still emits bookings`);
    assert.equal(received[0].id, "terminal");
    assert.equal(fixture.transactionCount, 0, `${item.role} refresh performs no cleanup transaction`);
    assert.equal(fixture.reads.some((path) => path.startsWith("providerActiveServices/")), false, `${item.role} refresh reads no active-service lock`);
  }
});

test("Towing phone snapshot is preserved and only contact URIs are normalized", async () => {
  const contact = load("../utils/towingContact.ts", {});
  assert.equal(contact.buildTowingContactUrl("tel", "  +63 (917) 123-4567 "), "tel:+639171234567");
  assert.equal(contact.buildTowingContactUrl("sms", "09 17-123-4567"), "sms:09171234567");
  assert.equal(contact.buildTowingContactUrl("tel", undefined), null);
  assert.equal(contact.buildTowingContactUrl("sms", "   "), null);
  assert.equal(contact.buildTowingContactUrl("tel", "contact 0917"), null);
  assert.equal(ownerVerification.personal.phone, " +63 (917) 123-4567 ", "URI formatting must not modify the stored snapshot");
});

test("Home Garage accepts Vehicle Arrived for an accepted scheduled repair before its appointment", async () => {
  const writes = [];
  class TestTimestamp {}
  const booking = {
    bookingType: "homegarage", providerId: "garage-provider", status: "accepted",
    timingMode: "scheduled", scheduledAt: new TestTimestamp(),
  };
  const service = load("../services/homeGarageBookingService.ts", {
    "firebase/firestore": {
      Timestamp: TestTimestamp,
      doc: (_db, ...parts) => ({ path: parts.join("/") }),
      runTransaction: async (_db, action) => action({
        get: async () => ({ exists: () => true, data: () => booking }),
        update: (reference, values) => writes.push({ path: reference.path, values }),
      }),
      serverTimestamp: () => "SERVER_TIMESTAMP",
    },
    "./firebase": { auth: { currentUser: { uid: "garage-provider" } }, db: {} },
    "./ownerVerificationProfileService": {},
    "./customerNotificationService": { addBookingStatusNotification: () => {}, addHomeGaragePriceNotification: () => {} },
    "./homeGarageNotificationService": { writeHomeGarageProviderNotification: () => {} },
    "../utils/bookingTiming": {},
    "./scheduledBookingReservationService": {},
    "../utils/finalPrice": { isValidFinalPrice: () => true },
  });

  await service.startHomeGarageRepair("scheduled-garage");
  assert.deepEqual(writes, [{ path: "bookings/scheduled-garage", values: { status: "vehicle_arrived", updatedAt: "SERVER_TIMESTAMP" } }]);
});
