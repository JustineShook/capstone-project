// Firestore emulator rules checks. Set VERESC_TEST_NODE_MODULES to the isolated
// temporary project's node_modules; this file never targets production.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const isolatedRequire = createRequire(new URL(`file:///${process.env.VERESC_TEST_NODE_MODULES.replaceAll("\\", "/")}/package.json`));
const { initializeTestEnvironment, assertFails, assertSucceeds } = isolatedRequire("@firebase/rules-unit-testing");
const { Timestamp, doc, getDoc, getDocs, collection, query, where, runTransaction, serverTimestamp, updateDoc, setDoc, deleteDoc } = isolatedRequire("firebase/firestore");
const providerId = "mechanic-provider";
const customerId = "vehicle-owner";
const projectId = "demo-veresc-schedule-rules";
const rules = readFileSync(fileURLToPath(new URL("../firestore.rules", import.meta.url)), "utf8");
let env;

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules } });
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
async function seedBusyProvider(provider, role, availability = "available") {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${provider}`).set({ uid: provider, role, accountStatus: "active" });
    if (role === "onsite-mechanic") {
      await db.doc(`users/${provider}/providerProfile/profile`).set({ uid: provider, role, verificationStatus: "VERIFIED" });
    } else {
      await db.doc(`users/${provider}/towingCompanyProfile/profile`).set({ uid: provider, role, verificationStatus: "VERIFIED" });
    }
    await db.doc(`providerListings/${provider}`).set({ providerId: provider, role,
      category: role === "onsite-mechanic" ? "Onsite Mechanics" : "Towing",
      businessName: "Active service provider", visibility: "active", availability });
  });
}
async function acquireActiveService(db, provider, bookingId, status = "accepted") {
  const bookingRef = doc(db, "bookings", bookingId);
  const lockRef = doc(db, "providerActiveServices", provider);
  const listingRef = doc(db, "providerListings", provider);
  await runTransaction(db, async (transaction) => {
    const [booking, lock, listing] = await Promise.all([
      transaction.get(bookingRef), transaction.get(lockRef), transaction.get(listingRef),
    ]);
    if (lock.exists()) throw new Error("provider already has an active service");
    transaction.set(lockRef, { providerId: provider, bookingId,
      previousAvailability: listing.data().availability, acquiredAt: serverTimestamp() });
    transaction.update(listingRef, { availability: "busy" });
    transaction.update(bookingRef, { status, updatedAt: serverTimestamp() });
  });
}
async function finishActiveService(db, provider, bookingId, finalStatus = "completed") {
  const bookingRef = doc(db, "bookings", bookingId);
  const lockRef = doc(db, "providerActiveServices", provider);
  const listingRef = doc(db, "providerListings", provider);
  await runTransaction(db, async (transaction) => {
    const booking = await transaction.get(bookingRef);
    if (finalStatus === "completed") {
      transaction.update(bookingRef, { status: finalStatus, finalPrice: 125, completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } else {
      transaction.update(bookingRef, { status: finalStatus, updatedAt: serverTimestamp() });
    }
  });
  await runTransaction(db, async (transaction) => {
    const [booking, lock] = await Promise.all([
      transaction.get(bookingRef), transaction.get(lockRef),
    ]);
    if (!lock.exists() || lock.data()?.bookingId !== bookingId || !["completed", "cancelled"].includes(booking.data()?.status)) return;
    transaction.delete(lockRef);
    transaction.update(listingRef, { availability: lock.data().previousAvailability });
  });
}

test("mechanic and towing busy locks serialize active jobs, release only their owner, and preserve scheduled requests", async () => {
  for (const [role, provider] of [["onsite-mechanic", "busy-mechanic"], ["towing-company", "busy-tow"]]) {
    await env.clearFirestore();
    await seedBusyProvider(provider, role, "available");
    const bookingType = role;
    const first = `${provider}-first`;
    const second = `${provider}-second`;
    const unrelated = `${provider}-unrelated`;
    await seedBooking(first, { bookingType, provider, timingMode: "now" });
    await seedBooking(second, { bookingType, provider, timingMode: "now" });
    const providerDb = auth(provider);
    const competing = await Promise.allSettled([
      acquireActiveService(providerDb, provider, first),
      acquireActiveService(providerDb, provider, second),
    ]);
    assert.equal(competing.filter((result) => result.status === "fulfilled").length, 1, `${role}: exactly one service acquires the lock`);
    assert.equal(competing.filter((result) => result.status === "rejected").length, 1, `${role}: competing service cannot acquire the lock`);
    const winner = competing[0].status === "fulfilled" ? first : second;
    const loser = winner === first ? second : first;
    assert.equal((await getDoc(doc(providerDb, "providerListings", provider))).data()?.availability, "busy");
    assert.equal((await getDoc(doc(providerDb, "providerActiveServices", provider))).data()?.bookingId, winner);

    // A future booking can still be accepted and reserve its own time while
    // the provider's current service owns the busy lock.
    const scheduled = `${provider}-scheduled`;
    const at = slotTimestamp();
    await seedBooking(scheduled, { bookingType, provider, timingMode: "scheduled", at });
    await assertSucceeds(acceptAsProvider(providerDb, scheduled, at, provider));
    assert.equal((await getDoc(doc(providerDb, "providerActiveServices", provider))).data()?.bookingId, winner);
    assert.equal((await getDoc(doc(providerDb, "providerListings", provider))).data()?.availability, "busy");

    await seedBooking(unrelated, { status: "accepted", bookingType, provider, timingMode: "now" });
    await assertSucceeds(updateDoc(doc(providerDb, "bookings", unrelated), { status: "cancelled", updatedAt: serverTimestamp() }));
    assert.equal((await getDoc(doc(providerDb, "providerActiveServices", provider))).data()?.bookingId, winner,
      `${role}: cancelling a different booking cannot clear the active lock`);
    assert.equal((await getDoc(doc(providerDb, "providerListings", provider))).data()?.availability, "busy");

    const guest = env.unauthenticatedContext().firestore();
    await assertDeniedWithoutExpressionLimit(() => getDoc(doc(guest, "providerActiveServices", provider)), `${role}: guest cannot read private active-service data`);
    await assertDeniedWithoutExpressionLimit(() => getDoc(doc(auth("unrelated-customer"), "providerActiveServices", provider)), `${role}: unrelated user cannot read private active-service data`);
  }
});

test("only due scheduled starts acquire busy; cancellation, completion, and suspension preserve lock ownership", async () => {
  await env.clearFirestore();
  const provider = "scheduled-lock-mechanic";
  await seedBusyProvider(provider, "onsite-mechanic", "offline");
  const futureAt = Timestamp.fromMillis(Date.now() + 3_600_000);
  await seedBooking("future-to-start", { status: "accepted", provider, bookingType: "onsite-mechanic", timingMode: "scheduled", at: futureAt });
  await assertDeniedWithoutExpressionLimit(
    () => acquireActiveService(auth(provider), provider, "future-to-start", "en_route"),
    "a future scheduled service cannot become busy before its appointment",
  );
  assert.equal((await getDoc(doc(auth(provider), "providerListings", provider))).data()?.availability, "offline");
  assert.equal((await getDoc(doc(auth(provider), "providerActiveServices", provider))).exists(), false);

  const dueId = "due-to-start";
  await seedBooking(dueId, { status: "accepted", provider, bookingType: "onsite-mechanic", timingMode: "scheduled", at: Timestamp.fromMillis(Date.now() - 3_600_000) });
  await assertSucceeds(acquireActiveService(auth(provider), provider, dueId, "en_route"));
  assert.equal((await getDoc(doc(auth(provider), "providerListings", provider))).data()?.availability, "busy");

  await seedBooking("different-active-request", { status: "accepted", provider, bookingType: "onsite-mechanic", timingMode: "now" });
  await assertSucceeds(updateDoc(doc(auth(provider), "bookings", "different-active-request"), { status: "cancelled", updatedAt: serverTimestamp() }));
  assert.equal((await getDoc(doc(auth(provider), "providerActiveServices", provider))).data()?.bookingId, dueId);

  await assertSucceeds(updateDoc(doc(auth(provider), "bookings", dueId), { status: "arrived", updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(auth(provider), "bookings", dueId), { status: "in_progress", updatedAt: serverTimestamp() }));
  await finishActiveService(auth(provider), provider, dueId);
  assert.equal((await getDoc(doc(auth(provider), "providerActiveServices", provider))).exists(), false);
  assert.equal((await getDoc(doc(auth(provider), "providerListings", provider))).data()?.availability, "offline",
    "completion restores the provider's prior offline state");

  // Customer cancellation releases only their own accepted immediate service.
  const cancelId = "customer-own-cancel";
  await assertSucceeds(updateDoc(doc(auth(provider), "providerListings", provider), { availability: "available" }));
  await seedBooking(cancelId, { status: "pending", provider, bookingType: "onsite-mechanic", customer: "cancel-owner", timingMode: "now" });
  await assertSucceeds(acquireActiveService(auth(provider), provider, cancelId, "accepted"));
  const customerDb = auth("cancel-owner");
  const cancelBooking = doc(customerDb, "bookings", cancelId);
  const cancelLock = doc(customerDb, "providerActiveServices", provider);
  const cancelListing = doc(customerDb, "providerListings", provider);
  await assertSucceeds(updateDoc(cancelBooking, { status: "cancelled", updatedAt: serverTimestamp() }));
  await assertSucceeds(runTransaction(customerDb, async (transaction) => {
    const lock = await transaction.get(cancelLock);
    assert.equal(lock.data()?.bookingId, cancelId);
    transaction.delete(cancelLock);
    transaction.update(cancelListing, { availability: lock.data().previousAvailability });
  }));
  assert.equal((await getDoc(doc(auth(provider), "providerListings", provider))).data()?.availability, "available");

  // Suspension prevents new acquisitions and provider progress. It leaves an
  // existing lock intact; after guarded restoration the owner can finish it.
  const suspendedActive = "suspended-active-service";
  await seedBooking(suspendedActive, { status: "pending", provider, bookingType: "onsite-mechanic", timingMode: "now" });
  await assertSucceeds(acquireActiveService(auth(provider), provider, suspendedActive, "accepted"));
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`users/${provider}`).update({ accountStatus: "suspended" });
  });
  const beforeSuspend = await getDoc(doc(auth(provider), "providerListings", provider));
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(doc(auth(provider), "bookings", suspendedActive), { status: "en_route", updatedAt: serverTimestamp() }),
    "suspended provider cannot start a service",
  );
  await assertDeniedWithoutExpressionLimit(
    () => finishActiveService(auth(provider), provider, suspendedActive),
    "suspended provider cannot release the guarded busy lock",
  );
  assert.equal((await getDoc(doc(auth(provider), "providerActiveServices", provider))).data()?.bookingId, suspendedActive);
  assert.equal((await getDoc(doc(auth(provider), "providerListings", provider))).data()?.availability, beforeSuspend.data()?.availability);
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`users/${provider}`).update({ accountStatus: "active" });
  });
  await assertSucceeds(updateDoc(doc(auth(provider), "bookings", suspendedActive), { status: "en_route", updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(auth(provider), "bookings", suspendedActive), { status: "arrived", updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(auth(provider), "bookings", suspendedActive), { status: "in_progress", updatedAt: serverTimestamp() }));
  await assertSucceeds(finishActiveService(auth(provider), provider, suspendedActive));
});

test("active-service markers cannot be forged or released without the matching booking transition", async () => {
  await env.clearFirestore();
  const provider = "forged-lock-mechanic";
  await seedBusyProvider(provider, "onsite-mechanic", "available");
  await seedBooking("forged-lock-booking", { provider, bookingType: "onsite-mechanic", timingMode: "now" });
  const providerDb = auth(provider);
  await assertDeniedWithoutExpressionLimit(() => setDoc(doc(auth("fake-provider"), "providerActiveServices", provider), {
    providerId: provider, bookingId: "forged-lock-booking", previousAvailability: "available", acquiredAt: serverTimestamp(),
  }), "lock cannot be created without matching booking and listing writes");
  await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(providerDb, "providerListings", provider), { availability: "busy" }),
    "listing cannot be set busy by itself");
  assert.equal((await getDoc(doc(providerDb, "providerListings", provider))).data()?.availability, "available");
});
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
    const isBusyProvider = ["onsite-mechanic", "towing-company"].includes(booking.bookingType);
    const lockRef = doc(db, "providerActiveServices", booking.providerId);
    const listingRef = doc(db, "providerListings", booking.providerId);
    const [lock, listing] = isBusyProvider
      ? await Promise.all([transaction.get(lockRef), transaction.get(listingRef)])
      : [null, null];
    if (isBusyProvider && !lock.exists()) {
      transaction.set(lockRef, {
        providerId: booking.providerId, bookingId: id,
        previousAvailability: listing.data().availability, acquiredAt: serverTimestamp(),
      });
      transaction.update(listingRef, { availability: "busy" });
    }
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

test("temporary booking reason compatibility accepts legacy writes and valid reasons but rejects invalid reasons", async () => {
  await env.clearFirestore();
  const services = [
    { type: "onsite-mechanic", provider: "mechanic-reason-provider" },
    { type: "shop-owner", provider: "shop-reason-provider" },
    { type: "towing-company", provider: "tow-reason-provider" },
    { type: "homegarage", provider: "garage-reason-provider" },
  ];
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const { type, provider } of services) {
      await db.doc(`users/${provider}`).set({ uid: provider, role: type, accountStatus: "active" });
      if (type === "shop-owner") {
        await db.doc(`providers/${provider}`).set({ uid: provider, role: type, verified: true, status: "open" });
      }
      if (type === "homegarage") {
        await db.doc(`users/${provider}/homeGarageVerification/profile`).set({ uid: provider, role: type, verificationStatus: "VERIFIED" });
      }
    }
  });

  for (const { type, provider } of services) {
    const stem = type.replaceAll("-", "_");
    const cancellationDb = auth(customerId);
    const providerDb = auth(provider);
    const booking = (suffix) => `${stem}-reason-${suffix}`;

    await seedBooking(booking("legacy-cancel"), { bookingType: type, provider, timingMode: "now" });
    await assertSucceeds(updateDoc(doc(cancellationDb, "bookings", booking("legacy-cancel")), {
      status: "cancelled", updatedAt: serverTimestamp(),
    }));

    await seedBooking(booking("valid-cancel"), { bookingType: type, provider, timingMode: "now" });
    await assertSucceeds(updateDoc(doc(cancellationDb, "bookings", booking("valid-cancel")), {
      status: "cancelled", cancellationReason: "I need to change my schedule.", updatedAt: serverTimestamp(),
    }));

    await seedBooking(booking("updated-client-cancel"), { status: "accepted", bookingType: type, provider, timingMode: "now" });
    await assertSucceeds(updateDoc(doc(cancellationDb, "bookings", booking("updated-client-cancel")), {
      status: "cancelled", cancellationReason: "I need to change my schedule.",
      riskEventType: "owner_cancel_after_acceptance", riskEventAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));

    for (const [index, reason] of ["", "   ", "\t\n ", 123, null, "x".repeat(501)].entries()) {
      const id = booking(`invalid-cancel-${index}`);
      await seedBooking(id, { bookingType: type, provider, timingMode: "now" });
      await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(cancellationDb, "bookings", id), {
        status: "cancelled", cancellationReason: reason, updatedAt: serverTimestamp(),
      }), `${type} cancellation reason ${JSON.stringify(reason)}`);
    }

    await seedBooking(booking("legacy-decline"), { bookingType: type, provider, timingMode: "now" });
    await assertSucceeds(updateDoc(doc(providerDb, "bookings", booking("legacy-decline")), {
      status: "rejected", updatedAt: serverTimestamp(),
    }));

    await seedBooking(booking("valid-decline"), { bookingType: type, provider, timingMode: "now" });
    await assertSucceeds(updateDoc(doc(providerDb, "bookings", booking("valid-decline")), {
      status: "rejected", declineReason: "I cannot take this request today.", updatedAt: serverTimestamp(),
    }));

    await seedBooking(booking("updated-client-decline"), { bookingType: type, provider, timingMode: "now" });
    await assertSucceeds(updateDoc(doc(providerDb, "bookings", booking("updated-client-decline")), {
      status: "rejected", declineReason: "I cannot take this request today.",
      riskEventType: "provider_decline", riskEventAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));

    const mismatchedEvent = booking("mismatched-risk-event");
    await seedBooking(mismatchedEvent, { bookingType: type, provider, timingMode: "now" });
    await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(providerDb, "bookings", mismatchedEvent), {
      status: "rejected", declineReason: "Valid reason.", riskEventType: "owner_cancel_after_acceptance",
      riskEventAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }), `${type} provider cannot forge another action type`);

    const partialEvent = booking("partial-risk-event");
    await seedBooking(partialEvent, { bookingType: type, provider, timingMode: "now" });
    await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(providerDb, "bookings", partialEvent), {
      status: "rejected", declineReason: "Valid reason.", riskEventType: "provider_decline", updatedAt: serverTimestamp(),
    }), `${type} incomplete event metadata is rejected`);

    const repeatedEvent = booking("repeat-risk-event");
    await seedBooking(repeatedEvent, { bookingType: type, provider, timingMode: "now" });
    await assertSucceeds(updateDoc(doc(providerDb, "bookings", repeatedEvent), {
      status: "rejected", declineReason: "Valid reason.", riskEventType: "provider_decline",
      riskEventAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(providerDb, "bookings", repeatedEvent), {
      status: "rejected", declineReason: "Valid reason.", riskEventType: "provider_decline",
      riskEventAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }), `${type} terminal decline cannot be counted twice`);

    for (const [index, reason] of ["", "   ", "\t\n ", 123, null, "x".repeat(501)].entries()) {
      const id = booking(`invalid-decline-${index}`);
      await seedBooking(id, { bookingType: type, provider, timingMode: "now" });
      await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(providerDb, "bookings", id), {
        status: "rejected", declineReason: reason, updatedAt: serverTimestamp(),
      }), `${type} decline reason ${JSON.stringify(reason)}`);
    }

    const unauthorizedCancel = booking("unauthorized-cancel");
    const unauthorizedDecline = booking("unauthorized-decline");
    await seedBooking(unauthorizedCancel, { bookingType: type, provider, timingMode: "now" });
    await seedBooking(unauthorizedDecline, { bookingType: type, provider, timingMode: "now" });
    await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(auth("unrelated-user"), "bookings", unauthorizedCancel), {
      status: "cancelled", cancellationReason: "Valid reason.", updatedAt: serverTimestamp(),
    }), `${type} unrelated user cannot cancel`);
    await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(auth("unrelated-user"), "bookings", unauthorizedDecline), {
      status: "rejected", declineReason: "Valid reason.", updatedAt: serverTimestamp(),
    }), `${type} unrelated user cannot decline`);
  }
});

test("auto shop, towing, and Home Garage keep their existing invalid status transitions denied", async () => {
  await env.clearFirestore();
  const cases = [
    { type: "shop-owner", provider: "shop-transition-provider", ownerBadStatus: "vehicle_arrived" },
    { type: "towing-company", provider: "tow-transition-provider", ownerBadStatus: "en_route" },
    { type: "homegarage", provider: "garage-transition-provider", ownerBadStatus: "vehicle_arrived" },
  ];
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const { type, provider } of cases) {
      await db.doc(`users/${provider}`).set({ uid: provider, role: type });
      if (type === "shop-owner") {
        await db.doc(`providers/${provider}`).set({ uid: provider, role: type, verified: true, status: "open" });
      }
      if (type === "homegarage") {
        await db.doc(`users/${provider}/homeGarageVerification/profile`).set({ uid: provider, role: type, verificationStatus: "VERIFIED" });
      }
    }
  });

  for (const { type, provider, ownerBadStatus } of cases) {
    const stem = type.replaceAll("-", "_");
    const ownerId = `${stem}-invalid-owner-transition`;
    const providerId = `${stem}-invalid-provider-transition`;
    await seedBooking(ownerId, { status: "accepted", bookingType: type, provider, timingMode: "now" });
    await seedBooking(providerId, { status: "accepted", bookingType: type, provider, timingMode: "now" });
    await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(auth(customerId), "bookings", ownerId), {
      status: ownerBadStatus, updatedAt: serverTimestamp(),
    }), `${type} owner cannot cancel or advance to ${ownerBadStatus}`);
    await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(auth(provider), "bookings", providerId), {
      status: "rejected", declineReason: "Cannot accept this request.", updatedAt: serverTimestamp(),
    }), `${type} provider cannot decline after acceptance`);
  }
});

test("suspension blocks new owner requests and provider progress, hides listings, and preserves existing cleanup", async () => {
  await env.clearFirestore();
  const owner = "suspended-owner";
  const provider = "suspended-mechanic";
  const acceptedId = "existing-accepted-booking";
  const at = slotTimestamp();
  const listing = {
    providerId: provider, role: "onsite-mechanic", category: "Onsite Mechanics",
    businessName: "Suspended Mechanic", location: { latitude: 14.67, longitude: 121.04 },
    availability: "available", visibility: "active", ratingSummary: { average: 0, count: 0 },
    services: ["Engine Diagnostics"], vehicleTypes: ["Car"], serviceAreaLabel: "Quezon City",
    description: "", contactPhone: "09170000000", startingPrice: null, operatingHours: "Daily",
    emergencyServiceAvailable: false, acceptsScheduledBookings: true,
  };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${owner}`).set({ uid: owner, role: "owner", accountStatus: "suspended" });
    await db.doc(`users/${owner}/ownerProfile/profile`).set({ uid: owner, role: "owner", verificationStatus: "VERIFIED", personal: { phone: "09170000000" } });
    await db.doc(`users/${provider}`).set({ uid: provider, role: "onsite-mechanic", accountStatus: "suspended" });
    await db.doc(`users/${provider}/providerProfile/profile`).set({ uid: provider, role: "onsite-mechanic", verificationStatus: "VERIFIED" });
    await db.doc(`providerListings/${provider}`).set({ ...listing, visibility: "inactive" });
    await db.doc("users/booking-provider-active").set({ uid: "booking-provider-active", role: "onsite-mechanic" });
    await db.doc("users/booking-provider-active/providerProfile/profile").set({ uid: "booking-provider-active", role: "onsite-mechanic", verificationStatus: "VERIFIED" });
    await db.doc("providerListings/booking-provider-active").set({ ...listing, providerId: "booking-provider-active", businessName: "Available Mechanic" });
    await db.doc("providerListings/visible-provider").set({ ...listing, providerId: "visible-provider", businessName: "Visible Mechanic" });
    await db.doc(`bookings/${acceptedId}`).set({
      bookingType: "onsite-mechanic", customerId: owner, customerName: "Owner", customerEmail: "owner@example.test",
      providerId: provider, providerName: listing.businessName, providerPhone: listing.contactPhone,
      vehicleId: "vehicle-1", vehicle: "Toyota Vios", vehicleYear: 2020, vehiclePlate: "ABC123",
      latitude: 14.6, longitude: 121.0, problem: "Engine issue", notes: "", startingPrice: "",
      status: "accepted", createdAt: Timestamp.now(), updatedAt: Timestamp.now(), timingMode: "scheduled",
      urgency: "standard", scheduledAt: at,
    });
    await db.doc(`providerScheduleReservations/${slotId(provider, at)}`).set({ providerId: provider, bookingId: acceptedId, scheduledAt: at, createdAt: Timestamp.now() });
    await db.doc("providerListings/garage-for-parking").set({ providerId: "garage-for-parking", role: "homegarage", visibility: "active", availability: "available" });
    await db.doc("parkingSlots/garage-slot-1").set({ providerId: "garage-for-parking", slotNumber: 1, status: "available", customerId: null, bookingId: null });
    await db.doc("parkingBookings/existing-owner-parking").set({
      providerId: "garage-for-parking", providerName: "Garage", customerId: owner, customerName: "Owner",
      vehicleId: "vehicle-1", vehicle: "Toyota Vios", vehiclePlate: "ABC123", vehicleType: "Car",
      slotId: "garage-slot-active", slotNumber: 2, notes: "", status: "active",
      bookedAt: Timestamp.now(), updatedAt: Timestamp.now(), parkingStartedAt: Timestamp.now(),
    });
    await db.doc("parkingSlots/garage-slot-active").set({ providerId: "garage-for-parking", slotNumber: 2, status: "reserved", customerId: owner, bookingId: "existing-owner-parking" });
  });

  const ownerDb = auth(owner);
  await assertDeniedWithoutExpressionLimit(() => setDoc(doc(ownerDb, "bookings", "suspended-owner-new-booking"), {
    bookingType: "onsite-mechanic", customerId: owner, customerName: "Owner", customerEmail: "owner@example.test",
    providerId: "booking-provider-active", providerName: "Available Mechanic", providerPhone: "09170000000",
    vehicleId: "vehicle-1", vehicle: "Toyota Vios", vehicleYear: 2020, vehiclePlate: "ABC123",
    latitude: 14.6, longitude: 121.0, problem: "Engine issue", notes: "", startingPrice: "",
    status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), timingMode: "now", urgency: "standard",
  }), "suspended owner cannot create a new service booking");
  const newParking = doc(ownerDb, "parkingBookings", "suspended-owner-parking");
  const slot = doc(ownerDb, "parkingSlots", "garage-slot-1");
  await assertDeniedWithoutExpressionLimit(() => runTransaction(ownerDb, async (transaction) => {
    const current = await transaction.get(slot);
    transaction.update(slot, { status: "reserved", customerId: owner, bookingId: "suspended-owner-parking", updatedAt: serverTimestamp() });
    transaction.set(newParking, {
      providerId: "garage-for-parking", providerName: "Garage", customerId: owner, customerName: "Owner",
      vehicleId: "vehicle-1", vehicle: "Toyota Vios", vehiclePlate: "ABC123", vehicleType: "Car",
      slotId: current.id, slotNumber: 1, notes: "", status: "reserved", bookedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }), "suspended owner cannot reserve a new parking slot");

  const providerDb = auth(provider);
  await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(providerDb, "bookings", acceptedId), { status: "en_route", updatedAt: serverTimestamp() }), "suspended provider cannot progress an existing booking");
  await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(providerDb, "providerListings", provider), { visibility: "active" }), "suspended provider cannot republish its listing");

  const visible = await getDocs(query(collection(ownerDb, "providerListings"), where("visibility", "==", "active"), where("availability", "==", "available")));
  assert.deepEqual(visible.docs.map((item) => item.id).sort(), ["booking-provider-active", "garage-for-parking", "visible-provider"]);

  await assertSucceeds(runTransaction(ownerDb, async (transaction) => {
    const bookingRef = doc(ownerDb, "bookings", acceptedId);
    const reservationRef = doc(ownerDb, "providerScheduleReservations", slotId(provider, at));
    await Promise.all([transaction.get(bookingRef), transaction.get(reservationRef)]);
    transaction.delete(reservationRef);
    transaction.update(bookingRef, { status: "cancelled", cancellationReason: "Provider account is suspended.", updatedAt: serverTimestamp() });
  }));
  assert.equal((await getDoc(doc(ownerDb, "bookings", acceptedId))).data()?.status, "cancelled");
  await assertSucceeds(runTransaction(ownerDb, async (transaction) => {
    const parkingRef = doc(ownerDb, "parkingBookings", "existing-owner-parking");
    const slotRef = doc(ownerDb, "parkingSlots", "garage-slot-active");
    await Promise.all([transaction.get(parkingRef), transaction.get(slotRef)]);
    transaction.update(parkingRef, { status: "completed", parkingEndedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    transaction.update(slotRef, { status: "available", customerId: null, bookingId: null, updatedAt: serverTimestamp() });
  }));
  assert.equal((await getDoc(doc(ownerDb, "parkingBookings", "existing-owner-parking"))).data()?.status, "completed");
});

