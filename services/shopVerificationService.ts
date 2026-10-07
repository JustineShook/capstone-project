import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { ShopVerificationProfile } from "../types/shopVerificationProfile";
const ref = (uid: string) => doc(db, "users", uid, "shopVerification", "profile");
export async function getShopVerificationProfile(uid: string) { const snapshot = await getDoc(ref(uid)); return snapshot.exists() ? snapshot.data() as ShopVerificationProfile : null; }
export async function saveShopVerificationProfile(uid: string, profile: ShopVerificationProfile) { await setDoc(ref(uid), { ...profile, submittedAt: serverTimestamp(), updatedAt: serverTimestamp() }); }

/**
 * Projects the administrator-approved verification details into the existing
 * provider profile used by the shop dashboard and public-listing system.
 * Firestore rules allow this only when the private verification is VERIFIED
 * and every projected value exactly matches that approved submission.
 */
export async function syncApprovedShopProviderProfile(uid: string, verification: ShopVerificationProfile): Promise<void> {
  if (verification.uid !== uid || verification.role !== "shop-owner" || verification.verificationStatus !== "VERIFIED") {
    throw new Error("An administrator-approved Auto Shop verification is required.");
  }
  await updateDoc(doc(db, "providers", uid), {
    businessName: verification.business.name,
    phone: verification.business.phone,
    address: verification.business.address,
    latitude: verification.business.latitude,
    longitude: verification.business.longitude,
    verified: true,
  });
}
