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

export type CustomerNotificationBookingType = "onsite-mechanic" | "towing-company" | "shop-owner";

export interface CustomerNotification {
  id: string;
  bookingId: string;
  bookingType: CustomerNotificationBookingType;
  providerName: string;
  status: string;
  title: string;
  message: string;
  isRead: boolean;
  updatedAt: string;
}

interface BookingStatusNotificationInput {
  bookingId: string;
  customerId: string;
  bookingType: CustomerNotificationBookingType;
  providerId: string;
  providerName: string;
  status: string;
  message?: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  accepted: "accepted your request.",
  rejected: "could not accept your request.",
  en_route: "is on the way to you.",
  arrived: "has arrived at your location.",
  in_progress: "started working on your service.",
  completed: "completed your service request.",
  cancelled: "cancelled your request.",
  vehicle_arrived: "marked your vehicle as arrived at the shop.",
  diagnosing: "started diagnosing your vehicle.",
  repairing: "started repairing your vehicle.",
};

/** Creates or updates the single inbox item for a booking atomically with its status change. */
export function addBookingStatusNotification(
  transaction: Transaction,
  input: BookingStatusNotificationInput,
): void {
  const id = input.bookingId;
  const message = input.message ?? STATUS_MESSAGES[input.status] ?? `updated your request to ${input.status.replace(/_/g, " ")}.`;
  transaction.set(doc(db, "users", input.customerId, "notifications", id), {
    customerId: input.customerId,
    bookingId: input.bookingId,
    bookingType: input.bookingType,
    providerId: input.providerId,
    providerName: input.providerName,
    status: input.status,
    title: "Service request update",
    message: input.message ? message : `${input.providerName} ${message}`,
    isRead: false,
    readAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export function subscribeToCustomerNotifications(
  onChange: (items: CustomerNotification[]) => void,
  onError?: (error: Error) => void,
) {
  const user = auth.currentUser;
  if (!user) {
    onChange([]);
    return () => undefined;
  }
  const notificationsQuery = query(
    collection(db, "users", user.uid, "notifications"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const byBooking = new Map<string, CustomerNotification>();
      snapshot.docs.forEach((item) => {
        const data = item.data();
        const notification: CustomerNotification = {
          id: item.id,
          bookingId: data.bookingId as string,
          bookingType: data.bookingType as CustomerNotificationBookingType,
          providerName: data.providerName as string,
          status: data.status as string,
          title: data.title as string,
          message: data.message as string,
          isRead: data.isRead === true,
          updatedAt: toIso(data.updatedAt ?? data.createdAt),
        };
        const existing = byBooking.get(notification.bookingId);
        if (!existing || notification.updatedAt > existing.updatedAt) {
          byBooking.set(notification.bookingId, notification);
        }
      });
      onChange([...byBooking.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    },
    (error) => onError?.(error),
  );
}

export async function markCustomerNotificationRead(notificationId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to view notifications.");
  await updateDoc(doc(db, "users", user.uid, "notifications", notificationId), {
    isRead: true,
    readAt: serverTimestamp(),
  });
}
