import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { OwnerVerificationProfile } from "../types/ownerVerificationProfile";
import { db } from "./firebase";

const ownerVerificationProfileRef = (uid: string) =>
  doc(db, "users", uid, "ownerProfile", "profile");

export async function getOwnerVerificationProfile(
  uid: string
): Promise<OwnerVerificationProfile | null> {
  const snapshot = await getDoc(ownerVerificationProfileRef(uid));
  return snapshot.exists() ? (snapshot.data() as OwnerVerificationProfile) : null;
}

export async function requireVerifiedOwner(uid: string): Promise<void> {
  const profile = await getOwnerVerificationProfile(uid);
  if (profile?.uid !== uid || profile.role !== "owner" || profile.verificationStatus !== "VERIFIED") {
    throw new Error("Complete owner verification and wait for approval before booking a service.");
  }
}

export async function saveOwnerVerificationProfile(
  uid: string,
  profile: OwnerVerificationProfile
): Promise<void> {
  await setDoc(ownerVerificationProfileRef(uid), {
    ...profile,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateOwnerContactDetails(
  uid: string,
  personal: Pick<OwnerVerificationProfile["personal"], "fullName" | "phone" | "address" | "cityMunicipality">
): Promise<void> {
  await updateDoc(ownerVerificationProfileRef(uid), {
    "personal.fullName": personal.fullName,
    "personal.phone": personal.phone,
    "personal.address": personal.address,
    "personal.cityMunicipality": personal.cityMunicipality,
    updatedAt: serverTimestamp(),
  });
}
