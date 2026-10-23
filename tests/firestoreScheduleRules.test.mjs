// Firestore emulator rules checks. Set VERESC_TEST_NODE_MODULES to the isolated
// temporary project's node_modules; this file never targets production.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const isolatedRequire = createRequire(new URL(`file:///${process.env.VERESC_TEST_NODE_MODULES.replaceAll("\\", "/")}/package.json`));
const { initializeTestEnvironment, assertFails, assertSucceeds } = isolatedRequire("@firebase/rules-unit-testing");
const { Timestamp, doc, getDoc, getDocs, collection, query, where, runTransaction, serverTimestamp, updateDoc, setDoc } = isolatedRequire("firebase/firestore");
const providerId = "mechanic-provider";
const customerId = "vehicle-owner";
const projectId = "demo-veresc-schedule-rules";
const rules = readFileSync(fileURLToPath(new URL("../firestore.rules", import.meta.url)), "utf8");
let env;

before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: 8080, rules } });
});
after(async () => { await env?.cleanup(); });

function slotTimestamp() {
  const nextHour = Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 3_600_000;
  return Timestamp.fromMillis(nextHour);
}
function slotId(provider, at) { return `${provider}_${at.toMillis()}`; }
function auth(uid) { return env.authenticatedContext(uid).firestore(); }
async function assertDeniedWithoutExpressionLimit(action, label) {
  let failure;
  try { await action(); } catch (error) { failure = error; }
  assert.ok(failure, `${label} unexpectedly succeeded`);
  assert.doesNotMatch(String(failure), /maximum of 1000 expressions|evaluation limit/i, `${label} was denied by an evaluation limit`);
  assert.match(String(failure), /PERMISSION_DENIED|permission-denied/, `${label} did not fail with a Firestore permission denial`);
}
async function seedBooking(id, { status = "pending", bookingType = "onsite-mechanic", provider = providerId, customer = customerId, at = slotTimestamp(), timingMode = "scheduled" } = {}) {
  const data = {
    bookingType, customerId: customer, providerId: provider, status, providerName: "Provider", customerName: "Owner",
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  };
  if (["onsite-mechanic", "towing-company", "shop-owner", "homegarage"].includes(bookingType)) {
    Object.assign(data, { vehicle: "Vehicle" });
  }
  if (["shop-owner", "homegarage"].includes(bookingType)) {
    Object.assign(data, { problem: "Repair" });
  }
  if (bookingType === "towing-company") {
    Object.assign(data, { vehicle: "Vehicle", pickupLocation: "Pickup", destination: "Destination" });
  }
  if (timingMode) Object.assign(data, { timingMode, urgency: "standard", scheduledAt: at });
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`bookings/${id}`).set(data);
  });
  return at;
}
async function acceptAsProvider(db, id, at, provider = providerId) {
  const reservation = doc(db, "providerScheduleReservations", slotId(provider, at));
  const booking = doc(db, "bookings", id);
  await runTransaction(db, async (transaction) => {
    const [existing, current] = await Promise.all([transaction.get(reservation), transaction.get(booking)]);
    if (existing.exists()) throw new Error("appointment window already claimed");
    if (current.data()?.status !== "pending") throw new Error("booking is no longer pending");
    transaction.set(reservation, { providerId: provider, bookingId: id, scheduledAt: at, createdAt: serverTimestamp() });
    transaction.update(booking, { status: "accepted", updatedAt: serverTimestamp() });
  });
}

