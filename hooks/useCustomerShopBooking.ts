import { useEffect, useState } from "react";
import { subscribeToMyShopBooking } from "../services/shopOwnerService";
import type { ShopBookingRequest } from "../types/shopBooking";

export function useCustomerShopBooking(id: string | undefined) {
  const [booking, setBooking] = useState<ShopBookingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setBooking(null); setError(null); setLoading(true);
    if (!id) { setLoading(false); return; }
    try {
      return subscribeToMyShopBooking(id, (value) => { setBooking(value); setLoading(false); }, () => {
        setError("Unable to load this request. Check your connection and try again."); setLoading(false);
      });
    } catch (cause) { setError((cause as Error).message); setLoading(false); }
  }, [id, attempt]);
  return { booking, loading, error, retry: () => setAttempt((value) => value + 1) };
}