test("Stage 1 denies new parking reservations but lets an existing session complete and release its slot", async () => {
  await env.clearFirestore();
  const owner = "parking-stage-one-owner";
  const provider = "parking-stage-one-garage";
  const bookingId = "parking-stage-one-existing";
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${owner}`).set({ uid: owner, role: "owner", accountStatus: "active" });
    await db.doc(`users/${owner}/ownerProfile/profile`).set({ uid: owner, role: "owner", verificationStatus: "VERIFIED" });
    await db.doc(`users/${provider}`).set({ uid: provider, role: "homegarage", accountStatus: "active" });
    await db.doc(`providerListings/${provider}`).set({ providerId: provider, role: "homegarage", category: "Parking Lots", visibility: "active", availability: "available" });
    await db.doc("parkingSlots/available-slot").set({ providerId: provider, slotNumber: 1, status: "available", customerId: null, bookingId: null });
    await db.doc(`parkingBookings/${bookingId}`).set({
      providerId: provider, providerName: "Garage", customerId: owner, customerName: "Owner",
      vehicleId: "vehicle-1", vehicle: "Toyota Vios", vehiclePlate: "ABC123", vehicleType: "Car",
      slotId: "active-slot", slotNumber: 2, notes: "", status: "reserved",
      bookedAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    await db.doc("parkingSlots/active-slot").set({ providerId, slotNumber: 2, status: "reserved", customerId: owner, bookingId });
  });

  const ownerDb = auth(owner);
  const newBooking = {
    providerId: provider, providerName: "Garage", customerId: owner, customerName: "Owner",
    vehicleId: "vehicle-1", vehicle: "Toyota Vios", vehiclePlate: "ABC123", vehicleType: "Car",
    slotId: "available-slot", slotNumber: 1, notes: "", status: "reserved",
    bookedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  await assertDeniedWithoutExpressionLimit(
    () => setDoc(doc(ownerDb, "parkingBookings", "parking-stage-one-new"), newBooking),
    "Stage 1 denies new parking booking documents",
  );
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(doc(ownerDb, "parkingSlots", "available-slot"), {
      status: "reserved", customerId: owner, bookingId: "parking-stage-one-new", updatedAt: serverTimestamp(),
    }),
    "Stage 1 denies new parking slot claims",
  );

  await assertSucceeds(runTransaction(ownerDb, async (transaction) => {
    const bookingRef = doc(ownerDb, "parkingBookings", bookingId);
    const slotRef = doc(ownerDb, "parkingSlots", "active-slot");
    await Promise.all([transaction.get(bookingRef), transaction.get(slotRef)]);
    transaction.update(bookingRef, { status: "active", parkingStartedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }));
  assert.equal((await getDoc(doc(ownerDb, "parkingBookings", bookingId))).data()?.status, "active");
  await assertSucceeds(runTransaction(ownerDb, async (transaction) => {
    const bookingRef = doc(ownerDb, "parkingBookings", bookingId);
    const slotRef = doc(ownerDb, "parkingSlots", "active-slot");
    await Promise.all([transaction.get(bookingRef), transaction.get(slotRef)]);
    transaction.update(bookingRef, { status: "completed", parkingEndedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    transaction.update(slotRef, { status: "available", customerId: null, bookingId: null, updatedAt: serverTimestamp() });
  }));
  assert.equal((await getDoc(doc(ownerDb, "parkingBookings", bookingId))).data()?.status, "completed");
  assert.equal((await getDoc(doc(ownerDb, "parkingSlots", "active-slot"))).data()?.status, "available");
});

test("future scheduled mechanic and tow services cannot start early; shop and garage timing stays unchanged", async () => {
  await env.clearFirestore();
  const at = slotTimestamp();
  await seedBooking("early-start", { status: "accepted", at });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${providerId}`).set({ uid: providerId, role: "onsite-mechanic", accountStatus: "active" });
    await db.doc(`users/${providerId}/providerProfile/profile`).set({ uid: providerId, role: "onsite-mechanic", verificationStatus: "VERIFIED" });
    await db.doc(`providerListings/${providerId}`).set({ providerId, role: "onsite-mechanic", category: "Onsite Mechanics", visibility: "active", availability: "available" });
    await db.doc("users/tow-provider").set({ uid: "tow-provider", role: "towing-company", accountStatus: "active" });
    await db.doc("users/tow-provider/towingCompanyProfile/profile").set({ uid: "tow-provider", role: "towing-company", verificationStatus: "VERIFIED" });
    await db.doc("providerListings/tow-provider").set({ providerId: "tow-provider", role: "towing-company", category: "Towing", visibility: "active", availability: "available" });
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

  await seedProgressNotifications("early-shop", "shopNotifications");
  await assertDeniedWithoutExpressionLimit(() => startWithNotifications(provider, "early-start", "en_route", "mechanicNotifications"), "mechanic cannot begin a future scheduled service");
  await assertDeniedWithoutExpressionLimit(() => startWithNotifications(auth("tow-provider"), "early-tow", "en_route", "towingNotifications"), "towing cannot begin a future scheduled service");
  await assertSucceeds(startWithNotifications(auth("shop-provider"), "early-shop", "vehicle_arrived", "shopNotifications"));
  // The existing Home Garage Vehicle Arrived service updates only the booking;
  // keep that notification behavior unchanged.
  await assertSucceeds(updateDoc(doc(auth("garage-provider"), "bookings", "early-garage"), { status: "vehicle_arrived", updatedAt: serverTimestamp() }));
  for (const [providerUid, id, status] of [
    [providerId, "early-start", "accepted"], ["tow-provider", "early-tow", "accepted"],
    ["shop-provider", "early-shop", "vehicle_arrived"], ["garage-provider", "early-garage", "vehicle_arrived"],
  ]) {
    assert.equal((await getDoc(doc(auth(providerUid), "bookings", id))).data()?.status, status);
    assert.equal((await getDoc(doc(auth(providerUid), "providerScheduleReservations", slotId(providerUid, at)))).exists(), true);
  }
  for (const [providerUid, id, collectionName, status] of [
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

test("exact Auto Shop save passes without visibility; protected fields and suspended publishing stay denied", async () => {
  await env.clearFirestore();
  const uid = "GD7wHEGfuRPeVgFciUq0JoInu3g1";
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weeklyHours = days.map((day) => ({ day, open: true, openingTime: "8:00 AM", closingTime: "6:00 PM" }));
  const photos = [
    "https://res.cloudinary.com/rfhd9sez/image/upload/v1792398632/ym0ezcrfqqh22lxwko2w.jpg",
    "https://res.cloudinary.com/rfhd9sez/image/upload/v1792662122/ftef6jlwv5kzzmwmrhy5.jpg",
    "https://res.cloudinary.com/rfhd9sez/image/upload/v1792662120/h04lv6vjv7isxrkzzjz6.jpg",
  ];
  const payload = {
    businessName: "LIBIOS AUTOSHOP",
    location: { latitude: 10.268323119032482, longitude: 123.84366619817413 },
    availability: "available",
    serviceAreaLabel: "Talisay, Central Visayas",
    description: "We offer reliable vehicle repairs and maintenance, from oil change to engine and brake services.",
    contactPhone: "09224238091",
    services: ["Preventive maintenance", "Tire service", "Battery service", "Oil change", "Engine repair"],
    vehicleTypes: ["Motorcycle", "Car", "SUV", "Pickup Truck"],
    operatingHours: "Open 24/7",
    startingPrice: null,
    emergencyServiceAvailable: true,
    acceptsScheduledBookings: true,
    visibility: "active",
    photoUrls: photos,
    hoursType: "24_7",
    is24Hours: true,
    weeklyHours,
  };
  const existing = {
    providerId: uid, role: "shop-owner", category: "Auto Shops", businessName: "LIBIOS AUTOSHOP",
    location: { latitude: 10.2, longitude: 123.8 }, availability: "available",
    ratingSummary: { average: 4.8, count: 12 }, services: payload.services, vehicleTypes: payload.vehicleTypes,
    serviceAreaLabel: "Talisay, Central Visayas", description: "Existing listing", contactPhone: "09224238091",
    startingPrice: null, operatingHours: "Open 24/7", emergencyServiceAvailable: true,
    acceptsScheduledBookings: true, photoUrls: photos, hoursType: "24_7", is24Hours: true, weeklyHours, legacyImported: true,
  };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${uid}`).set({ uid, role: "shop-owner", accountStatus: "active" });
    await db.doc(`users/${uid}/shopVerification/profile`).set({
      uid, role: "shop-owner", verificationStatus: "VERIFIED",
      business: { name: "LIBIOS AUTOSHOP", phone: "09224238091", address: "Talisay, Central Visayas" },
    });
    await db.doc(`providers/${uid}`).set({ uid, role: "shop-owner", verified: true, status: "open" });
    // Deliberately omit visibility, matching the existing listing that failed.
    await db.doc(`providerListings/${uid}`).set(existing);
  });

  const listingRef = doc(auth(uid), "providerListings", uid);
  await assertSucceeds(updateDoc(listingRef, payload));
  const savedExistingShop = (await getDoc(listingRef)).data();
  assert.deepEqual(savedExistingShop?.ratingSummary, existing.ratingSummary);
  assert.equal(savedExistingShop?.legacyImported, true);
  for (const [field, value] of [
    ["providerId", "attacker"],
    ["role", "homegarage"],
    ["category", "Parking Lots"],
    ["ratingSummary", { average: 5, count: 99 }],
  ]) {
    await assertDeniedWithoutExpressionLimit(
      () => updateDoc(listingRef, { [field]: value }),
      `Auto Shop cannot change protected ${field}`,
    );
  }

  const suspendedUid = "suspended-exact-shop-owner";
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${suspendedUid}`).set({ uid: suspendedUid, role: "shop-owner", accountStatus: "suspended" });
    await db.doc(`providers/${suspendedUid}`).set({ uid: suspendedUid, role: "shop-owner", verified: true, status: "open" });
    await db.doc(`providerListings/${suspendedUid}`).set({ ...existing, providerId: suspendedUid, visibility: "inactive" });
  });
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(doc(auth(suspendedUid), "providerListings", suspendedUid), payload),
    "suspended Auto Shop cannot publish its listing",
  );
});

