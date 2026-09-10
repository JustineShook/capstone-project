import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";

import type { SavedVehicle, SavedVehicleInput } from "../../types/owner/vehicle";
import { auth, db } from "../firebase";

function requireUserId() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to manage vehicles.");
  return uid;
}

function asIso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString();
}

function clean(input: SavedVehicleInput): SavedVehicleInput {
  return {
    ...input,
    make: input.make.trim(),
    model: input.model.trim(),
    color: input.color.trim(),
    plateNumber: input.plateNumber.trim().toUpperCase(),
  };
}

export function subscribeToMyVehicles(callback: (vehicles: SavedVehicle[]) => void, onError: (error: Error) => void) {
  const uid = requireUserId();
  return onSnapshot(collection(db, "users", uid, "vehicles"), (snapshot) => {
    const vehicles = snapshot.docs.map((item) => {
      const data = item.data();
      return { ...data, vehicleId: item.id, createdAt: asIso(data.createdAt), updatedAt: asIso(data.updatedAt) } as SavedVehicle;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    callback(vehicles);
  }, (error) => onError(error));
}

export async function addVehicle(input: SavedVehicleInput) {
  const uid = requireUserId();
  const reference = doc(collection(db, "users", uid, "vehicles"));
  await setDoc(reference, { vehicleId: reference.id, ...clean(input), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return reference.id;
}

export async function updateVehicle(vehicleId: string, input: SavedVehicleInput) {
  const uid = requireUserId();
  await updateDoc(doc(db, "users", uid, "vehicles", vehicleId), { ...clean(input), updatedAt: serverTimestamp() });
}

export async function deleteVehicle(vehicleId: string) {
  const uid = requireUserId();
  await deleteDoc(doc(db, "users", uid, "vehicles", vehicleId));
}
