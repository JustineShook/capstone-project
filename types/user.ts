// types/user.ts

/**
 * Flat, top-level roles. Each one maps 1:1 to a dashboard route group:
 *   owner            -> app/(v_owner)
 *   onsite-mechanic  -> app/(onsite-mechanic)
 *   shop-owner       -> app/(shop-owner)
 *   towing-company   -> app/(towing-company)
 *   homegarage       -> app/(homegarage)
 *   admin            -> app/(admin)
 *
 * "admin" is not offered at registration — assign it manually in Firestore
 * for staff accounts.
 */
export type UserRole =
  | "owner"
  | "onsite-mechanic"
  | "shop-owner"
  | "towing-company"
  | "homegarage"
  | "admin";

/** Roles a user can pick for themselves during signup. */
export const REGISTERABLE_ROLES: UserRole[] = [
  "owner",
  "onsite-mechanic",
  "shop-owner",
  "towing-company",
  "homegarage",
];

/** The three roles that also get a providers/{uid} business-profile doc. */
export type ProviderRole = "onsite-mechanic" | "shop-owner" | "towing-company" | "homegarage";

export function isProviderRole(role: UserRole): role is ProviderRole {
  return role === "onsite-mechanic" || role === "shop-owner" || role === "towing-company" || role === "homegarage";
}

/**
 * App-level user profile, stored in Firestore at users/{uid}.
 * Firebase Auth only knows email/uid — `role` here is what the router
 * reads to decide which dashboard group to send the user to.
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number; // Date.now() at creation time
}

/**
 * Provider-specific business profile, stored separately at providers/{uid}
 * (not merged into users/{uid}) so business data doesn't bloat the general
 * user doc. Created at registration time with placeholder values — meant
 * to be filled in later via a Provider Setup screen.
 */
export interface ProviderProfile {
  uid: string;
  role: ProviderRole;
  businessName: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  verified: boolean;
  status: string;
}
