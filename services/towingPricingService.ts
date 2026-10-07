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
  if (input.pricingMode !== "fixed" && input.pricingMode !== "dispatcher") throw new Error("Choose a valid pricing method.");
  if (input.pricingMode === "dispatcher" && !input.dispatcherPhone.trim()) throw new Error("Enter the dispatcher contact number.");
}

export async function getTowingPricing(providerId: string): Promise<TowingPricingConfig | null> {
  if (!auth.currentUser) throw new Error("You must be signed in to view towing pricing.");
  const snapshot = await getDoc(pricingDocument(providerId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return { basePrice: data.basePrice, pricePerKm: data.pricePerKm, pricingMode: data.pricingMode === "dispatcher" ? "dispatcher" : "fixed", dispatcherPhone: typeof data.dispatcherPhone === "string" ? data.dispatcherPhone : "", createdAt: iso(data.createdAt), updatedAt: iso(data.updatedAt) };
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