async function startWithNotifications(db, id, status, notificationCollection) {
  const bookingRef = doc(db, "bookings", id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(bookingRef);
    const booking = snapshot.data();
    transaction.update(bookingRef, { status, updatedAt: serverTimestamp() });
    transaction.set(doc(db, `users/${booking.customerId}/notifications/${id}`), {
      customerId: booking.customerId, bookingId: id, bookingType: booking.bookingType,
      providerId: booking.providerId, providerName: booking.providerName, status,
      title: "Service request update", message: `${booking.providerName} is on the way to you.`,
      isRead: false, readAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    const providerNotification = {
      bookingId: id, providerId: booking.providerId, customerId: booking.customerId,
      customerName: booking.customerName, vehicle: booking.vehicle, status,
      title: "Request status updated", message: `The request for ${booking.vehicle} is now ${status}.`,
      isRead: true, readAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    if (notificationCollection === "towingNotifications") {
      Object.assign(providerNotification, { pickupLocation: booking.pickupLocation, destination: booking.destination });
    }
    if (notificationCollection === "shopNotifications") Object.assign(providerNotification, { problem: booking.problem });
    transaction.set(doc(db, `users/${booking.providerId}/${notificationCollection}/${id}`), providerNotification);
  });
}

async function seedProgressNotifications(id, notificationCollection) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const booking = (await db.doc(`bookings/${id}`).get()).data();
    await db.doc(`users/${customerId}/notifications/${id}`).set({
      customerId: booking.customerId, bookingId: id, bookingType: booking.bookingType,
      providerId: booking.providerId, providerName: booking.providerName,
      status: "accepted", title: "Service request update", message: "Request accepted.",
      isRead: false, readAt: null, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    const providerNotification = {
      bookingId: id, providerId: booking.providerId, customerId: booking.customerId,
      customerName: booking.customerName, vehicle: booking.vehicle, status: "accepted",
      title: "Request status updated", message: "Request accepted.", isRead: true,
      readAt: Timestamp.now(), createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    };
    if (notificationCollection === "towingNotifications") {
      Object.assign(providerNotification, { pickupLocation: booking.pickupLocation, destination: booking.destination });
    }
    if (notificationCollection === "shopNotifications") Object.assign(providerNotification, { problem: booking.problem });
    await db.doc(`users/${booking.providerId}/${notificationCollection}/${id}`).set(providerNotification);
  });
}

test("competing acceptances atomically allow one provider/hour reservation", async () => {
  for (const [bookingType, provider] of [
    ["onsite-mechanic", providerId], ["towing-company", "tow-provider"],
    ["shop-owner", "shop-provider"], ["homegarage", "garage-provider"],
  ]) {
    await env.clearFirestore();
    const at = slotTimestamp();
    if (bookingType === "shop-owner" || bookingType === "homegarage") {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc(`users/${provider}`).set({ uid: provider, role: bookingType });
        if (bookingType === "shop-owner") {
          await db.doc(`providers/${provider}`).set({ uid: provider, role: bookingType, verified: true });
        } else {
          await db.doc(`users/${provider}/homeGarageVerification/profile`).set({ uid: provider, role: bookingType, verificationStatus: "VERIFIED" });
        }
      });
    }
    const ids = [`race-${bookingType}-a`, `race-${bookingType}-b`];
    await seedBooking(ids[0], { at, bookingType, provider });
    await seedBooking(ids[1], { at, bookingType, provider });
    const db = auth(provider);
    const results = await Promise.allSettled(ids.map((id) => acceptAsProvider(db, id, at, provider)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1, `${bookingType}: exactly one acceptance must succeed`);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1, `${bookingType}: the competing acceptance must fail`);
    const winner = results[0].status === "fulfilled" ? ids[0] : ids[1];
    const reservation = await getDoc(doc(db, "providerScheduleReservations", slotId(provider, at)));
    assert.equal(reservation.data()?.bookingId, winner);
    const finalStatuses = await Promise.all(ids.map(async (id) => (await getDoc(doc(db, "bookings", id))).data()?.status));
    assert.deepEqual(finalStatuses.sort(), ["accepted", "pending"]);
  }
});

test("eligible owner cancellation atomically releases the reservation", async () => {
  await env.clearFirestore();
  const db = auth(customerId);
  for (const [id, type] of [["cancel-mechanic", "onsite-mechanic"], ["cancel-tow", "towing-company"], ["cancel-shop", "shop-owner"], ["cancel-garage", "homegarage"]]) {
    const at = slotTimestamp();
    await seedBooking(id, { status: "accepted", at, bookingType: type });
    await env.withSecurityRulesDisabled(async (context) => {
      const slotProvider = `${type}-provider`;
      await context.firestore().doc(`bookings/${id}`).update({ providerId: slotProvider });
      await context.firestore().doc(`providerScheduleReservations/${slotId(slotProvider, at)}`).set({ providerId: slotProvider, bookingId: id, scheduledAt: at, createdAt: Timestamp.now() });
    });
    const slotProvider = `${type}-provider`;
    await assertSucceeds(runTransaction(db, async (transaction) => {
      const booking = doc(db, "bookings", id);
      const reservation = doc(db, "providerScheduleReservations", slotId(slotProvider, at));
      await Promise.all([transaction.get(booking), transaction.get(reservation)]);
      transaction.delete(reservation);
      transaction.update(booking, { status: "cancelled", updatedAt: serverTimestamp() });
    }));
    assert.equal((await getDoc(doc(db, "bookings", id))).data()?.status, "cancelled");
    assert.equal((await getDoc(doc(db, "providerScheduleReservations", slotId(slotProvider, at)))).exists(), false);
  }
});

