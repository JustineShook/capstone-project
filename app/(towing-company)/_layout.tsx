// app/(towing-company)/_layout.tsx
import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const COLORS = {
  primary: "#D32F2F",
  activeOnRed: "#FFFFFF",
  inactiveOnRed: "rgba(255, 255, 255, 0.65)",
};

export default function TowingCompanyLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.activeOnRed,
        tabBarInactiveTintColor: COLORS.inactiveOnRed,
        tabBarStyle: {
          backgroundColor: COLORS.primary,
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: 10,
          height: 58,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          tabBarIcon: ({ color, size }) => (
            <Feather name="file-text" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="towing-history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Feather name="clock" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size ?? 20} color={color} />
          ),
        }}
      />

      {/* Hidden from the tab bar, but still reachable via router.push */}
      <Tabs.Screen
        name="verification"
        options={{ href: null }}
      />
      <Tabs.Screen name="public-listing" options={{ href: null }} />
      <Tabs.Screen name="towing-pricing" options={{ href: null }} />
      <Tabs.Screen
        name="request-details"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
