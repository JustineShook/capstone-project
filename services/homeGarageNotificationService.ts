import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, type Transaction, Timestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export interface HomeGarageNotification {
  id: string; bookingId: string; customerId: string; customerName: string; vehicle: string; problem: string;
  status: string; title: string; message: string; isRead: boolean; updatedAt: string;
}

interface Input {
  bookingId: string; providerId: string; customerId: string; customerName: string; vehicle: string; problem: string;
  status: string; event: "new_request" | "provider_update" | "customer_cancelled";
}

const labels: Record<string, string> = { pending: "Pending", accepted: "Accepted", vehicle_arrived: "Vehicle Arrived", diagnosing: "Diagnosing", repairing: "Repairing", rejected: "Declined", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled", assessed: "Price Assessed" };

export function writeHomeGarageProviderNotification(transaction: Transaction, input: Input) {
  const isNew = input.event === "new_request";
  const cancelled = input.event === "customer_cancelled";
  transaction.set(doc(db, "users", input.providerId, "homeGarageNotifications", input.bookingId), {
    bookingId: input.bookingId, providerId: input.providerId, customerId: input.customerId,
    customerName: input.customerName, vehicle: input.vehicle, problem: input.problem, status: input.status,
    title: isNew ? "New Home Garage request" : cancelled ? "Customer cancelled request" : "Request updated",
    message: isNew ? `${input.customerName} requested a repair for ${input.vehicle}.` : cancelled
      ? `${input.customerName} cancelled the repair request for ${input.vehicle}.`
      : `The repair for ${input.vehicle} is now ${labels[input.status] ?? input.status.replace(/_/g, " ")}.`,
    isRead: !isNew && !cancelled, readAt: !isNew && !cancelled ? serverTimestamp() : null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

function toIso(value: unknown) { return value instanceof Timestamp ? value.toDate().toISOString() : typeof value === "string" ? value : new Date().toISOString(); }

export function subscribeToHomeGarageNotifications(onChange: (items: HomeGarageNotification[]) => void, onError?: (error: Error) => void) {
  const user = auth.currentUser;
  if (!user) { onChange([]); return () => undefined; }
  return onSnapshot(query(collection(db, "users", user.uid, "homeGarageNotifications"), orderBy("updatedAt", "desc")),
    (snapshot) => onChange(snapshot.docs.map((item) => {
      const data = item.data();
      return { id: item.id, bookingId: data.bookingId as string, customerId: data.customerId as string,
        customerName: data.customerName as string, vehicle: data.vehicle as string, problem: data.problem as string,
        status: data.status as string, title: data.title as string, message: data.message as string,
        isRead: data.isRead === true, updatedAt: toIso(data.updatedAt) };
    })), (error) => onError?.(error));
}

export async function markHomeGarageNotificationRead(id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to view notifications.");
  await updateDoc(doc(db, "users", user.uid, "homeGarageNotifications", id), { isRead: true, readAt: serverTimestamp() });
}
