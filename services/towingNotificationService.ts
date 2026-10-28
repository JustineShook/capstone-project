import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Transaction,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export interface TowingNotification {
  id: string;
  bookingId: string;
  customerName: string;
  vehicle: string;
  pickupLocation: string;
  destination: string;
  status: string;
  title: string;
  message: string;
  isRead: boolean;
  updatedAt: string;
}

interface TowingNotificationInput {
  bookingId: string;
  providerId: string;
  customerId: string;
  customerName: string;
  vehicle: string;
  pickupLocation: string;
  destination: string;
  status: string;
  event: "new_request" | "provider_status" | "customer_cancelled";
  reason?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  en_route: "On the Way",
  arrived: "Arrived",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function writeTowingNotification(transaction: Transaction, input: TowingNotificationInput): void {
  const title = input.event === "new_request"
    ? "New towing request"
    : input.event === "customer_cancelled"
      ? "Customer cancelled request"
      : "Request status updated";
  const message = input.event === "new_request"
    ? `${input.customerName} requested a tow for ${input.vehicle}.`
    : input.event === "customer_cancelled"
      ? `${input.customerName} cancelled the towing request for ${input.vehicle}. Reason: ${input.reason ?? ""}`
      : `The towing request for ${input.vehicle} is now ${STATUS_LABELS[input.status] ?? input.status}.`;
  const isRead = input.event === "provider_status";

  transaction.set(doc(db, "users", input.providerId, "towingNotifications", input.bookingId), {
    bookingId: input.bookingId,
    providerId: input.providerId,
    customerId: input.customerId,
    customerName: input.customerName,
    vehicle: input.vehicle,
    pickupLocation: input.pickupLocation,
    destination: input.destination,
    status: input.status,
    title,
    message,
    isRead,
    readAt: isRead ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export function subscribeToTowingNotifications(
  onChange: (items: TowingNotification[]) => void,
  onError?: (error: Error) => void,
) {
  const user = auth.currentUser;
  if (!user) {
    onChange([]);
    return () => undefined;
  }
  const notificationsQuery = query(
    collection(db, "users", user.uid, "towingNotifications"),
    orderBy("updatedAt", "desc"),
  );
  return onSnapshot(
    notificationsQuery,
    (snapshot) => onChange(snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        bookingId: data.bookingId as string,
        customerName: data.customerName as string,
        vehicle: data.vehicle as string,
        pickupLocation: data.pickupLocation as string,
        destination: data.destination as string,
        status: data.status as string,
        title: data.title as string,
        message: data.message as string,
        isRead: data.isRead === true,
        updatedAt: toIso(data.updatedAt),
      };
    })),
    (error) => onError?.(error),
  );
}

export async function markTowingNotificationRead(notificationId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to view notifications.");
  await updateDoc(doc(db, "users", user.uid, "towingNotifications", notificationId), {
    isRead: true,
    readAt: serverTimestamp(),
  });
}
