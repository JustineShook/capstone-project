import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../../../constants/owner/theme";
import { useAuth } from "../../../hooks/useAuth";

export default function ShopBookingLayout() {
  const { user, userProfile, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;
  if (!user || !userProfile) return <Redirect href="/(auth)/login" />;
  if (userProfile.role !== "owner") return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
