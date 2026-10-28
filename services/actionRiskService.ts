import { collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { auth, db } from "./firebase";

export type RiskAction = "owner_cancel_after_acceptance" | "provider_decline";
export type RiskActor = "owner" | "provider";

function eventMillis(value: unknown): number | null {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return (value.toMillis as () => number)();
  }
  return null;
}

/** Watches this account's unique booking records and counts qualifying events in the rolling window. */
export function subscribeToMyActionRiskCount(
  actor: RiskActor,
  onChange: (count: number) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to load your account activity.");
  const actorField = actor === "owner" ? "customerId" : "providerId";
  const eventType: RiskAction = actor === "owner" ? "owner_cancel_after_acceptance" : "provider_decline";
  let active = true;
  let timer: ReturnType<typeof setInterval> | undefined;
  const subscription = onSnapshot(
    query(collection(db, "bookings"), where(actorField, "==", user.uid), where("riskEventType", "==", eventType)),
    (snapshot) => {
      if (!active) return;
      const updateCount = () => {
        if (!active) return;
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        onChange(snapshot.docs.filter((booking) => {
          const at = eventMillis(booking.data().riskEventAt);
          return at !== null && at >= cutoff && at <= Date.now();
        }).length);
      };
      updateCount();
      if (timer) clearInterval(timer);
      timer = setInterval(updateCount, 60_000);
    },
    onError,
  );
  return () => {
    active = false;
    if (timer) clearInterval(timer);
    subscription();
  };
}