test("assigned providers can start scheduled services early and unauthorized transitions remain denied", async () => {
  await env.clearFirestore();
  const at = slotTimestamp();
  await seedBooking("early-start", { status: "accepted", at });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc("users/shop-provider").set({ role: "shop-owner" });
    await db.doc("providers/shop-provider").set({ uid: "shop-provider", role: "shop-owner", verified: true });
    await db.doc("bookings/early-shop").set({ bookingType: "shop-owner", customerId, customerName: "Owner", providerId: "shop-provider", status: "accepted", timingMode: "scheduled", urgency: "standard", scheduledAt: at, providerName: "Shop", vehicle: "Vehicle", problem: "Repair", updatedAt: Timestamp.now() });
    await db.doc("users/garage-provider").set({ role: "homegarage" });
    await db.doc("users/garage-provider/homeGarageVerification/profile").set({ uid: "garage-provider", role: "homegarage", verificationStatus: "VERIFIED" });
    await db.doc("bookings/early-garage").set({ bookingType: "homegarage", customerId, customerName: "Owner", providerId: "garage-provider", status: "accepted", timingMode: "scheduled", urgency: "standard", scheduledAt: at, providerName: "Garage", vehicle: "Vehicle", problem: "Repair", updatedAt: Timestamp.now() });
    await db.doc("bookings/early-tow").set({ bookingType: "towing-company", customerId, customerName: "Owner", providerId: "tow-provider", status: "accepted", timingMode: "scheduled", urgency: "standard", scheduledAt: at, providerName: "Tow", vehicle: "Vehicle", pickupLocation: "Pickup", destination: "Destination", updatedAt: Timestamp.now() });
    await db.doc(`providerScheduleReservations/${slotId("tow-provider", at)}`).set({ providerId: "tow-provider", bookingId: "early-tow", scheduledAt: at, createdAt: Timestamp.now() });
    for (const [provider, bookingId] of [[providerId, "early-start"], ["shop-provider", "early-shop"], ["garage-provider", "early-garage"]]) {
      await db.doc(`providerScheduleReservations/${slotId(provider, at)}`).set({ providerId: provider, bookingId, scheduledAt: at, createdAt: Timestamp.now() });
    }
  });
  const provider = auth(providerId);
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`providerScheduleReservations/${slotId(providerId, at)}`).set({ providerId, bookingId: "early-start", scheduledAt: at, createdAt: Timestamp.now() });
  });
  const attacker = auth("attacker");
  await assertDeniedWithoutExpressionLimit(
    () => setDoc(doc(attacker, "providerScheduleReservations", slotId(providerId, at)), { providerId, bookingId: "early-start", scheduledAt: at, createdAt: serverTimestamp() }),
    "unauthorized reservation claim",
  );
  const deniedTransitions = [
    ["Mechanic", "early-start", "en_route", providerId],
    ["Towing", "early-tow", "en_route", "tow-provider"],
    ["Auto Shop", "early-shop", "vehicle_arrived", "shop-provider"],
    ["Home Garage", "early-garage", "vehicle_arrived", "garage-provider"],
  ];
  for (const [label, id, status] of deniedTransitions) {
    await assertDeniedWithoutExpressionLimit(
      () => updateDoc(doc(auth(customerId), "bookings", id), { status, updatedAt: serverTimestamp() }),
      `owner cannot start ${label}`,
    );
    await assertDeniedWithoutExpressionLimit(
      () => updateDoc(doc(attacker, "bookings", id), { status, updatedAt: serverTimestamp() }),
      `unassigned user cannot start ${label}`,
    );
  }

  await seedProgressNotifications("early-start", "mechanicNotifications");
  await seedProgressNotifications("early-tow", "towingNotifications");
  await seedProgressNotifications("early-shop", "shopNotifications");
  await assertSucceeds(startWithNotifications(provider, "early-start", "en_route", "mechanicNotifications"));
  await assertSucceeds(startWithNotifications(auth("tow-provider"), "early-tow", "en_route", "towingNotifications"));
  await assertSucceeds(startWithNotifications(auth("shop-provider"), "early-shop", "vehicle_arrived", "shopNotifications"));
  // The existing Home Garage Vehicle Arrived service updates only the booking;
  // keep that notification behavior unchanged.
  await assertSucceeds(updateDoc(doc(auth("garage-provider"), "bookings", "early-garage"), { status: "vehicle_arrived", updatedAt: serverTimestamp() }));
  for (const [providerUid, id, status] of [
    [providerId, "early-start", "en_route"], ["tow-provider", "early-tow", "en_route"],
    ["shop-provider", "early-shop", "vehicle_arrived"], ["garage-provider", "early-garage", "vehicle_arrived"],
  ]) {
    assert.equal((await getDoc(doc(auth(providerUid), "bookings", id))).data()?.status, status);
    assert.equal((await getDoc(doc(auth(providerUid), "providerScheduleReservations", slotId(providerUid, at)))).exists(), true);
  }
  for (const [providerUid, id, collectionName, status] of [
    [providerId, "early-start", "mechanicNotifications", "en_route"],
    ["tow-provider", "early-tow", "towingNotifications", "en_route"],
    ["shop-provider", "early-shop", "shopNotifications", "vehicle_arrived"],
  ]) {
    assert.equal((await getDoc(doc(auth(customerId), "users", customerId, "notifications", id))).data()?.status, status);
    assert.equal((await getDoc(doc(auth(providerUid), "users", providerUid, collectionName, id))).data()?.status, status);
  }
  await assertDeniedWithoutExpressionLimit(() => runTransaction(attacker, async (transaction) => {
    const booking = doc(attacker, "bookings", "early-start");
    const reservation = doc(attacker, "providerScheduleReservations", slotId(providerId, at));
    await Promise.all([transaction.get(booking), transaction.get(reservation)]);
    transaction.delete(reservation);
    transaction.update(booking, { status: "cancelled", updatedAt: serverTimestamp() });
  }), "unauthorized atomic cancellation and reservation release");
});

