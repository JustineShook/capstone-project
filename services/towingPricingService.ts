import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";

import type { TowingPricingConfig, TowingPricingConfigInput } from "../types/towingPricing";
import { auth, db } from "./firebase";

const pricingDocument = (uid: string) => doc(db, "users", uid, "towingPricing", "config");

function requireUserId() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to manage towing pricing.");
  return uid;
}

function iso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : undefined;
}

function validateInput(input: TowingPricingConfigInput) {
  if (![input.basePrice, input.pricePerKm].every(Number.isFinite)) {
    throw new Error("Base price and price per kilometer must be valid numbers.");
  }
  if (input.basePrice < 0 || input.basePrice > 1_000_000 || input.pricePerKm < 0 || input.pricePerKm > 100_000) {
    throw new Error("Base price or price per kilometer is outside the allowed range.");
  }
}

export async function getTowingPricing(providerId: string): Promise<TowingPricingConfig | null> {
  if (!auth.currentUser) throw new Error("You must be signed in to view towing pricing.");
  const snapshot = await getDoc(pricingDocument(providerId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return { basePrice: data.basePrice, pricePerKm: data.pricePerKm, createdAt: iso(data.createdAt), updatedAt: iso(data.updatedAt) };
}

export async function saveTowingPricing(input: TowingPricingConfigInput) {
  const uid = requireUserId();
  validateInput(input);
  const reference = pricingDocument(uid);
  const existing = await getDoc(reference);
  if (existing.exists()) {
    await updateDoc(reference, { ...input, updatedAt: serverTimestamp() });
    return;
  }
  await setDoc(reference, { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
