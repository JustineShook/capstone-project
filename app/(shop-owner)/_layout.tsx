import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { ShopDashboardProvider } from "../../hooks/useShopDashboard";

export default function ShopOwnerLayout() {
  const { user, userProfile, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color="#0F52BA" /></View>;
  if (!user || !userProfile) return <Redirect href="/(auth)/login" />;
  if (userProfile.role !== "shop-owner") return <Redirect href="/" />;

  return <ShopDashboardProvider key={user.uid} account={userProfile}>
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
    <Tabs backBehavior="history" screenOptions={{
      headerShown: false, tabBarActiveTintColor: "#FFFFFF", tabBarInactiveTintColor: "#D6E4FA",
      tabBarStyle: {
          backgroundColor: "#0F52BA",
          borderColor: "#0F52BA",
          borderWidth: 1,
          borderTopWidth: 1,
          borderRadius: 22,
          marginLeft: Math.max(insets.left, width < 360 ? 8 : 16),
          marginRight: Math.max(insets.right, width < 360 ? 8 : 16),
          marginTop: 8,
          marginBottom: Math.max(insets.bottom, 12),
          height: 70,
          paddingTop: 8,
          paddingBottom: 8,
          shadowColor: "#172B4D",
          shadowOpacity: 0.1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        },
      tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
    }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "home" : "home-outline"} color={color} size={size} /> }} />
      <Tabs.Screen name="requests" options={{ title: "Requests", tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "clipboard" : "clipboard-outline"} color={color} size={size} /> }} />
      <Tabs.Screen name="service-history" options={{ title: "History", tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "time" : "time-outline"} color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "person-circle" : "person-circle-outline"} color={color} size={size} /> }} />
      <Tabs.Screen name="notifications" options={{ title: "Notifications", tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "notifications" : "notifications-outline"} color={color} size={size} /> }} />
      <Tabs.Screen name="request-details" options={{ href: null }} />
      <Tabs.Screen name="active-service" options={{ href: null }} />
      <Tabs.Screen name="verification" options={{ href: null }} />
      <Tabs.Screen name="public-listing" options={{ href: null }} />
      <Tabs.Screen name="earnings" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="account-updates" options={{ href: null }} />
    </Tabs>
    </View>
  </ShopDashboardProvider>;
}
