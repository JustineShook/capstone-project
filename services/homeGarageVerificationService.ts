import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "./firebase";
import type { HomeGarageVerificationProfile } from "../types/homeGarageVerificationProfile";

const profileRef = (uid: string) => doc(db, "users", uid, "homeGarageVerification", "profile");

export async function getHomeGarageVerificationProfile(uid: string): Promise<HomeGarageVerificationProfile | null> {
  const snapshot = await getDoc(profileRef(uid));
  return snapshot.exists() ? snapshot.data() as HomeGarageVerificationProfile : null;
}

export async function saveHomeGarageVerificationProfile(uid: string, profile: HomeGarageVerificationProfile): Promise<void> {
  await setDoc(profileRef(uid), { ...profile, submittedAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
