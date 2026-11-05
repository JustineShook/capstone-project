import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

test("production map filtering is enabled after existing-provider timestamp verification", () => {
  const source = readFileSync(new URL("../services/owner/providerMapService.ts", import.meta.url), "utf8");
  assert.match(source, /const MAP_SUBSCRIPTION_FILTER_ENABLED = true;/);
});

test("ordinary listing saves leave the system-owned expiry projection untouched", async () => {
  class Timestamp {
    constructor(milliseconds) { this.milliseconds = milliseconds; }
    toMillis() { return this.milliseconds; }
    static fromDate(date) { return new Timestamp(date.getTime()); }
  }
  const expiry = new Timestamp(Date.parse("2027-01-01T00:00:00.000Z"));
  const baseListing = {
    providerId: "mechanic-1", role: "onsite-mechanic", category: "Onsite Mechanics",
    businessName: "Roadside Help", location: { latitude: 14.6, longitude: 121 },
    visibility: "active", availability: "available", ratingSummary: { average: 0, count: 0 },
    services: ["Engine Diagnostics"], vehicleTypes: ["Car"], serviceAreaLabel: "Manila",
    description: "Roadside assistance", startingPrice: null, operatingHours: "Daily",
    emergencyServiceAvailable: true,
  };
  for (const role of ["onsite-mechanic", "shop-owner"]) {
    const uid = role === "shop-owner" ? "shop-1" : "mechanic-1";
    const existingListing = { ...baseListing, providerId: uid, role,
      category: role === "shop-owner" ? "Auto Shops" : "Onsite Mechanics",
      emergencyServiceAvailable: true, mapSubscriptionExpiresAt: expiry };
    const writes = [];
    const refs = {
      [`providers/${uid}`]: { uid, role: "shop-owner", verified: true, status: "open" },
      [`users/${uid}`]: { uid, role, subscription: { expiresAt: expiry } },
      [`providerListings/${uid}`]: existingListing,
      [`providerContacts/${uid}`]: { providerId: uid, phone: "09123456789" },
      [`publicProviderDirectory/${uid}`]: {},
    };
    const dependencies = {
      "firebase/firestore": {
        Timestamp,
        collection: (_db, ...parts) => parts.join("/"),
        doc: (_db, ...parts) => parts.join("/"),
        getDoc: async () => ({ exists: () => false }),
        getDocs: async () => ({ docs: [] }),
        onSnapshot: () => () => {},
        query: (...parts) => parts,
        runTransaction: async (_db, callback) => callback({
          get: async (path) => ({ exists: () => Boolean(refs[path]), data: () => refs[path] }),
          update: (path, data) => writes.push({ op: "update", path, data }),
          set: (path, data) => writes.push({ op: "set", path, data }),
          delete: (path) => writes.push({ op: "delete", path }),
        }),
        where: () => {}, writeBatch: () => ({}),
      },
      "../types/providerListing": { isBookableShopListing: () => true },
      "./firebase": { db: {} },
      "./providerContactService": { getProviderContactPhone: async () => "" },
    };
    const source = readFileSync(new URL("../services/publicProviderListingService.ts", import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const module = { exports: {} };
    runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename: "publicProviderListingService.ts" })(
      (name) => {
        assert.ok(name in dependencies, `Unexpected dependency ${name}`);
        return dependencies[name];
      }, module, module.exports,
    );
    const input = { ...baseListing, businessName: "Updated Provider", contactPhone: "",
      services: ["Repair"], vehicleTypes: ["Car"], operatingHours: "Daily", startingPrice: null };
    await module.exports.updatePublicProviderListing(uid, role, input);
    const listingUpdate = writes.find((write) => write.op === "update" && write.path === `providerListings/${uid}`);
    assert.ok(listingUpdate, `${role} listing update was issued`);
    assert.equal(Object.hasOwn(listingUpdate.data, "mapSubscriptionExpiresAt"), false,
      `${role} profile form cannot overwrite the system-owned expiry`);
    assert.equal(refs[`providerListings/${uid}`].mapSubscriptionExpiresAt, expiry);
  }
});

test("demo renewal commits private expiry/history atomically, then refreshes the existing public projection", async () => {
  class Timestamp {
    constructor(milliseconds) { this.milliseconds = milliseconds; }
    toDate() { return new Date(this.milliseconds); }
    toMillis() { return this.milliseconds; }
    static fromDate(date) { return new Timestamp(date.getTime()); }
  }
  const now = Date.now();
  const uid = "provider-renewal";
  const refs = {
    [`users/${uid}`]: { uid, role: "onsite-mechanic", subscription: {
      status: "active", plan: "monthly", demoAmount: 100,
      startedAt: new Timestamp(now - 31 * 86400000), expiresAt: new Timestamp(now - 1000), lastTransactionId: "previous",
    } },
    [`providerListings/${uid}`]: { providerId: uid, mapSubscriptionExpiresAt: new Timestamp(now - 1000) },
  };
  const writes = [];
  let transactionCompleted = false;
  let transactionCount = 0;
  const dependencies = {
    "firebase/firestore": {
      Timestamp,
      collection: (_db, ...parts) => ({ path: parts.join("/") }),
      doc: (_db, ...parts) => parts.length === 1
        ? { path: `${parts[0].path}/transaction-${++transactionCount}`, id: `transaction-${transactionCount}` }
        : { path: parts.join("/"), id: parts.at(-1) },
      onSnapshot: () => () => {}, orderBy: () => {}, query: () => {}, serverTimestamp: () => new Timestamp(Date.now()),
      runTransaction: async (_db, callback) => {
        const result = await callback({
          get: async (ref) => ({ exists: () => Boolean(refs[ref.path]), data: () => refs[ref.path] }),
          update: (ref, data) => { writes.push({ op: "update", path: ref.path, data }); refs[ref.path] = { ...refs[ref.path], ...data }; },
          set: (ref, data) => { writes.push({ op: "set", path: ref.path, data }); refs[ref.path] = data; },
        });
        transactionCompleted = true;
        return result;
      },
      updateDoc: async (ref, data) => {
        assert.equal(transactionCompleted, true, "public projection follows the atomic private activation/history commit");
        writes.push({ op: "update", path: ref.path, data });
        refs[ref.path] = { ...refs[ref.path], ...data };
      },
    },
    "../constants/demoSubscriptionPlans": { DEMO_SUBSCRIPTION_PLANS: {
      monthly: { id: "monthly", label: "Monthly demo plan", amount: 100, durationDays: 30 },
      yearly: { id: "yearly", label: "Yearly demo plan", amount: 1000, durationDays: 365 },
    } },
    "../types/demoSubscription": {},
    "./firebase": { db: {}, auth: { currentUser: { uid } } },
  };
  const source = readFileSync(new URL("../services/demoSubscriptionService.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename: "demoSubscriptionService.ts" })(
    (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    }, module, module.exports,
  );
  const expiry = await module.exports.simulateDemoSubscriptionActivation("yearly");
  const accountExpiry = refs[`users/${uid}`].subscription.expiresAt;
  const listingExpiry = refs[`providerListings/${uid}`].mapSubscriptionExpiresAt;
  const history = writes.find((write) => write.op === "set");
  assert.ok(Math.abs((expiry.getTime() - now) - 365 * 86400000) < 1_000);
  assert.equal(accountExpiry.toMillis(), expiry.getTime());
  assert.equal(listingExpiry.toMillis(), expiry.getTime());
  assert.equal(history.data.expiresAt.toMillis(), expiry.getTime());
  assert.deepEqual(writes.map((write) => write.path), [
    `users/${uid}`, history.path, `providerListings/${uid}`,
  ]);
});
