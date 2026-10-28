import {
  collection,
  doc,
  onSnapshot,
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
  reason?: string;
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
      ? `${input.customerName} cancelled the request for ${input.vehicle}. Reason: ${input.reason ?? ""}`
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
  // Sort locally so notifications created before updatedAt was added remain
  // visible and the listener does not depend on an ordered-field index.
  const notificationsQuery = query(
    collection(db, "users", user.uid, "mechanicNotifications"),
  );
  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          bookingId: typeof data.bookingId === "string" ? data.bookingId : item.id,
          customerName: typeof data.customerName === "string" ? data.customerName : "Customer",
          vehicle: typeof data.vehicle === "string" ? data.vehicle : "Vehicle",
          status: typeof data.status === "string" ? data.status : "pending",
          title: typeof data.title === "string" ? data.title : "Service request update",
          message: typeof data.message === "string" ? data.message : "You have an update about a service request.",
          isRead: data.isRead === true,
          updatedAt: toIso(data.updatedAt ?? data.createdAt),
        };
      });
      notifications.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      onChange(notifications);
    },
    (error) => {
      console.error("Mechanic notifications listener failed", { code: error.code, message: error.message });
      onError?.(error);
    },
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
