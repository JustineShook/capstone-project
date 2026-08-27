import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { TowingCompanyProfile } from "../types/towingCompanyProfile";
import { db } from "./firebase";

const towingCompanyProfileRef = (uid: string) =>
  doc(db, "users", uid, "towingCompanyProfile", "profile");

export async function getTowingCompanyProfile(uid: string): Promise<TowingCompanyProfile | null> {
  const snapshot = await getDoc(towingCompanyProfileRef(uid));
  return snapshot.exists() ? (snapshot.data() as TowingCompanyProfile) : null;
}

export async function saveTowingCompanyProfile(
  uid: string,
  profile: TowingCompanyProfile
): Promise<void> {
  await setDoc(towingCompanyProfileRef(uid), {
    ...profile,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
