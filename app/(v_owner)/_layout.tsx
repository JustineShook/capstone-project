// app/(v_owner)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Link, Redirect, Tabs, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToCustomerNotifications } from "../../services/customerNotificationService";
import { useAuth } from "../../hooks/useAuth";

const colors = {
  primary: "#FFFFFF",
  inactive: "#D6E4FA",
  background: "#FFFFFF",
  border: "#D5DEE9",
};

export default function VOwnerLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const guest = !user;
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => user ? subscribeToCustomerNotifications(
    (items) => setUnreadNotificationCount(items.filter((item) => !item.isRead).length),
    () => setUnreadNotificationCount(0),
  ) : undefined, [user]);

  const ownerScreen = segments[1];
  if (loading) return null;
  if (guest && ownerScreen) return <Redirect href="/(v_owner)" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Tabs
      initialRouteName="index"
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: "#0F52BA",
          borderTopColor: "#0F52BA",
          borderTopWidth: 1,
          borderColor: "#0F52BA",
          borderWidth: 1,
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
      }}
    >
      <Tabs.Screen name="towing-booking/book-towing" options={{ href: null }} />
      <Tabs.Screen name="towing-booking/booking-confirmation" options={{ href: null }} />
      <Tabs.Screen name="towing-booking/booking-detail" options={{ href: null }} />
      <Tabs.Screen name="mechanic-booking/book-mechanic" options={{ href: null }} />
      <Tabs.Screen name="mechanic-booking/booking-confirmation" options={{ href: null }} />
      <Tabs.Screen name="mechanic-booking/booking-detail" options={{ href: null }} />
      <Tabs.Screen name="shop-booking" options={{ href: null }} />
      <Tabs.Screen name="homegarage-booking/book-homegarage" options={{ href: null }} />
      <Tabs.Screen name="homegarage-booking/booking-detail" options={{ href: null }} />
      <Tabs.Screen name="parking-booking/book-parking" options={{ href: null }} />
      <Tabs.Screen name="parking-booking/parking-detail" options={{ href: null }} />
      <Tabs.Screen name="personal-information" options={{ href: null }} />
      <Tabs.Screen name="verification" options={{ href: null }} />
      <Tabs.Screen name="vehicle-history" options={{ href: null }} />
      <Tabs.Screen name="provider-reviews" options={{ href: null }} />
      <Tabs.Screen name="help-support" options={{ href: null }} />
      <Tabs.Screen name="privacy-security" options={{ href: null }} />
      
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarButton: guest ? (props) => {
            const homeColor = props.accessibilityState?.selected ? colors.primary : colors.inactive;
            return (
              <View style={[props.style, { flexDirection: "row", alignItems: "stretch" }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Home"
                  accessibilityState={props.accessibilityState}
                  onPress={props.onPress}
                  onLongPress={props.onLongPress}
                  style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}
                >
                  <Ionicons name={props.accessibilityState?.selected ? "home" : "home-outline"} size={22} color={homeColor} />
                  <Text style={{ color: homeColor, fontSize: 11, fontWeight: "600" }}>Home</Text>
                </Pressable>
                <Link href="/(auth)/login" asChild>
                  <Pressable accessibilityRole="button" accessibilityLabel="Log In" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}>
                    <Ionicons name="log-in-outline" size={22} color={colors.inactive} />
                    <Text style={{ color: colors.inactive, fontSize: 11, fontWeight: "600" }}>Log In</Text>
                  </Pressable>
                </Link>
                <Link href="/(auth)/register" asChild>
                  <Pressable accessibilityRole="button" accessibilityLabel="Sign Up" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}>
                    <Ionicons name="person-add-outline" size={22} color={colors.inactive} />
                    <Text style={{ color: colors.inactive, fontSize: 11, fontWeight: "600" }}>Sign Up</Text>
                  </Pressable>
                </Link>
              </View>
            );
          } : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="vehicle"
        options={{
          href: guest ? null : undefined,
          title: "Vehicles",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "car-sport" : "car-sport-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          href: guest ? null : undefined,
          title: "History",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "time" : "time-outline"} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          href: guest ? null : undefined,
          title: "Notifications",
          tabBarBadge: unreadNotificationCount > 0
            ? unreadNotificationCount > 99 ? "99+" : unreadNotificationCount
            : undefined,
          tabBarBadgeStyle: { backgroundColor: "#FFFFFF", color: "#0F52BA" },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "notifications" : "notifications-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          href: guest ? null : undefined,
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person-circle" : "person-circle-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
    </View>
  );
}
