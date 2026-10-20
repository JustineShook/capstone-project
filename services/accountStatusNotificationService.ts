import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export interface AccountStatusNotification {
  id: string;
  status: string;
  previousStatus: string | null;
  title: string;
  message: string;
  reason: string | null;
  isRead: boolean;
  updatedAt: string;
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export function subscribeToAccountStatusNotifications(
  onChange: (items: AccountStatusNotification[]) => void,
  onError?: (error: Error) => void,
) {
  const user = auth.currentUser;
  if (!user) {
    onChange([]);
    return () => undefined;
  }
  return onSnapshot(query(
    collection(db, "users", user.uid, "accountStatusNotifications"),
    orderBy("createdAt", "desc"),
  ), (snapshot) => onChange(snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      status: typeof data.status === "string" ? data.status : "unknown",
      previousStatus: typeof data.previousStatus === "string" ? data.previousStatus : null,
      title: typeof data.title === "string" ? data.title : "Account status updated",
      message: typeof data.message === "string" ? data.message : "Your provider account status changed.",
      reason: typeof data.reason === "string" ? data.reason : null,
      isRead: data.isRead === true,
      updatedAt: toIso(data.updatedAt ?? data.createdAt),
    };
  })), onError);
}

export async function markAccountStatusNotificationRead(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to view notifications.");
  await updateDoc(doc(db, "users", user.uid, "accountStatusNotifications", id), {
    isRead: true,
    readAt: serverTimestamp(),
  });
}