test("Home Garage saves new and existing repair listings with form services; invalid or ineligible writes are denied", async () => {
  await env.clearFirestore();
  const uid = "home-garage-listing-save";
  const repairServices = ["Oil change", "Brake service", "Engine repair", "Battery service", "Tire service", "Air-conditioning service"];
  const listingPayload = {
    providerId: uid, role: "homegarage", category: "Parking Lots", businessName: "Home Garage Repairs",
    location: { latitude: 10.2683, longitude: 123.8437 }, availability: "available", visibility: "active",
    ratingSummary: { average: 0, count: 0 }, services: repairServices, vehicleTypes: ["Car", "SUV"],
    serviceAreaLabel: "Talisay, Central Visayas", description: "Home vehicle repairs and maintenance.",
    startingPrice: null, operatingHours: "Open 24/7",
    emergencyServiceAvailable: true, acceptsScheduledBookings: true,
    photoUrls: ["https://example.invalid/home-garage.jpg"],
  };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${uid}`).set({ uid, role: "homegarage", accountStatus: "active" });
    await db.doc(`users/${uid}/homeGarageVerification/profile`).set({
      uid, role: "homegarage", verificationStatus: "VERIFIED", business: { name: "Home Garage Repairs" },
    });
  });
  const listingRef = doc(auth(uid), "providerListings", uid);
  await assertSucceeds(setDoc(listingRef, listingPayload));
  assert.deepEqual((await getDoc(listingRef)).data()?.services, repairServices);
  await assertDeniedWithoutExpressionLimit(
    () => setDoc(doc(auth(uid), "providerListings", `${uid}-legacy-phone`), { ...listingPayload, providerId: `${uid}-legacy-phone`, contactPhone: "09123456789" }),
    "new public listings cannot publish a phone field",
  );

  // The app uses setDoc for subsequent saves too, so an existing listing is evaluated as an update.
  await assertSucceeds(setDoc(listingRef, { ...listingPayload, description: "Updated Home Garage repair listing." }));
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(listingRef, { services: ["Parking"] }),
    "Home Garage cannot publish a parking-only service instead of repair services",
  );

  const unverifiedUid = "unverified-home-garage-listing";
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${unverifiedUid}`).set({ uid: unverifiedUid, role: "homegarage", accountStatus: "active" });
    await db.doc(`users/${unverifiedUid}/homeGarageVerification/profile`).set({
      uid: unverifiedUid, role: "homegarage", verificationStatus: "PENDING", business: { name: "Unverified Garage" },
    });
  });
  await assertDeniedWithoutExpressionLimit(
    () => setDoc(doc(auth(unverifiedUid), "providerListings", unverifiedUid), { ...listingPayload, providerId: unverifiedUid }),
    "unverified Home Garage cannot create a repair listing",
  );

  const suspendedUid = "suspended-home-garage-listing";
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${suspendedUid}`).set({ uid: suspendedUid, role: "homegarage", accountStatus: "suspended" });
    await db.doc(`users/${suspendedUid}/homeGarageVerification/profile`).set({
      uid: suspendedUid, role: "homegarage", verificationStatus: "VERIFIED", business: { name: "Suspended Garage" },
    });
    await db.doc(`providerListings/${suspendedUid}`).set({ ...listingPayload, providerId: suspendedUid, visibility: "inactive" });
  });
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(doc(auth(suspendedUid), "providerListings", suspendedUid), { ...listingPayload, providerId: suspendedUid }),
    "suspended Home Garage cannot publish its repair listing",
  );
});

test("Home Garage availability sync preserves legacy listing fields and rejects inactive accounts", async () => {
  await env.clearFirestore();
  const uid = "legacy-home-garage-availability";
  const listing = {
    providerId: uid, role: "homegarage", category: "Parking Lots", businessName: "Legacy Home Garage",
    location: { latitude: 10.2683, longitude: 123.8437 }, availability: "available", visibility: "active",
    ratingSummary: { average: 4.7, count: 19 }, services: ["Oil change"], vehicleTypes: ["Car"],
    serviceAreaLabel: "Talisay, Central Visayas", description: "Home vehicle repairs.",
    contactPhone: "09123456789", startingPrice: null, operatingHours: "Open daily",
    emergencyServiceAvailable: true, acceptsScheduledBookings: true, legacyOperatingNote: "Imported listing",
  };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${uid}`).set({ uid, role: "homegarage", accountStatus: "active" });
    await db.doc(`users/${uid}/homeGarageVerification/profile`).set({
      uid, role: "homegarage", verificationStatus: "VERIFIED", business: { name: listing.businessName },
    });
    await db.doc(`providerListings/${uid}`).set(listing);
  });

  const listingRef = doc(auth(uid), "providerListings", uid);
  await assertSucceeds(updateDoc(listingRef, {
    businessName: listing.businessName, location: listing.location, availability: "available", visibility: "active",
    serviceAreaLabel: listing.serviceAreaLabel, description: "Updated Home Garage repair services.",
    contactPhone: listing.contactPhone, services: listing.services, vehicleTypes: listing.vehicleTypes,
    operatingHours: listing.operatingHours, startingPrice: null, emergencyServiceAvailable: true,
    acceptsScheduledBookings: true,
  }));
  const savedAfterProfile = (await getDoc(listingRef)).data();
  assert.deepEqual(savedAfterProfile?.ratingSummary, listing.ratingSummary);
  assert.equal(savedAfterProfile?.legacyOperatingNote, listing.legacyOperatingNote);
  await assertSucceeds(updateDoc(listingRef, { availability: "offline" }));
  const saved = (await getDoc(listingRef)).data();
  assert.equal(saved?.availability, "offline");
  assert.equal(saved?.visibility, "active");
  assert.deepEqual(saved?.ratingSummary, listing.ratingSummary);
  assert.equal(saved?.legacyOperatingNote, listing.legacyOperatingNote);
  await assertSucceeds(updateDoc(listingRef, { availability: "available" }));

  for (const accountStatus of ["inactive", "suspended"]) {
    const blockedUid = `home-garage-${accountStatus}-availability`;
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`users/${blockedUid}`).set({ uid: blockedUid, role: "homegarage", accountStatus });
      await db.doc(`users/${blockedUid}/homeGarageVerification/profile`).set({
        uid: blockedUid, role: "homegarage", verificationStatus: "VERIFIED", business: { name: listing.businessName },
      });
      await db.doc(`providerListings/${blockedUid}`).set({ ...listing, providerId: blockedUid });
    });
    await assertDeniedWithoutExpressionLimit(
      () => updateDoc(doc(auth(blockedUid), "providerListings", blockedUid), { availability: "offline" }),
      `${accountStatus} Home Garage cannot change availability`,
    );
  }
});

