import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
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

/** Updates only the company and service details exposed by the profile editor. */
export async function updateTowingCompanyProfileDetails(
  uid: string,
  profile: TowingCompanyProfile
): Promise<void> {
  await updateDoc(towingCompanyProfileRef(uid), {
    company: profile.company,
    services: profile.services,
    "representative.fullName": profile.representative.fullName,
    updatedAt: serverTimestamp(),
  });
}
