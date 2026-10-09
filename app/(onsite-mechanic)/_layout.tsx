// app/(onsite-mechanic)/_layout.tsx
import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const COLORS = {
  background: "#090A0C",
  active: "#F51F3B",
  inactive: "#9AA6AE",
};

export default function OnsiteMechanicLayout() {
  return (
    

    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: 9,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="verification"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen name="public-listing" options={{ href: null }} />
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
          title: "Bookings",
          tabBarIcon: ({ color, size }) => (
            <Feather name="clipboard" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="service-history" options={{ href: null }} />
      <Tabs.Screen name="earnings" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Feather name="clock" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size ?? 20} color={color} />
          ),
        }}
      />

      {/* Hidden from the tab bar, but still reachable via router.push */}
      <Tabs.Screen
        name="request-details"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
