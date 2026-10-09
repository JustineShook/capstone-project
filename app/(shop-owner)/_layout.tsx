import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { ShopDashboardProvider } from "../../hooks/useShopDashboard";

export default function ShopOwnerLayout() {
  const { user, userProfile, loading } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color="#F51F3B" /></View>;
  if (!user || !userProfile) return <Redirect href="/(auth)/login" />;
  if (userProfile.role !== "shop-owner") return <Redirect href="/" />;

  return <ShopDashboardProvider key={user.uid} account={userProfile}>
    <Tabs backBehavior="history" screenOptions={{
      headerShown: false, tabBarActiveTintColor: "#F51F3B", tabBarInactiveTintColor: "#9AA6AE",
      tabBarStyle: { backgroundColor: "#090A0C", borderTopWidth: 1, borderTopColor: "#252629", paddingTop: 5, paddingBottom: Math.max(insets.bottom, 4), height: 49 + Math.max(insets.bottom, 8) },
      tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
    }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="requests" options={{ title: "Requests", tabBarIcon: ({ color, size }) => <Feather name="clipboard" color={color} size={size} /> }} />
      <Tabs.Screen name="service-history" options={{ title: "History", tabBarIcon: ({ color, size }) => <Feather name="clock" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }} />
      <Tabs.Screen name="request-details" options={{ href: null }} />
      <Tabs.Screen name="active-service" options={{ href: null }} />
      <Tabs.Screen name="verification" options={{ href: null }} />
      <Tabs.Screen name="public-listing" options={{ href: null }} />
      <Tabs.Screen name="earnings" options={{ href: null }} />
    </Tabs>
  </ShopDashboardProvider>;
}
