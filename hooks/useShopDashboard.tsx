import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ensureProviderProfile } from "../services/auth";
import { subscribeToShopProfile, subscribeToShopRequests } from "../services/shopOwnerService";
import type { ShopBookingRequest } from "../types/shopBooking";
import type { ProviderProfile, UserProfile } from "../types/user";

interface ShopDashboardData {
  account: UserProfile;
  profile: ProviderProfile | null;
  requests: ShopBookingRequest[];
  profileLoading: boolean;
  requestsLoading: boolean;
  profileError: string | null;
  requestsError: string | null;
  retry: () => void;
}

const ShopContext = createContext<ShopDashboardData | null>(null);

/** One live subscription per resource, shared by all shop tabs. */
export function ShopDashboardProvider({ account, children }: { account: UserProfile; children: ReactNode }) {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [requests, setRequests] = useState<ShopBookingRequest[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    let stopProfile: (() => void) | undefined;
    setProfileLoading(true);
    setRequestsLoading(true);
    setProfileError(null);
    setRequestsError(null);
    const stopRequests = subscribeToShopRequests((items) => {
      if (!alive) return;
      setRequests(items);
      setRequestsLoading(false);
    }, () => {
      if (!alive) return;
      setRequestsError("We couldn't load your services. Check your connection and try again.");
      setRequestsLoading(false);
    });
    void ensureProviderProfile(account.uid).then(() => {
      if (!alive) return;
      stopProfile = subscribeToShopProfile((value) => {
        if (!alive) return;
        setProfile(value);
        setProfileError(value ? null : "Your shop profile is missing. Try again to restore it.");
        setProfileLoading(false);
      }, (error) => {
        if (!alive) return;
        setProfileError(error.message);
        setProfileLoading(false);
      });
    }).catch(() => {
      if (!alive) return;
      setProfileError("We couldn't load your shop profile. Please try again.");
      setProfileLoading(false);
    });
    return () => { alive = false; stopRequests(); stopProfile?.(); };
  }, [account.uid, attempt]);

  return <ShopContext.Provider value={{ account, profile, requests, profileLoading, requestsLoading,
    profileError, requestsError, retry: () => setAttempt((value) => value + 1) }}>{children}</ShopContext.Provider>;
}

export function useShopDashboard() {
  const value = useContext(ShopContext);
  if (!value) throw new Error("Shop dashboard screens must be inside their provider layout.");
  return value;
}
