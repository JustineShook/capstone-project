import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";

import { DEMO_SUBSCRIPTION_PLANS } from "../constants/demoSubscriptionPlans";
import type { DemoSubscription, DemoSubscriptionPlanId, DemoSubscriptionTransaction } from "../types/demoSubscription";
import { auth, db } from "./firebase";

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

export function parseDemoSubscription(data: DocumentData | undefined): DemoSubscription | null {
  const raw = data?.subscription;
  if (!raw || typeof raw !== "object" || raw.status !== "active") return null;
  const plan = DEMO_SUBSCRIPTION_PLANS[raw.plan as DemoSubscriptionPlanId];
  const startedAt = toDate(raw.startedAt);
  const expiresAt = toDate(raw.expiresAt);
  if (!plan || !startedAt || !expiresAt || typeof raw.lastTransactionId !== "string") return null;
  return { status: "active", plan: plan.id, demoAmount: plan.amount, startedAt, expiresAt, lastTransactionId: raw.lastTransactionId };
}

export function subscribeToMyDemoSubscription(
  onChange: (subscription: DemoSubscription | null) => void,
  onError?: (error: Error) => void,
) {
  const user = auth.currentUser;
  if (!user) {
    onChange(null);
    return () => undefined;
  }
  return onSnapshot(doc(db, "users", user.uid), snapshot => {
    onChange(parseDemoSubscription(snapshot.data()));
  }, error => onError?.(error));
}

export function subscribeToMyDemoSubscriptionHistory(
  onChange: (items: DemoSubscriptionTransaction[]) => void,
  onError?: (error: Error) => void,
) {
  const user = auth.currentUser;
  if (!user) {
    onChange([]);
    return () => undefined;
  }
  return onSnapshot(query(
    collection(db, "users", user.uid, "demoSubscriptionTransactions"),
    orderBy("createdAt", "desc"),
  ), snapshot => onChange(snapshot.docs.map(item => {
    const data = item.data();
    const planId = data.plan as DemoSubscriptionPlanId;
    const plan = DEMO_SUBSCRIPTION_PLANS[planId];
    return {
      id: item.id,
      providerId: data.providerId as string,
      transactionId: data.transactionId as string,
      plan: planId,
      demoAmount: plan?.amount ?? Number(data.demoAmount),
      durationDays: plan?.durationDays ?? Number(data.durationDays),
      type: data.type as DemoSubscriptionTransaction["type"],
      startedAt: toDate(data.startedAt) ?? new Date(0),
      expiresAt: toDate(data.expiresAt) ?? new Date(0),
      createdAt: toDate(data.createdAt) ?? new Date(0),
      label: "demo_only",
    };
  })), error => onError?.(error));
}

export type DemoSubscriptionMapSyncStatus = "synced" | "missing_listing";

export class DemoSubscriptionMapSyncError extends Error {
  constructor(readonly expiresAt: Date) {
    super("Subscription activated, but map sync failed. Use Retry Sync; no new payment or activation is needed.");
    this.name = "DemoSubscriptionMapSyncError";
  }
}

// Read the current expiry inside the same transaction as the listing update so
// a concurrent renewal cannot leave an older expiry on the public listing.
export async function syncMyDemoSubscriptionMapExpiry(): Promise<DemoSubscriptionMapSyncStatus> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to sync your subscription.");
  return runTransaction(db, async transaction => {
    const account = await transaction.get(doc(db, "users", user.uid));
    const expiry = account.data()?.subscription?.expiresAt;
    if (!parseDemoSubscription(account.data()) || !(expiry instanceof Timestamp)) {
      throw new Error("No existing demo subscription expiry is available to sync.");
    }
    const listingRef = doc(db, "providerListings", user.uid);
    const listing = await transaction.get(listingRef);
    if (!listing.exists()) return "missing_listing";
    // Avoid a redundant write; retries remain safe when another device has synced.
    const publicExpiry = listing.data()?.mapSubscriptionExpiresAt;
    if (!(publicExpiry instanceof Timestamp) || !publicExpiry.isEqual(expiry)) {
      transaction.update(listingRef, { mapSubscriptionExpiresAt: expiry });
    }
    return "synced";
  });
}

export async function simulateDemoSubscriptionActivation(planId: DemoSubscriptionPlanId): Promise<Date> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to activate a demo subscription.");
  const plan = DEMO_SUBSCRIPTION_PLANS[planId];
  if (!plan) throw new Error("Choose a valid demo plan.");

  const accountRef = doc(db, "users", user.uid);
  const listingRef = doc(db, "providerListings", user.uid);
  const transactionRef = doc(collection(db, "users", user.uid, "demoSubscriptionTransactions"));
  const expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);
  let existingListing = false;
  await runTransaction(db, async transaction => {
    const account = await transaction.get(accountRef);
    if (!account.exists()) throw new Error("Your account profile could not be found.");
    const listing = await transaction.get(listingRef);
    existingListing = listing.exists();
    const previousData = account.data()?.subscription;
    const previous = parseDemoSubscription(account.data());
    if (previous && previous.expiresAt.getTime() > Date.now()) {
      throw new Error("A demo subscription is already active. You can renew after it expires.");
    }
    const type = previousData ? "renewal" : "activation";
    transaction.update(accountRef, {
      subscription: {
        status: "active",
        plan: plan.id,
        demoAmount: plan.amount,
        startedAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        lastTransactionId: transactionRef.id,
      },
    });
    transaction.set(transactionRef, {
      providerId: user.uid,
      transactionId: transactionRef.id,
      plan: plan.id,
      demoAmount: plan.amount,
      durationDays: plan.durationDays,
      type,
      startedAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: serverTimestamp(),
      label: "demo_only",
    });
  });
  // Keep the public map projection separate from the private activation
  // transaction. Rules validate it against the committed private expiry.
  if (existingListing) {
    try {
      await updateDoc(listingRef, { mapSubscriptionExpiresAt: Timestamp.fromDate(expiresAt) });
    } catch {
      // Activation and history already committed. Report a recoverable sync
      // failure instead of encouraging a second payment/activation attempt.
      throw new DemoSubscriptionMapSyncError(expiresAt);
    }
  }
  return expiresAt;
}
