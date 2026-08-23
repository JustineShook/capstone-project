// app/index.tsx
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { getDashboardRoute } from "../services/auth";

export default function Index() {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Signed in but the Firestore profile hasn't loaded/exists yet — send to
  // login rather than risk a route with no role to key off. This can happen
  // if a Firestore write failed after Auth account creation.
  const route = getDashboardRoute(userProfile?.role);
  if (!route) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href={route as any} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
});