import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import { subscribeToShopNotifications } from "../../services/shopNotificationService";

export function ShopNotificationBell({ appearance = "default", style, size = 22, color = "#F5F2F0" }: { appearance?: "default" | "light"; style?: StyleProp<ViewStyle>; size?: number; color?: string }) {
  const s = appearance === "light" ? lightStyles : defaultStyles;
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  useEffect(() => subscribeToShopNotifications((items) => setUnread(items.filter((item) => !item.isRead).length), () => setUnread(0)), []);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
    onPress={() => router.push("/(shop-owner)/notifications")} style={[s.button, style]}>
    <Feather name="bell" size={size} color={color} />
    {unread > 0 && <View style={s.badge}><Text style={s.badgeText}>{unread > 99 ? "99+" : unread}</Text></View>}
  </TouchableOpacity>;
}

const s = StyleSheet.create({
  button: { position: "relative", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 0, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: "#F52239", alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#FFFFFF", fontSize: 10, lineHeight: 13, fontWeight: "900" },
});

const defaultStyles = s;
const lightStyles = StyleSheet.create({ ...defaultStyles, badge: { ...defaultStyles.badge, backgroundColor: "#FFFFFF" }, badgeText: { ...defaultStyles.badgeText, color: "#0F52BA" } });
