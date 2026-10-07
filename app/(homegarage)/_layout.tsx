import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../hooks/useAuth";

const C = { bg: "#10191F", active: "#F51F3B", inactive: "#9AA6AE" };

export default function HomeGarageLayout() {
  const { user, userProfile, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.active} /></View>;
  if (!user || !userProfile) return <Redirect href="/(auth)/login" />;
  if (userProfile.role !== "homegarage") return <Redirect href="/" />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: C.active, tabBarInactiveTintColor: C.inactive, tabBarStyle: { backgroundColor: C.bg, borderTopWidth: 0, height: 64, paddingTop: 8, paddingBottom: 9 }, tabBarLabelStyle: { fontSize: 12, fontWeight: "600" } }}>
    <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" size={size ?? 20} color={color} /> }} />
    <Tabs.Screen name="parking-sessions" options={{ title: "Bookings", tabBarIcon: ({ color, size }) => <Feather name="clipboard" size={size ?? 20} color={color} /> }} />
    <Tabs.Screen name="requests" options={{ href: null }} />
    <Tabs.Screen name="parking-session-detail" options={{ href: null }} />
    <Tabs.Screen name="earnings" options={{ title: "Earnings", tabBarIcon: ({ color, size }) => <Feather name="dollar-sign" size={size ?? 20} color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" size={size ?? 20} color={color} /> }} />
    <Tabs.Screen name="public-listing" options={{ href: null }} />
    <Tabs.Screen name="verification" options={{ href: null }} />
  </Tabs>;
}
