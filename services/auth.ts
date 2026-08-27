import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type {
  ProviderProfile,
  ProviderRole,
  UserProfile,
  UserRole,
} from "../types/user";
import { auth, db } from "./firebase";

type LegacyProviderRole = Exclude<ProviderRole, "onsite-mechanic">;

/**
 * Friendly messages for the Firebase Auth error codes you'll actually hit
 * with email/password sign-in. Falls back to the raw message for anything
 * unmapped so nothing is silently swallowed.
 */
function mapAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";

  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-email":
      return "That email address doesn't look valid.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return (error as { message?: string })?.message ?? "Something went wrong. Please try again.";
  }
}

/** Thrown by the functions below so screens can show `error.message` directly. */
export class AuthServiceError extends Error {
  code?: string;
  constructor(error: unknown) {
    super(mapAuthError(error));
    this.name = "AuthServiceError";
    this.code = (error as { code?: string })?.code;
  }
}

export interface RegisterParams {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

/**
 * Business-facing defaults for a brand-new providers/{uid} doc. Signup
 * only collects the role — everything else here is a placeholder meant
 * to be filled in later via a Provider Setup screen.
 */
function buildDefaultProviderProfile(uid: string, role: LegacyProviderRole): ProviderProfile {
  const businessNameByRole: Record<LegacyProviderRole, string> = {
    "shop-owner": "Unnamed Auto Shop",
    "towing-company": "Unnamed Towing Service",
  };

  // Matches each dashboard's own vocabulary: mechanic/towing show an
  // online/offline toggle, shop-owner shows open/closed.
  const defaultStatusByRole: Record<LegacyProviderRole, string> = {
    "shop-owner": "closed",
    "towing-company": "offline",
  };

  return {
    uid,
    role,
    businessName: businessNameByRole[role],
    phone: "",
    address: "",
    latitude: 0,
    longitude: 0,
    rating: 0,
    verified: false,
    status: defaultStatusByRole[role],
  };
}

/**
 * Creates a Firebase Auth user, sets their displayName, and writes the
 * matching profile doc (with role) to Firestore. Returns the new profile.
 *
 * When role is one of the three provider roles, also creates a
 * providers/{uid} doc with sensible defaults for business info — full
 * details are collected later, not during signup.
 */
export async function register({
  email,
  password,
  displayName,
  role,
}: RegisterParams): Promise<UserProfile> {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });

    const profile: UserProfile = {
      uid: credential.user.uid,
      email,
      displayName,
      role,
      createdAt: Date.now(),
    };

    await setDoc(doc(db, "users", credential.user.uid), {
      ...profile,
      createdAt: serverTimestamp(),
    });

    if (role === "shop-owner" || role === "towing-company") {
      const providerProfile = buildDefaultProviderProfile(credential.user.uid, role);
      await setDoc(doc(db, "providers", credential.user.uid), providerProfile);
    }

    return profile;
  } catch (error) {
    throw new AuthServiceError(error);
  }
}

export async function login(email: string, password: string): Promise<User> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    throw new AuthServiceError(error);
  }
}

export async function logout(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    throw new AuthServiceError(error);
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw new AuthServiceError(error);
  }
}

/** Fetches the Firestore profile (role, displayName, etc.) for a signed-in user. */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

/**
 * Fetches the Firestore provider business profile for a signed-in provider.
 * Returns null if the account has no providers/{uid} doc — e.g. a
 * non-provider user, or a provider record that failed to write during
 * registration.
 */
export async function getProviderProfile(uid: string): Promise<ProviderProfile | null> {
  const snap = await getDoc(doc(db, "providers", uid));
  if (!snap.exists()) return null;
  return snap.data() as ProviderProfile;
}

/** Restores the provider document for accounts created before provider setup was reliable. */
export async function ensureProviderProfile(uid: string): Promise<ProviderProfile | null> {
  const existingProfile = await getProviderProfile(uid);
  if (existingProfile) return existingProfile;

  const userProfile = await getUserProfile(uid);
  if (
    !userProfile ||
    (userProfile.role !== "shop-owner" && userProfile.role !== "towing-company")
  ) {
    return null;
  }

  const providerProfile = buildDefaultProviderProfile(uid, userProfile.role);
  await setDoc(doc(db, "providers", uid), providerProfile);
  return providerProfile;
}

/**
 * Maps a role to its dashboard route group. This is the single source of
 * truth for role -> route — both the login screen and the root auth gate
 * should call this instead of hardcoding paths.
 *
 * Returns null for a role that doesn't match any known dashboard, so
 * callers can show an error instead of navigating somewhere broken.
 */
export function getDashboardRoute(role: UserRole | undefined | null): string | null {
  switch (role) {
    case "owner":
      return "/(v_owner)";
    case "onsite-mechanic":
      return "/(onsite-mechanic)";
    case "shop-owner":
      return "/(shop-owner)";
    case "towing-company":
      return "/(towing-company)";
    case "admin":
      return "/(admin)";
    default:
      return null;
  }
}