test("Auto Shop availability toggles atomically sync profile and listing and require an active account", async () => {
  await env.clearFirestore();
  const uid = "atomic-shop-availability";
  const listing = {
    providerId: uid, role: "shop-owner", category: "Auto Shops", businessName: "Atomic Auto Shop",
    location: { latitude: 1.32, longitude: 103.81 }, availability: "available", visibility: "active",
    ratingSummary: { average: 4.8, count: 22 }, services: ["Engine repair"], vehicleTypes: ["Car"],
    serviceAreaLabel: "Central", description: "Vehicle repairs.", contactPhone: "12345678901",
    startingPrice: null, operatingHours: "09:00-18:00", emergencyServiceAvailable: true,
    acceptsScheduledBookings: true, legacyImported: true,
  };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${uid}`).set({ uid, role: "shop-owner", accountStatus: "active" });
    await db.doc(`users/${uid}/shopVerification/profile`).set({
      uid, role: "shop-owner", verificationStatus: "VERIFIED",
      business: { name: listing.businessName, phone: listing.contactPhone, address: "Central", latitude: 1.3, longitude: 103.8 },
    });
    await db.doc(`providers/${uid}`).set({ uid, role: "shop-owner", verified: true, status: "open" });
    await db.doc(`providerListings/${uid}`).set(listing);
  });

  const db = auth(uid);
  const providerRef = doc(db, "providers", uid);
  const listingRef = doc(db, "providerListings", uid);
  async function toggleShopAvailability(nextStatus, nextAvailability) {
    await runTransaction(db, async (transaction) => {
      await transaction.get(providerRef);
      await transaction.get(listingRef);
      transaction.update(providerRef, { status: nextStatus });
      transaction.update(listingRef, { availability: nextAvailability });
    });
  }

  await assertSucceeds(toggleShopAvailability("closed", "offline"));
  let savedProvider = (await getDoc(providerRef)).data();
  let savedListing = (await getDoc(listingRef)).data();
  assert.equal(savedProvider?.status, "closed");
  assert.equal(savedListing?.availability, "offline");
  assert.equal(savedListing?.visibility, "active");
  assert.deepEqual(savedListing?.ratingSummary, listing.ratingSummary);
  assert.equal(savedListing?.legacyImported, true);

  await assertSucceeds(toggleShopAvailability("open", "available"));
  savedProvider = (await getDoc(providerRef)).data();
  savedListing = (await getDoc(listingRef)).data();
  assert.equal(savedProvider?.status, "open");
  assert.equal(savedListing?.availability, "available");
  assert.equal(savedListing?.visibility, "active");
  assert.deepEqual(savedListing?.ratingSummary, listing.ratingSummary);

  for (const accountStatus of ["inactive", "suspended"]) {
    const blockedUid = `shop-${accountStatus}-availability`;
    await env.withSecurityRulesDisabled(async (context) => {
      const blockedDb = context.firestore();
      await blockedDb.doc(`users/${blockedUid}`).set({ uid: blockedUid, role: "shop-owner", accountStatus });
      await blockedDb.doc(`users/${blockedUid}/shopVerification/profile`).set({
        uid: blockedUid, role: "shop-owner", verificationStatus: "VERIFIED",
      });
      await blockedDb.doc(`providers/${blockedUid}`).set({ uid: blockedUid, role: "shop-owner", verified: true, status: "open" });
      await blockedDb.doc(`providerListings/${blockedUid}`).set({ ...listing, providerId: blockedUid });
    });
    const blockedDb = auth(blockedUid);
    await assertDeniedWithoutExpressionLimit(
      () => runTransaction(blockedDb, async (transaction) => {
        const blockedProviderRef = doc(blockedDb, "providers", blockedUid);
        const blockedListingRef = doc(blockedDb, "providerListings", blockedUid);
        await transaction.get(blockedProviderRef);
        await transaction.get(blockedListingRef);
        transaction.update(blockedProviderRef, { status: "closed" });
        transaction.update(blockedListingRef, { availability: "offline" });
      }),
      `${accountStatus} Auto Shop cannot change availability`,
    );
  }
});

test("Mechanic listing saves Emergency-only and Schedule flags; both booking modes pass existing rules", async () => {
  await env.clearFirestore();
  const provider = "mechanic-emergency-provider";
  const owner = "mechanic-emergency-owner";
  const listing = {
    providerId: provider, role: "onsite-mechanic", category: "Onsite Mechanics",
    businessName: "Verified Mechanic", location: { latitude: 14.67, longitude: 121.04 },
    availability: "available", visibility: "active", ratingSummary: { average: 4.2, count: 8 },
    services: ["Engine Diagnostics"], vehicleTypes: ["Car"], serviceAreaLabel: "Quezon City",
    description: "", contactPhone: "09170000000", startingPrice: null, operatingHours: "Daily, 8 AM-6 PM",
    emergencyServiceAvailable: false, acceptsScheduledBookings: false, legacyImported: "keep-me",
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
  await assertSucceeds(updateDoc(listingRef, {
    businessName: listing.businessName, location: listing.location, availability: "available", visibility: "active",
    serviceAreaLabel: listing.serviceAreaLabel, description: "Updated mechanic listing.", contactPhone: listing.contactPhone,
    services: listing.services, vehicleTypes: listing.vehicleTypes, operatingHours: listing.operatingHours,
    startingPrice: null, emergencyServiceAvailable: false, acceptsScheduledBookings: false,
  }));
  let savedListing = (await getDoc(listingRef)).data();
  assert.deepEqual(savedListing?.ratingSummary, listing.ratingSummary);
  assert.equal(savedListing?.legacyImported, listing.legacyImported);
  await assertSucceeds(updateDoc(listingRef, { availability: "offline" }));
  await assertSucceeds(updateDoc(listingRef, { availability: "available" }));
  savedListing = (await getDoc(listingRef)).data();
  assert.deepEqual(savedListing?.ratingSummary, listing.ratingSummary);
  assert.equal(savedListing?.legacyImported, listing.legacyImported);
  // Emergency only explicitly enables Emergency and leaves Schedule disabled.
  await assertSucceeds(updateDoc(listingRef, { emergencyServiceAvailable: true, acceptsScheduledBookings: false }));
  savedListing = (await getDoc(listingRef)).data();
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
    await db.doc(`users/${providerId}`).set({ uid: providerId, role: "onsite-mechanic", accountStatus: "active" });
    await db.doc(`users/${providerId}/providerProfile/profile`).set({ uid: providerId, role: "onsite-mechanic", verificationStatus: "VERIFIED" });
    await db.doc(`providerListings/${providerId}`).set({ providerId, role: "onsite-mechanic", category: "Onsite Mechanics", visibility: "active", availability: "available" });
    await db.doc("users/tow-provider").set({ uid: "tow-provider", role: "towing-company", accountStatus: "active" });
    await db.doc("users/tow-provider/towingCompanyProfile/profile").set({ uid: "tow-provider", role: "towing-company", verificationStatus: "VERIFIED" });
    await db.doc("providerListings/tow-provider").set({ providerId: "tow-provider", role: "towing-company", category: "Towing", visibility: "active", availability: "available" });
    await db.doc(`users/${providerId}`).set({ uid: providerId, role: "onsite-mechanic", accountStatus: "active" });
    await db.doc(`users/${providerId}/providerProfile/profile`).set({ uid: providerId, role: "onsite-mechanic", verificationStatus: "VERIFIED" });
    await db.doc(`providerListings/${providerId}`).set({ providerId, role: "onsite-mechanic", category: "Onsite Mechanics", visibility: "active", availability: "available" });
    await db.doc("users/tow-provider").set({ uid: "tow-provider", role: "towing-company", accountStatus: "active" });
    await db.doc("users/tow-provider/towingCompanyProfile/profile").set({ uid: "tow-provider", role: "towing-company", verificationStatus: "VERIFIED" });
    await db.doc("providerListings/tow-provider").set({ providerId: "tow-provider", role: "towing-company", category: "Towing", visibility: "active", availability: "available" });
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
    await db.doc(`users/${providerId}`).set({ uid: providerId, role: "onsite-mechanic", accountStatus: "active" });
    await db.doc(`users/${providerId}/providerProfile/profile`).set({ uid: providerId, role: "onsite-mechanic", verificationStatus: "VERIFIED" });
    await db.doc(`providerListings/${providerId}`).set({ providerId, role: "onsite-mechanic", category: "Onsite Mechanics", visibility: "active", availability: "available" });
    await db.doc("users/tow-provider").set({ uid: "tow-provider", role: "towing-company", accountStatus: "active" });
    await db.doc("users/tow-provider/towingCompanyProfile/profile").set({ uid: "tow-provider", role: "towing-company", verificationStatus: "VERIFIED" });
    await db.doc("providerListings/tow-provider").set({ providerId: "tow-provider", role: "towing-company", category: "Towing", visibility: "active", availability: "available" });
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
    if (bookingType === "onsite-mechanic" || bookingType === "towing-company") {
      const collectionName = bookingType === "onsite-mechanic" ? "mechanicNotifications" : "towingNotifications";
      await seedProgressNotifications(id, collectionName);
      await assertSucceeds(startWithNotifications(auth(provider), id, status, collectionName));
    } else {
      await assertSucceeds(updateDoc(doc(auth(provider), "bookings", id), { status, updatedAt: serverTimestamp() }));
    }
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
test("Towing listing saves preserve ratings and legacy fields; availability toggles only the narrow field", async () => {
  await env.clearFirestore();
  const uid = "towing-save-and-toggle";
  const listing = {
    providerId: uid, role: "towing-company", category: "Towing", businessName: "Tow Service",
    location: { latitude: 14.6, longitude: 121.0 }, availability: "offline", visibility: "active",
    ratingSummary: { average: 4.6, count: 11 }, services: ["Flatbed Towing"], vehicleTypes: ["Car"],
    serviceAreaLabel: "Quezon City", description: "Roadside towing support.", contactPhone: "09123456789",
    startingPrice: null, operatingHours: "Open daily", emergencyServiceAvailable: true,
    acceptsScheduledBookings: true, legacyImported: "keep-me",
  };
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await db.doc(`users/${uid}`).set({ uid, role: "towing-company", accountStatus: "active" });
    await db.doc(`users/${uid}/towingCompanyProfile/profile`).set({ uid, role: "towing-company", verificationStatus: "VERIFIED" });
    await db.doc(`providerListings/${uid}`).set(listing);
  });
  const listingRef = doc(auth(uid), "providerListings", uid);
  await assertSucceeds(updateDoc(listingRef, {
    businessName: "Updated Tow Service", location: listing.location, availability: "offline", visibility: "active",
    serviceAreaLabel: listing.serviceAreaLabel, description: "Updated roadside towing support.",
    contactPhone: listing.contactPhone, services: listing.services, vehicleTypes: listing.vehicleTypes,
    operatingHours: listing.operatingHours, startingPrice: null, emergencyServiceAvailable: true,
    acceptsScheduledBookings: true,
  }));
  let saved = (await getDoc(listingRef)).data();
  assert.deepEqual(saved?.ratingSummary, listing.ratingSummary);
  assert.equal(saved?.legacyImported, listing.legacyImported);
  await assertSucceeds(updateDoc(listingRef, { availability: "available" }));
  await assertSucceeds(updateDoc(listingRef, { availability: "offline" }));
  saved = (await getDoc(listingRef)).data();
  assert.equal(saved?.availability, "offline");
  assert.deepEqual(saved?.ratingSummary, listing.ratingSummary);
  assert.equal(saved?.legacyImported, listing.legacyImported);
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(listingRef, { ratingSummary: { average: 5, count: 99 } }),
    "Towing provider cannot change system ratings",
  );
});

test("guest map query filters exclude phone-bearing rows while guest list access remains disabled", async () => {
  await env.clearFirestore();
  const uid = "contact-provider";
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${uid}`).set({ uid, role: "onsite-mechanic", accountStatus: "active" });
    const safeListing = {
      providerId: uid, role: "onsite-mechanic", category: "Onsite Mechanics", businessName: "Mechanic",
      location: { latitude: 14.6, longitude: 121 }, availability: "available", visibility: "active",
      ratingSummary: { average: 4.5, count: 3 }, services: ["Engine Diagnostics"], vehicleTypes: ["Car"],
      serviceAreaLabel: "Quezon City", description: "Repairs", startingPrice: null,
      operatingHours: "Daily", emergencyServiceAvailable: true, acceptsScheduledBookings: true, contactPhone: "",
    };
    await db.doc(`providerListings/${uid}`).set(safeListing);
    await db.doc("providerListings/unsafe-phone").set({ ...safeListing, providerId: "unsafe-phone", contactPhone: "09123456789" });
    await db.doc("providerListings/safe-scheduled").set({ ...safeListing, providerId: "safe-scheduled", availability: "offline" });
    await db.doc("providerListings/unsafe-scheduled").set({ ...safeListing, providerId: "unsafe-scheduled", availability: "offline", contactPhone: "09123456789" });
    await db.doc("providerListings/hidden-safe").set({ ...safeListing, providerId: "hidden-safe", visibility: "inactive" });
    await db.doc(`providerContacts/${uid}`).set({ providerId: uid, phone: "09123456789" });
    await db.doc(`users/${uid}/providerProfile/profile`).set({ personal: { phone: "09123456789", address: "Private address" } });
  });
  const guest = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(guest, "providerListings", uid)));
  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(guest, "providerListings", "unsafe-phone")), "guest cannot read a listing carrying a phone");
  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(guest, "providerListings", "hidden-safe")), "guest cannot read a hidden listing");

  const marker = where("contactPhone", "==", "");
  const filters = [
    [where("visibility", "==", "active"), where("availability", "==", "available"), marker],
    [where("visibility", "==", "active"), where("acceptsScheduledBookings", "==", true), marker],
    [where("visibility", "==", "active"), where("role", "==", "shop-owner"), where("availability", "==", "available"), marker],
    [where("visibility", "==", "active"), where("role", "==", "shop-owner"), where("acceptsScheduledBookings", "==", true), marker],
  ];
  const queries = filters.map((conditions) => query(collection(guest, "providerListings"), ...conditions));
  await env.withSecurityRulesDisabled(async (context) => {
    const unrestricted = context.firestore();
    const actualFilters = filters.map((conditions) => query(collection(unrestricted, "providerListings"), ...conditions));
    const results = await Promise.all(actualFilters.map((candidate) => getDocs(candidate)));
    assert.deepEqual(results[0].docs.map((item) => item.id).sort(), [uid]);
    assert.deepEqual(results[1].docs.map((item) => item.id).sort(), [uid, "safe-scheduled"]);
    assert.equal(results[2].size, 0);
    assert.equal(results[3].size, 0);
  });
  for (const candidate of queries) {
    await assertDeniedWithoutExpressionLimit(() => getDocs(candidate), "guest collection read remains disabled pending migration and rollout review");
  }
  await assertDeniedWithoutExpressionLimit(
    () => getDocs(query(collection(guest, "providerListings"), where("visibility", "==", "active"), where("availability", "==", "available"))),
    "guest map query without the empty-phone equality filter is denied",
  );

  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(guest, "providerContacts", uid)), "guest contact read denied");
  await assertSucceeds(setDoc(doc(auth(uid), "providerContacts", uid), { providerId: uid, phone: "09123456789" }));
  await assertDeniedWithoutExpressionLimit(
    () => setDoc(doc(auth(uid), "providerContacts", uid), { providerId: "another-provider", phone: "09123456789" }),
    "provider cannot forge a contact document identity",
  );
  const owner = auth("vehicle-owner");
  await assertSucceeds(getDoc(doc(owner, "providerContacts", uid)));
  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(owner, "users", uid, "providerProfile", "profile")), "customer cannot read full provider profile");
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`providerListings/${uid}`).update({ visibility: "inactive" });
  });
  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(owner, "providerContacts", uid)), "suspended or hidden listing contact is inaccessible");
});

