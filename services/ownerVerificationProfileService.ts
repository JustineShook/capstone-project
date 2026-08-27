import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
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
