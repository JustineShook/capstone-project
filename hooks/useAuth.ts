// hooks/useAuth.ts
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { getUserProfile } from "../services/auth";
import { auth } from "../services/firebase";
import type { UserProfile } from "../types/user";

interface UseAuthResult {
  user: User | null;
  userProfile: UserProfile | null;
  /** True until the first Firebase Auth state check completes. */
  loading: boolean;
}

/**
 * Subscribes to Firebase Auth state and, when signed in, loads the matching
 * Firestore profile (which carries `role` for admin/owner/provider routing).
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          setUserProfile(profile);
        } catch {
          // Profile fetch failing shouldn't block auth state from resolving.
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, userProfile, loading };
}