test("scheduled discovery includes active offline opt-ins and excludes hidden listings", async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const base = { providerId: "p", role: "onsite-mechanic", category: "Onsite Mechanics", businessName: "Mechanic", location: { latitude: 14, longitude: 121 }, serviceAreaLabel: "QC", availability: "offline", acceptsScheduledBookings: true };
    await db.doc("providerListings/offline-active").set({ ...base, providerId: "offline-active", visibility: "active" });
    await db.doc("providerListings/hidden").set({ ...base, providerId: "hidden", visibility: "inactive" });
    await db.doc("providerListings/no-schedule").set({ ...base, providerId: "no-schedule", visibility: "active", acceptsScheduledBookings: false });
  });
  const db = auth(customerId);
  const scheduled = await getDocs(query(collection(db, "providerListings"), where("visibility", "==", "active"), where("acceptsScheduledBookings", "==", true)));
  assert.deepEqual(scheduled.docs.map((item) => item.id), ["offline-active"]);
  const immediate = await getDocs(query(collection(db, "providerListings"), where("visibility", "==", "active"), where("availability", "==", "available")));
  assert.deepEqual(immediate.docs.map((item) => item.id), []);
});

test("public shop listing saves keep their independently selected map point and protected fields", async () => {
  await env.clearFirestore();
  const uid = "shop-listing-owner";
  const ratingSummary = { average: 4.5, count: 3 };
  const listing = {
    providerId: uid, role: "shop-owner", category: "Auto Shops", businessName: "Auto Shop",
    location: { latitude: 1.32, longitude: 103.81 }, availability: "available", visibility: "inactive",
    ratingSummary, services: ["Engine repair"], vehicleTypes: ["Car", "SUV", "Van", "Pickup Truck"],
    serviceAreaLabel: "Service area", description: "", contactPhone: "12345678901", startingPrice: null,
    operatingHours: "09:00–18:00 Monday-Friday", emergencyServiceAvailable: true,
    photoUrls: ["https://example.invalid/shop.jpg"], hoursType: "same_daily", is24Hours: false,
    weeklyHours: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      .map((day) => ({ day, open: "09:00", close: "18:00" })),
  };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${uid}`).set({ role: "shop-owner" });
    await db.doc(`providers/${uid}`).set({ uid, role: "shop-owner", verified: true, status: "open", latitude: 1.3, longitude: 103.8 });
    await db.doc(`providerListings/${uid}`).set(listing);
  });
  const db = auth(uid);
  const listingRef = doc(db, "providerListings", uid);
  const savedPin = { latitude: 1.32, longitude: 103.81 };
  const payload = {
    businessName: listing.businessName, location: savedPin, availability: "available", serviceAreaLabel: listing.serviceAreaLabel,
    description: "Servicing local vehicles.", contactPhone: listing.contactPhone, services: listing.services,
    vehicleTypes: listing.vehicleTypes, operatingHours: listing.operatingHours, startingPrice: null,
    emergencyServiceAvailable: true, photoUrls: listing.photoUrls, hoursType: listing.hoursType,
    is24Hours: false, weeklyHours: listing.weeklyHours,
  };
  await assertSucceeds(runTransaction(db, async (transaction) => {
    const provider = (await transaction.get(doc(db, "providers", uid))).data();
    assert.equal(provider?.verified, true);
    assert.equal((await transaction.get(listingRef)).exists(), true);
    transaction.update(listingRef, payload);
  }));
  const saved = await getDoc(listingRef);
  assert.deepEqual(saved.data()?.location, savedPin);
  assert.equal(saved.data()?.visibility, "inactive");
  assert.deepEqual(saved.data()?.ratingSummary, ratingSummary);
  await assertFails(updateDoc(doc(auth("unrelated-user"), "providerListings", uid), { description: "unauthorized" }));
});

test("Mechanic listing saves Emergency-only and Schedule flags; both booking modes pass existing rules", async () => {
  await env.clearFirestore();
  const provider = "mechanic-emergency-provider";
  const owner = "mechanic-emergency-owner";
  const listing = {
    providerId: provider, role: "onsite-mechanic", category: "Onsite Mechanics",
    businessName: "Verified Mechanic", location: { latitude: 14.67, longitude: 121.04 },
    availability: "available", visibility: "active", ratingSummary: { average: 0, count: 0 },
    services: ["Engine Diagnostics"], vehicleTypes: ["Car"], serviceAreaLabel: "Quezon City",
    description: "", contactPhone: "09170000000", startingPrice: null, operatingHours: "Daily, 8 AM-6 PM",
    emergencyServiceAvailable: false, acceptsScheduledBookings: false,
  };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${provider}`).set({ uid: provider, role: "onsite-mechanic" });
    await db.doc(`users/${provider}/providerProfile/profile`).set({
      uid: provider, role: "onsite-mechanic", verificationStatus: "VERIFIED",
    });
    await db.doc(`providerListings/${provider}`).set(listing);
    await db.doc(`users/${owner}`).set({ uid: owner, role: "owner" });
    await db.doc(`users/${owner}/ownerProfile/profile`).set({
      uid: owner, role: "owner", verificationStatus: "VERIFIED",
    });
  });

  const providerDb = auth(provider);
  const listingRef = doc(providerDb, "providerListings", provider);
  // Emergency only explicitly enables Emergency and leaves Schedule disabled.
  await assertSucceeds(updateDoc(listingRef, { emergencyServiceAvailable: true, acceptsScheduledBookings: false }));
  let savedListing = (await getDoc(listingRef)).data();
  assert.equal(savedListing?.emergencyServiceAvailable, true);
  assert.equal(savedListing?.acceptsScheduledBookings, false);
  // Enabling Schedule changes only its own flag and preserves Emergency.
  await assertSucceeds(updateDoc(listingRef, { acceptsScheduledBookings: true }));
  savedListing = (await getDoc(listingRef)).data();
  assert.equal(savedListing?.emergencyServiceAvailable, true);
  assert.equal(savedListing?.acceptsScheduledBookings, true);

  const ownerDb = auth(owner);
  async function createWithNotification(id, timing) {
    const booking = {
      bookingType: "onsite-mechanic", customerId: owner, customerName: "Owner", customerEmail: "owner@example.test",
      providerId: provider, providerName: listing.businessName, providerPhone: listing.contactPhone,
      vehicleId: "vehicle", vehicle: "Toyota Vios", vehicleYear: 2020, vehiclePlate: "ABC123",
      latitude: 14.6, longitude: 121.0, problem: "Engine will not start", notes: "", startingPrice: "Free",
      status: "pending", ...timing, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await runTransaction(ownerDb, async (transaction) => {
      transaction.set(doc(ownerDb, "bookings", id), booking);
      transaction.set(doc(ownerDb, `users/${provider}/mechanicNotifications/${id}`), {
        bookingId: id, providerId: provider, customerId: owner, customerName: "Owner", vehicle: "Toyota Vios",
        status: "pending", title: "New service request", message: "New service request", isRead: false,
        readAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    });
  }

  await assertSucceeds(createWithNotification("mechanic-emergency-booking", {
    timingMode: "now", urgency: "emergency",
  }));
  await assertSucceeds(createWithNotification("mechanic-scheduled-booking", {
    timingMode: "scheduled", urgency: "standard", scheduledAt: slotTimestamp(),
  }));
});

test("Towing booking phone must match the verified owner profile and cannot be changed later", async () => {
  await env.clearFirestore();
  const uid = "towing-owner";
  const provider = "towing-provider";
  const ownerPhone = "09171234567";
  const booking = {
    bookingType: "towing-company", customerId: uid, customerName: "Owner", customerEmail: "owner@example.test",
    customerPhone: ownerPhone, providerId: provider, providerName: "Tow Provider", vehicleId: "vehicle",
    vehicle: "Toyota Vios", vehicleYear: 2020, vehiclePlate: "ABC123", latitude: 14.6, longitude: 121.0,
    providerLatitude: 14.67, providerLongitude: 121.04, destinationLatitude: 14.7, destinationLongitude: 121.1,
    providerToPickupDistanceKm: 1, pickupToDestinationDistanceKm: 2, totalDistanceKm: 3, basePrice: 100,
    pricePerKm: 10, distanceCharge: 30, estimatedTotalPrice: 130, pricingMode: "fixed", dispatcherPhone: "",
    pickupLocation: "Pickup", destination: "Destination", towingType: "Flatbed Towing",
    vehicleCondition: "Vehicle cannot move", notes: "", startingPrice: "130", status: "pending",
    timingMode: "now", urgency: "standard", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${uid}`).set({ role: "owner" });
    await db.doc(`users/${uid}/ownerProfile/profile`).set({ uid, role: "owner", verificationStatus: "VERIFIED", personal: { phone: ownerPhone } });
    await db.doc(`providerListings/${provider}`).set({ providerId: provider, role: "towing-company", category: "Towing", businessName: "Tow Provider", visibility: "active", availability: "available", emergencyServiceAvailable: true, acceptsScheduledBookings: true, location: { latitude: 14.67, longitude: 121.04 } });
    await db.doc(`users/${provider}/towingPricing/config`).set({ pricingMode: "fixed", basePrice: 100, pricePerKm: 10 });
    await db.doc(`users/${provider}/towingCompanyProfile/profile`).set({ uid: provider, role: "towing-company", verificationStatus: "VERIFIED" });
    await db.doc("bookings/immutable-phone").set({ ...booking, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  });
  const db = auth(uid);
  const bookingRef = doc(db, "bookings", "authorized-tow");
  const creationAttempts = [
    ["tow-now", { timingMode: "now", urgency: "standard" }],
    ["tow-emergency", { timingMode: "now", urgency: "emergency" }],
    ["tow-scheduled", { timingMode: "scheduled", urgency: "standard", scheduledAt: slotTimestamp() }],
  ];
  const creationResults = await Promise.all(creationAttempts.map(async ([id, timing]) => {
    try {
      await setDoc(doc(db, "bookings", id), { ...booking, ...timing });
      return { id, error: null };
    } catch (error) { return { id, error: String(error) }; }
  }));
  let notificationError = null;
  try { await runTransaction(db, async (transaction) => {
    transaction.set(bookingRef, booking);
    transaction.set(doc(db, "towingNotifications", "authorized-tow"), {
      bookingId: "authorized-tow", providerId: provider, customerId: uid, customerName: "Owner",
      vehicle: "Toyota Vios", pickupLocation: "Pickup", destination: "Destination", status: "pending",
      title: "New towing request", message: "New towing request", isRead: false,
      readAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }); } catch (error) { notificationError = String(error); }
  const deniedAttempts = await Promise.all([
    ["forged phone", () => setDoc(doc(db, "bookings", "forged-phone"), { ...booking, customerPhone: "09999999999" })],
    ["invalid provider name", () => setDoc(doc(db, "bookings", "forged-provider-name"), { ...booking, providerName: "Different Provider" })],
    ["unauthorized owner", () => setDoc(doc(auth("unauthorized-owner"), "bookings", "unauthorized-tow"), booking)],
    ["owner phone update", () => updateDoc(doc(db, "bookings", "immutable-phone"), { customerPhone: "09999999999" })],
    ["provider phone update", () => updateDoc(doc(auth(provider), "bookings", "immutable-phone"), { customerPhone: "09999999999" })],
  ].map(async ([label, attempt]) => {
    try { await attempt(); return { label, allowed: true, error: "" }; }
    catch (error) { return { label, allowed: false, error: String(error) }; }
  }));
  assert.deepEqual(deniedAttempts.filter(({ allowed }) => allowed), [], "forged phone, invalid listing name, and unauthorized owner must be denied");
  assert.deepEqual(deniedAttempts.filter(({ error }) => /maximum of 1000 expressions/.test(error)), [], "security denials must not be expression-limit failures");
  assert.deepEqual(creationResults.filter(({ error }) => error === null).map(({ id }) => id), creationAttempts.map(([id]) => id),
    `valid Towing create attempts must succeed without expression-limit errors: ${creationResults.map(({ id, error }) => `${id}: ${error ?? "allowed"}`).join("; ")}; notification transaction: ${notificationError ?? "allowed"}`);
});

test("due scheduled service starts and notifications succeed for all four providers", async () => {
  await env.clearFirestore();
  const at = Timestamp.fromMillis(Date.now() - 3_600_000);
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc("users/shop-provider").set({ role: "shop-owner" });
    await db.doc("users/garage-provider").set({ role: "homegarage" });
    await db.doc("users/garage-provider/homeGarageVerification/profile").set({ uid: "garage-provider", role: "homegarage", verificationStatus: "VERIFIED" });
  });
  const cases = [
    ["scheduled-mechanic", "onsite-mechanic", providerId, "en_route"],
    ["scheduled-tow", "towing-company", "tow-provider", "en_route"],
    ["scheduled-shop", "shop-owner", "shop-provider", "vehicle_arrived"],
    ["scheduled-garage", "homegarage", "garage-provider", "vehicle_arrived"],
  ];
  for (const [id, bookingType, provider, status] of cases) {
    await seedBooking(id, { status: "accepted", bookingType, provider, at });
    if (bookingType === "onsite-mechanic") {
      await seedProgressNotifications(id, "mechanicNotifications");
      await assertSucceeds(startWithNotifications(auth(provider), id, status, "mechanicNotifications"));
    } else if (bookingType === "towing-company") {
      await seedProgressNotifications(id, "towingNotifications");
      await assertSucceeds(startWithNotifications(auth(provider), id, status, "towingNotifications"));
    } else if (bookingType === "shop-owner") {
      await seedProgressNotifications(id, "shopNotifications");
      await assertSucceeds(startWithNotifications(auth(provider), id, status, "shopNotifications"));
    } else {
      await assertSucceeds(updateDoc(doc(auth(provider), "bookings", id), { status, updatedAt: serverTimestamp() }));
    }
  }
});

test("legacy bookings without timing fields progress as Now without reservations", async () => {
  await env.clearFirestore();
  const at = slotTimestamp();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc("users/shop-provider").set({ role: "shop-owner" });
    await db.doc("users/garage-provider").set({ role: "homegarage" });
    await db.doc("users/garage-provider/homeGarageVerification/profile").set({ uid: "garage-provider", role: "homegarage", verificationStatus: "VERIFIED" });
  });
  const cases = [
    ["legacy-mechanic", "onsite-mechanic", providerId, "en_route"],
    ["legacy-tow", "towing-company", "tow-provider", "en_route"],
    ["legacy-shop", "shop-owner", "shop-provider", "vehicle_arrived"],
    ["legacy-garage", "homegarage", "garage-provider", "vehicle_arrived"],
  ];
  for (const [id, bookingType, provider, status] of cases) {
    await seedBooking(id, { status: "accepted", bookingType, provider, timingMode: null });
    await assertSucceeds(updateDoc(doc(auth(provider), "bookings", id), { status, updatedAt: serverTimestamp() }));
    await env.withSecurityRulesDisabled(async (context) => {
      assert.equal((await context.firestore().doc(`providerScheduleReservations/${slotId(provider, at)}`).get()).exists, false);
    });
  }
});

test("Auto Shop and Home Garage follow the six-step service flow; Home Garage assessment is optional", async () => {
  await env.clearFirestore();
  const now = auth("garage-provider");
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc("users/garage-provider").set({ role: "homegarage" });
    await db.doc("users/garage-provider/homeGarageVerification/profile").set({ uid: "garage-provider", role: "homegarage", verificationStatus: "VERIFIED" });
    await db.doc("bookings/new-garage-flow").set({ bookingType: "homegarage", customerId, providerId: "garage-provider", providerName: "Garage", status: "accepted", timingMode: "now", urgency: "standard", updatedAt: Timestamp.now() });
  });
  for (const status of ["vehicle_arrived", "diagnosing", "repairing"]) {
    await assertSucceeds(updateDoc(doc(now, "bookings", "new-garage-flow"), { status, updatedAt: serverTimestamp() }));
    if (status === "vehicle_arrived") {
      await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(auth(customerId), "bookings", "new-garage-flow"), { status: "cancelled", updatedAt: serverTimestamp() }), "Home Garage cancellation after Vehicle Arrived");
    }
  }
  await env.clearFirestore();
  const shop = auth("shop-provider");
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc("users/shop-provider").set({ role: "shop-owner" });
    await db.doc("providers/shop-provider").set({ uid: "shop-provider", role: "shop-owner", verified: true, status: "open" });
    await db.doc("bookings/new-shop-flow").set({ bookingType: "shop-owner", customerId, providerId: "shop-provider", providerName: "Shop", status: "accepted", timingMode: "now", urgency: "standard", updatedAt: Timestamp.now() });
  });
  for (const status of ["vehicle_arrived", "diagnosing", "repairing"]) {
    await assertSucceeds(updateDoc(doc(shop, "bookings", "new-shop-flow"), { status, updatedAt: serverTimestamp() }));
  }
});

test("completion writes final price, completedAt, status and both notifications atomically; legacy Home Garage in_progress remains completable", async () => {
  for (const { type, provider, status } of [
    { type: "shop-owner", provider: "shop-provider", status: "repairing" },
    { type: "homegarage", provider: "garage-provider", status: "repairing" },
    { type: "homegarage", provider: "garage-provider", status: "in_progress" },
  ]) {
    await env.clearFirestore();
    const id = `complete-${type}-${status}`;
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      if (type === "shop-owner") {
        await db.doc(`users/${provider}`).set({ role: "shop-owner" });
        await db.doc(`providers/${provider}`).set({ uid: provider, role: "shop-owner", verified: true, status: "open" });
      } else {
        await db.doc(`users/${provider}`).set({ role: "homegarage" });
        await db.doc(`users/${provider}/homeGarageVerification/profile`).set({ uid: provider, role: "homegarage", verificationStatus: "VERIFIED" });
      }
      await db.doc(`bookings/${id}`).set({ bookingType: type, customerId, providerId: provider, customerName: "Owner", providerName: "Provider", vehicle: "Toyota Vios", problem: "Repair", status, timingMode: "now", urgency: "standard", updatedAt: Timestamp.now() });
      await db.doc(`users/${customerId}/notifications/${id}`).set({ customerId, bookingId: id, bookingType: type, providerId: provider, providerName: "Provider", status, title: "Service request update", message: "Working", isRead: false, readAt: null, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      const collectionName = type === "shop-owner" ? "shopNotifications" : "homeGarageNotifications";
      await db.doc(`users/${provider}/${collectionName}/${id}`).set({ bookingId: id, providerId: provider, customerId, customerName: "Owner", vehicle: "Toyota Vios", problem: "Repair", status, title: type === "shop-owner" ? "Request status updated" : "Request updated", message: "Working", isRead: true, readAt: Timestamp.now(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
    const db = auth(provider);
    await assertSucceeds(runTransaction(db, async (transaction) => {
      transaction.update(doc(db, "bookings", id), { status: "completed", finalPrice: 123.45, completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      transaction.update(doc(db, "users", customerId, "notifications", id), { status: "completed", message: "Completed. Final price: ₱123.45", isRead: false, readAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      const collectionName = type === "shop-owner" ? "shopNotifications" : "homeGarageNotifications";
      transaction.update(doc(db, "users", provider, collectionName, id), { status: "completed", title: type === "shop-owner" ? "Request status updated" : "Request updated", message: "Completed", isRead: true, readAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }));
    const completed = (await getDoc(doc(db, "bookings", id))).data();
    assert.equal(completed.status, "completed");
    assert.equal(completed.finalPrice, 123.45);
    assert.ok(completed.completedAt);
    assert.equal("paymentStatus" in completed, false);
    const ownerNotification = (await getDoc(doc(auth(customerId), "users", customerId, "notifications", id))).data();
    assert.equal(ownerNotification.status, "completed");
  }
});

test("completion authorization, amount precision, and final-price immutability are enforced", async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc("users/garage-provider").set({ role: "homegarage" });
    await db.doc("users/garage-provider/homeGarageVerification/profile").set({ uid: "garage-provider", role: "homegarage", verificationStatus: "VERIFIED" });
    for (const [id, status] of [["invalid-price", "repairing"], ["unauthorized-complete", "repairing"], ["immutable-price", "completed"]]) {
      await db.doc(`bookings/${id}`).set({ bookingType: "homegarage", customerId, providerId: "garage-provider", status, updatedAt: Timestamp.now(), ...(status === "completed" ? { finalPrice: 50, completedAt: Timestamp.now() } : {}) });
    }
  });
  for (const amount of [1.001, 100000000.01, -1]) {
    await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(auth("garage-provider"), "bookings", "invalid-price"), { status: "completed", finalPrice: amount, completedAt: serverTimestamp(), updatedAt: serverTimestamp() }), `invalid final price ${amount}`);
  }
  await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(auth("other-provider"), "bookings", "unauthorized-complete"), { status: "completed", finalPrice: 50, completedAt: serverTimestamp(), updatedAt: serverTimestamp() }), "unassigned provider completion");
  await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(auth("garage-provider"), "bookings", "immutable-price"), { finalPrice: 60, updatedAt: serverTimestamp() }), "post-completion price edit");
});
