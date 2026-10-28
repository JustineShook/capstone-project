import {
  collection, doc, onSnapshot, orderBy, query, serverTimestamp,
  type Transaction, Timestamp, updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export interface ShopNotification {
  id: string;
  bookingId: string;
  customerName: string;
  vehicle: string;
  problem: string;
  status: string;
  title: string;
  message: string;
  isRead: boolean;
  updatedAt: string;
}

interface ShopNotificationInput {
  bookingId: string;
  providerId: string;
  customerId: string;
  customerName: string;
  vehicle: string;
  problem: string;
  status: string;
  event: "new_request" | "provider_status" | "customer_cancelled";
  reason?: string;
}

const LABELS: Record<string, string> = {
  pending: "Pending", accepted: "Accepted", vehicle_arrived: "Vehicle Arrived",
  diagnosing: "Diagnosing", repairing: "Repairing", completed: "Completed", rejected: "Rejected", cancelled: "Cancelled",
};

export function writeShopNotification(transaction: Transaction, input: ShopNotificationInput) {
  const isNew = input.event === "new_request";
  const cancelled = input.event === "customer_cancelled";
  transaction.set(doc(db, "users", input.providerId, "shopNotifications", input.bookingId), {
    bookingId: input.bookingId,
    providerId: input.providerId,
    customerId: input.customerId,
    customerName: input.customerName,
    vehicle: input.vehicle,
    problem: input.problem,
    status: input.status,
    title: isNew ? "New auto shop request" : cancelled ? "Customer cancelled request" : "Request status updated",
    message: isNew
      ? `${input.customerName} requested service for ${input.vehicle}.`
      : cancelled ? `${input.customerName} cancelled the request for ${input.vehicle}. Reason: ${input.reason ?? ""}` : `The service for ${input.vehicle} is now ${LABELS[input.status] ?? input.status}.`,
    isRead: !isNew && !cancelled,
    readAt: !isNew && !cancelled ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function toIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export function subscribeToShopNotifications(onChange: (items: ShopNotification[]) => void, onError?: (error: Error) => void) {
  const user = auth.currentUser;
  if (!user) { onChange([]); return () => undefined; }
  return onSnapshot(query(collection(db, "users", user.uid, "shopNotifications"), orderBy("updatedAt", "desc")),
    (snapshot) => onChange(snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id, bookingId: data.bookingId as string, customerName: data.customerName as string,
        vehicle: data.vehicle as string, problem: data.problem as string, status: data.status as string,
        title: data.title as string, message: data.message as string, isRead: data.isRead === true,
        updatedAt: toIso(data.updatedAt),
      };
    })), (error) => onError?.(error));
}

export async function markShopNotificationRead(notificationId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to view notifications.");
  await updateDoc(doc(db, "users", user.uid, "shopNotifications", notificationId), {
    isRead: true, readAt: serverTimestamp(),
  });
}