test("ID-only provider directory is atomic, immutable, and still gated by individual listing reads", async () => {
  await env.clearFirestore();
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const providers = [
    ["directory-mechanic", "onsite-mechanic", "Onsite Mechanics", "Engine Diagnostics"],
    ["directory-towing", "towing-company", "Towing", "Flatbed Towing"],
    ["directory-shop", "shop-owner", "Auto Shops", "Engine repair"],
    ["directory-garage", "homegarage", "Parking Lots", "Oil change"],
  ];
  const listingFor = ([uid, role, category, service]) => ({
    providerId: uid, role, category, businessName: "Verified Directory Provider",
    location: { latitude: 14.6, longitude: 121 }, availability: "available", visibility: "active",
    ratingSummary: { average: 0, count: 0 }, services: [service], vehicleTypes: ["Car"],
    serviceAreaLabel: "Test service area", description: "Test listing", startingPrice: null,
    operatingHours: "Open daily", emergencyServiceAvailable: true, acceptsScheduledBookings: true, contactPhone: "",
    ...(role === "shop-owner" ? { photoUrls: ["https://example.invalid/shop.jpg"], hoursType: "24_7", is24Hours: true, weeklyHours: days.map((day) => ({ day })) } : {}),
  });

  for (const [uid, role] of providers) {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`users/${uid}`).set({ uid, role, accountStatus: "active" });
      if (role === "onsite-mechanic") await db.doc(`users/${uid}/providerProfile/profile`).set({ uid, role, verificationStatus: "VERIFIED" });
      if (role === "towing-company") await db.doc(`users/${uid}/towingCompanyProfile/profile`).set({ uid, role, verificationStatus: "VERIFIED" });
      if (role === "homegarage") await db.doc(`users/${uid}/homeGarageVerification/profile`).set({ uid, role, verificationStatus: "VERIFIED", business: { name: "Verified Directory Provider" } });
      if (role === "shop-owner") {
        await db.doc(`users/${uid}/shopVerification/profile`).set({ uid, role, verificationStatus: "VERIFIED", business: { name: "Verified Directory Provider", phone: "09123456789", address: "Test area" } });
        await db.doc(`providers/${uid}`).set({ uid, role, verified: true, status: "open" });
      }
    });

    const db = auth(uid);
    const listingRef = doc(db, "providerListings", uid);
    const contactRef = doc(db, "providerContacts", uid);
    const directoryRef = doc(db, "publicProviderDirectory", uid);
    await assertSucceeds(runTransaction(db, async (transaction) => {
      if (role === "shop-owner") await transaction.get(doc(db, "providers", uid));
      const [listing, contact, directory] = await Promise.all([
        transaction.get(listingRef), transaction.get(contactRef), transaction.get(directoryRef),
      ]);
      assert.equal(listing.exists(), false);
      assert.equal(contact.exists(), false);
      assert.equal(directory.exists(), false);
      transaction.set(listingRef, listingFor([uid, role, ...providers.find((item) => item[0] === uid).slice(2)]));
      transaction.set(contactRef, { providerId: uid, phone: "09123456789" });
      transaction.set(directoryRef, {});
    }));
  }

  const forgedUid = "directory-forged-atomic";
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${forgedUid}`).set({ uid: forgedUid, role: "onsite-mechanic", accountStatus: "active" });
    await db.doc(`users/${forgedUid}/providerProfile/profile`).set({ uid: forgedUid, role: "onsite-mechanic", verificationStatus: "VERIFIED" });
  });
  const forgedDb = auth(forgedUid);
  await assertDeniedWithoutExpressionLimit(() => runTransaction(forgedDb, async (transaction) => {
    const listingRef = doc(forgedDb, "providerListings", forgedUid);
    const contactRef = doc(forgedDb, "providerContacts", forgedUid);
    const directoryRef = doc(forgedDb, "publicProviderDirectory", forgedUid);
    await Promise.all([transaction.get(listingRef), transaction.get(contactRef), transaction.get(directoryRef)]);
    transaction.set(listingRef, listingFor([forgedUid, "onsite-mechanic", "Onsite Mechanics", "Engine Diagnostics"]));
    transaction.set(contactRef, { providerId: forgedUid, phone: "09123456789" });
    transaction.set(directoryRef, { phone: "must-not-be-public" });
  }), "forged directory fields reject the entire first-publish transaction");
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    assert.equal((await getDoc(doc(db, "providerListings", forgedUid))).exists(), false);
    assert.equal((await getDoc(doc(db, "providerContacts", forgedUid))).exists(), false);
  });

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [uid, role, category, service] of [["directory-phone", "onsite-mechanic", "Onsite Mechanics", "Engine Diagnostics"], ["directory-hidden", "onsite-mechanic", "Onsite Mechanics", "Engine Diagnostics"]]) {
      await db.doc(`providerListings/${uid}`).set({ ...listingFor([uid, role, category, service]), ...(uid === "directory-phone" ? { contactPhone: "09123456789" } : { visibility: "inactive" }) });
      await db.doc(`publicProviderDirectory/${uid}`).set({});
    }
    await db.doc("providerContacts/directory-mechanic").set({ providerId: "directory-mechanic", phone: "09123456789" });
    await db.doc("bookings/directory-private-booking").set({ customerId: "vehicle-owner", providerId: "directory-mechanic", bookingType: "onsite-mechanic", status: "pending" });
    await db.doc("users/directory-prepublish-contact").set({ uid: "directory-prepublish-contact", role: "onsite-mechanic", accountStatus: "active" });
    await db.doc("providerContacts/directory-prepublish-contact").set({ providerId: "directory-prepublish-contact", phone: "09123456789" });
  });

  const guest = env.unauthenticatedContext().firestore();
  const entries = await assertSucceeds(getDocs(collection(guest, "publicProviderDirectory")));
  assert.ok(entries.docs.some((entry) => entry.id === "directory-mechanic"));
  assert.ok(entries.docs.every((entry) => Object.keys(entry.data()).length === 0));
  for (const [uid] of providers) await assertSucceeds(getDoc(doc(guest, "providerListings", uid)));
  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(guest, "providerListings", "directory-phone")), "phone-bearing listing remains unreadable through the ID directory");
  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(guest, "providerListings", "directory-hidden")), "hidden listing remains unreadable through the ID directory");
  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(guest, "providerContacts", "directory-mechanic")), "guest cannot read private provider contacts");
  await assertDeniedWithoutExpressionLimit(() => getDocs(collection(guest, "providerContacts")), "guest cannot list private provider contacts");
  await assertDeniedWithoutExpressionLimit(() => getDoc(doc(guest, "bookings", "directory-private-booking")), "guest cannot read bookings");
  await assertDeniedWithoutExpressionLimit(() => getDocs(collection(guest, "bookings")), "guest cannot list bookings");
  await assertDeniedWithoutExpressionLimit(() => getDocs(collection(guest, "providerListings")), "guest cannot query listings without directory IDs");

  const ownerDb = auth("directory-mechanic");
  await assertDeniedWithoutExpressionLimit(() => setDoc(doc(ownerDb, "publicProviderDirectory", "forged-target"), {}), "provider cannot forge another provider's directory ID");
  await assertDeniedWithoutExpressionLimit(() => updateDoc(doc(ownerDb, "publicProviderDirectory", "directory-mechanic"), { extra: "field" }), "directory entries cannot be changed");
  await assertDeniedWithoutExpressionLimit(() => deleteDoc(doc(ownerDb, "publicProviderDirectory", "directory-mechanic")), "directory entries cannot be deleted by clients");
  const prepublishOwnerDb = auth("directory-prepublish-contact");
  await assertSucceeds(getDoc(doc(prepublishOwnerDb, "providerContacts", "directory-prepublish-contact")));
});

test("provider listing writes cannot create or restore a public phone field; clearing it and availability updates remain valid", async () => {
  await env.clearFirestore();
  const uid = "phone-field-provider";
  const base = {
    providerId: uid, role: "onsite-mechanic", category: "Onsite Mechanics", businessName: "Phone Safe Mechanic",
    location: { latitude: 14.6, longitude: 121.0 }, availability: "available", visibility: "active",
    ratingSummary: { average: 0, count: 0 }, services: ["Engine Diagnostics"], vehicleTypes: ["Car"],
    serviceAreaLabel: "Quezon City", description: "Repairs", startingPrice: null, operatingHours: "Daily",
    emergencyServiceAvailable: true, acceptsScheduledBookings: true,
  };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc(`users/${uid}`).set({ uid, role: "onsite-mechanic", accountStatus: "active" });
    await db.doc(`users/${uid}/providerProfile/profile`).set({ uid, role: "onsite-mechanic", verificationStatus: "VERIFIED" });
  });
  const listingRef = doc(auth(uid), "providerListings", uid);
  await assertDeniedWithoutExpressionLimit(
    () => setDoc(listingRef, { ...base, contactPhone: "09123456789" }),
    "new listing cannot contain a phone",
  );
  await assertSucceeds(setDoc(listingRef, base));
  await assertSucceeds(updateDoc(listingRef, { contactPhone: "" }));

  // Simulate a legacy listing that predates the rule safeguard.
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`providerListings/${uid}`).update({ contactPhone: "09123456789" });
  });
  await assertSucceeds(updateDoc(listingRef, { ...base, description: "A normal full save with the old phone unchanged." }));
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(listingRef, { contactPhone: "09999999999" }),
    "older writer cannot replace a listing phone",
  );
  await assertSucceeds(setDoc(listingRef, { ...base, description: "Phone moved to the private contact document.", contactPhone: "" }));
  assert.equal((await getDoc(listingRef)).data()?.contactPhone, "");
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(listingRef, { contactPhone: "09123456789" }),
    "older writer cannot restore a phone after cleanup",
  );
  await assertSucceeds(updateDoc(listingRef, { availability: "offline" }));
  await assertSucceeds(updateDoc(listingRef, { availability: "available" }));

  const hidden = { ...base, providerId: "admin-phone-provider", visibility: "inactive" };
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("providerListings/admin-phone-provider").set(hidden);
  });
  await assertDeniedWithoutExpressionLimit(
    () => updateDoc(doc(env.authenticatedContext("rules-admin", { admin: true }).firestore(), "providerListings", "admin-phone-provider"), { contactPhone: "09123456789" }),
    "admin lifecycle write cannot restore a phone field",
  );
});

test("eligible availability transitions atomically create directory IDs for all four roles without changing ratings or visibility", async () => {
  await env.clearFirestore();
  const providers = [
    ["directory-toggle-mechanic", "onsite-mechanic", "Onsite Mechanics"],
    ["directory-toggle-towing", "towing-company", "Towing"],
    ["directory-toggle-shop", "shop-owner", "Auto Shops"],
    ["directory-toggle-garage", "homegarage", "Parking Lots"],
  ];
  const ratings = { average: 4.7, count: 19 };
  const listingFor = (uid, role, category) => ({
    providerId: uid, role, category, businessName: "Existing approved provider",
    location: { latitude: 14.6, longitude: 121 }, visibility: "active", availability: "offline",
    ratingSummary: ratings, services: role === "homegarage" ? ["Oil change"] : ["Service"],
    vehicleTypes: ["Car"], serviceAreaLabel: "Central", description: "Existing listing",
    contactPhone: "", startingPrice: null, operatingHours: "Daily",
    emergencyServiceAvailable: true, acceptsScheduledBookings: false,
    ...(role === "shop-owner" ? { photoUrls: ["https://example.invalid/shop.jpg"], hoursType: "24_7", is24Hours: true, weeklyHours: [{ day: "Monday" }] } : {}),
    ...(role === "homegarage" ? { totalSlots: 5, availableSlots: 5 } : {}),
  });

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [uid, role, category] of providers) {
      await db.doc(`users/${uid}`).set({ uid, role, accountStatus: "active" });
      if (role === "onsite-mechanic") await db.doc(`users/${uid}/providerProfile/profile`).set({ uid, role, verificationStatus: "VERIFIED" });
      if (role === "towing-company") await db.doc(`users/${uid}/towingCompanyProfile/profile`).set({ uid, role, verificationStatus: "VERIFIED" });
      if (role === "shop-owner") {
        await db.doc(`providers/${uid}`).set({ uid, role, verified: true, status: "closed", businessName: "Approved Shop", phone: "09123456789", address: "Central", latitude: 14.6, longitude: 121 });
        await db.doc(`users/${uid}/shopVerification/profile`).set({ uid, role, verificationStatus: "VERIFIED" });
      }
      if (role === "homegarage") await db.doc(`users/${uid}/homeGarageVerification/profile`).set({ uid, role, verificationStatus: "VERIFIED", business: { name: "Approved Garage" } });
      await db.doc(`providerListings/${uid}`).set(listingFor(uid, role, category));
    }
  });

  for (const [uid, role] of providers) {
    const db = auth(uid);
    const listingRef = doc(db, "providerListings", uid);
    const directoryRef = doc(db, "publicProviderDirectory", uid);
    const providerRef = doc(db, "providers", uid);
    await assertDeniedWithoutExpressionLimit(() => setDoc(directoryRef, {}), `${role} cannot index an offline non-scheduled listing`);
    await assertSucceeds(runTransaction(db, async (transaction) => {
      const [listing, directory] = await Promise.all([transaction.get(listingRef), transaction.get(directoryRef)]);
      assert.ok(listing.exists());
      assert.equal(directory.exists(), false);
      if (role === "shop-owner") {
        const provider = await transaction.get(providerRef);
        assert.equal(provider.data().status, "closed");
        transaction.update(providerRef, { status: "open" });
      }
      transaction.update(listingRef, { availability: "available" });
      transaction.set(directoryRef, {});
    }));
    assert.equal((await getDoc(directoryRef)).exists(), true, `${role} directory entry created with its eligible transition`);
    const afterAvailable = (await getDoc(listingRef)).data();
    assert.equal(afterAvailable.visibility, "active");
    assert.deepEqual(afterAvailable.ratingSummary, ratings);

    // Existing IDs stay in place as availability changes in both directions.
    await assertSucceeds(runTransaction(db, async (transaction) => {
      await transaction.get(directoryRef);
      if (role === "shop-owner") transaction.update(providerRef, { status: "closed" });
      transaction.update(listingRef, { availability: "offline" });
    }));
    await assertSucceeds(runTransaction(db, async (transaction) => {
      await transaction.get(directoryRef);
      if (role === "shop-owner") transaction.update(providerRef, { status: "open" });
      transaction.update(listingRef, { availability: "available" });
    }));
    assert.equal((await getDoc(directoryRef)).exists(), true, `${role} directory entry survives availability toggles`);
    const finalListing = (await getDoc(listingRef)).data();
    assert.equal(finalListing.visibility, "active");
    assert.equal(finalListing.availability, "available");
    assert.deepEqual(finalListing.ratingSummary, ratings);
  }
});

test("listing and provider contact changes are atomic; failed contact validation leaves the published phone intact", async () => {
  await env.clearFirestore();
  const uid = "atomic-contact-provider";
  const oldPhone = "09123456789";
  const listing = {
    providerId: uid, role: "onsite-mechanic", category: "Onsite Mechanics", businessName: "Atomic Mechanic",
    location: { latitude: 14.6, longitude: 121 }, availability: "available", visibility: "active",
    ratingSummary: { average: 4.2, count: 8 }, services: ["Engine Diagnostics"], vehicleTypes: ["Car"],
    serviceAreaLabel: "Central", description: "Repairs", contactPhone: oldPhone, startingPrice: null,
    operatingHours: "Daily", emergencyServiceAvailable: true, acceptsScheduledBookings: true,
  };
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`users/${uid}`).set({ uid, role: "onsite-mechanic", accountStatus: "active" });
    await context.firestore().doc(`users/${uid}/providerProfile/profile`).set({ uid, role: "onsite-mechanic", verificationStatus: "VERIFIED" });
    await context.firestore().doc(`providerListings/${uid}`).set(listing);
  });
  const db = auth(uid);
  const listingRef = doc(db, "providerListings", uid);
  const contactRef = doc(db, "providerContacts", uid);
  await assertSucceeds(runTransaction(db, async (transaction) => {
    const currentListing = await transaction.get(listingRef);
    const currentContact = await transaction.get(contactRef);
    const keepPhone = currentContact.data()?.phone || currentListing.data()?.contactPhone;
    transaction.update(listingRef, { contactPhone: "" });
    transaction.set(contactRef, { providerId: uid, phone: keepPhone });
  }));
  assert.equal((await getDoc(listingRef)).data()?.contactPhone, "");
  assert.equal((await getDoc(contactRef)).data()?.phone, oldPhone);

  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`providerListings/${uid}`).update({ contactPhone: oldPhone });
    await context.firestore().doc(`providerContacts/${uid}`).delete();
  });
  await assertDeniedWithoutExpressionLimit(() => runTransaction(db, async (transaction) => {
    const currentListing = await transaction.get(listingRef);
    const currentContact = await transaction.get(contactRef);
    const keepPhone = currentContact.data()?.phone || currentListing.data()?.contactPhone;
    transaction.update(listingRef, { contactPhone: "" });
    transaction.set(contactRef, { providerId: "forged-provider-id", phone: keepPhone });
  }), "invalid private contact causes the atomic listing transaction to fail");
  assert.equal((await getDoc(listingRef)).data()?.contactPhone, oldPhone, "failed transaction did not clear the published number");
  assert.equal((await getDoc(contactRef)).exists(), false, "failed transaction did not create an invalid private contact");
});
