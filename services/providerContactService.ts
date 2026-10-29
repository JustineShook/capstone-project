import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const contactRef = (providerId: string) => doc(db, "providerContacts", providerId);

/** Reads only the provider's published contact number, never verification data. */
export async function getProviderContactPhone(providerId: string): Promise<string> {
  const snapshot = await getDoc(contactRef(providerId));
  const phone = snapshot.exists() ? snapshot.data().phone : "";
  return typeof phone === "string" ? phone : "";
}

/** Mirrors the number explicitly published in the provider listing form. */
export async function saveProviderContactPhone(providerId: string, phone: string): Promise<void> {
  const normalized = phone.trim();
  if (normalized) await setDoc(contactRef(providerId), { providerId, phone: normalized });
  else await deleteDoc(contactRef(providerId));
}
