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

export interface MechanicNotification {
  id: string;
  bookingId: string;
  customerName: string;
  vehicle: string;
  status: string;
  title: string;
  message: string;
  isRead: boolean;
  updatedAt: string;
}

interface MechanicNotificationInput {
  bookingId: string;
  providerId: string;
  customerId: string;
  customerName: string;
  vehicle: string;
  status: string;
  event: "new_request" | "provider_status" | "customer_cancelled";
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  en_route: "On The Way",
  arrived: "Arrived",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Creates or refreshes the mechanic's single notification for this booking. */
export function writeMechanicNotification(
  transaction: Transaction,
  input: MechanicNotificationInput,
): void {
  const title = input.event === "new_request"
    ? "New service request"
    : input.event === "customer_cancelled"
      ? "Customer cancelled request"
      : "Request status updated";
  const message = input.event === "new_request"
    ? `${input.customerName} requested service for ${input.vehicle}.`
    : input.event === "customer_cancelled"
      ? `${input.customerName} cancelled the request for ${input.vehicle}.`
      : `The request for ${input.vehicle} is now ${STATUS_LABELS[input.status] ?? input.status}.`;
  const isRead = input.event === "provider_status";

  transaction.set(doc(db, "users", input.providerId, "mechanicNotifications", input.bookingId), {
    bookingId: input.bookingId,
    providerId: input.providerId,
    customerId: input.customerId,
    customerName: input.customerName,
    vehicle: input.vehicle,
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

export function subscribeToMechanicNotifications(
  onChange: (items: MechanicNotification[]) => void,
  onError?: (error: Error) => void,
) {
  const user = auth.currentUser;
  if (!user) {
    onChange([]);
    return () => undefined;
  }
  const notificationsQuery = query(
    collection(db, "users", user.uid, "mechanicNotifications"),
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

export async function markMechanicNotificationRead(notificationId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to view notifications.");
  await updateDoc(doc(db, "users", user.uid, "mechanicNotifications", notificationId), {
    isRead: true,
    readAt: serverTimestamp(),
  });
}
