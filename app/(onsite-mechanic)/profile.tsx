// app/(onsite-mechanic)/profile.tsx
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../services/firebase";
import { getProviderProfile } from "../../services/providerProfileService";
import type { OnsiteMechanicProviderProfile, VerificationStatus } from "../../types/onsiteMechanicProfile";

const COLORS = {
  primary: "#D32F2F", primaryMuted: "#FCE8E8", background: "#FFFFFF",
  sectionBackground: "#F7F7F8", text: "#1A1A1A", textMuted: "#6B7280",
  border: "#E5E7EB", success: "#2E7D32", successMuted: "#E8F5E9",
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<OnsiteMechanicProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setProfile(null);
      setError("You need to sign in to view your mechanic profile.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProfile(await getProviderProfile(user.uid));
    } catch {
      setError("We couldn't load your profile. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadProfile(); }, [loadProfile]));

  const status: VerificationStatus = profile?.verificationStatus ?? "INCOMPLETE";
  const name = profile?.personal.fullName || auth.currentUser?.displayName || "Onsite Mechanic";
  const email = auth.currentUser?.email || "Email not available";
  const canVerify = status === "INCOMPLETE" || status === "REJECTED";

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => {
        signOut(auth).catch(() => Alert.alert("Error", "Could not log out. Please try again."));
      } },
    ]);
  };

  const openVerification = () => router.push("/(onsite-mechanic)/verification");

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}><Text style={styles.headerTitle}>Profile</Text></View>
      {loading ? (
        <View style={styles.stateWrap}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.stateText}>Loading profile…</Text></View>
      ) : error ? (
        <View style={styles.stateWrap}><Feather name="alert-circle" size={30} color={COLORS.primary} /><Text style={styles.stateText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => void loadProfile()}><Text style={styles.retryText}>Try Again</Text></TouchableOpacity></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.identityCard}>
            <View style={styles.avatar}><Feather name="user" size={26} color={COLORS.primary} /></View>
            <Text style={styles.name}>{name}</Text><Text style={styles.role}>Onsite Mechanic</Text>
            {status === "VERIFIED" ? (
              <View style={styles.verifiedBadge}><Feather name="check-circle" size={12} color={COLORS.success} /><Text style={styles.verifiedBadgeText}>Verified</Text></View>
            ) : status === "PENDING" ? (
              <View style={styles.unverifiedBadge}><Feather name="clock" size={12} color={COLORS.primary} /><Text style={styles.unverifiedBadgeText}>Verification Pending</Text></View>
            ) : (
              <TouchableOpacity style={styles.unverifiedBadge} onPress={openVerification} activeOpacity={0.7}><Feather name="alert-circle" size={12} color={COLORS.primary} /><Text style={styles.unverifiedBadgeText}>{status === "REJECTED" ? "Verification Rejected" : "Complete Verification"}</Text></TouchableOpacity>
            )}
            {canVerify && <TouchableOpacity style={styles.editButton} onPress={openVerification}><Feather name="shield" size={14} color="#FFFFFF" /><Text style={styles.editButtonText}>{status === "REJECTED" ? "Correct & Resubmit" : "Verify Account"}</Text></TouchableOpacity>}
          </View>

          {!profile && <View style={styles.notice}><Text style={styles.noticeText}>Your mechanic profile has not been submitted yet.</Text><TouchableOpacity onPress={openVerification}><Text style={styles.noticeLink}>Complete Verification</Text></TouchableOpacity></View>}

          <Section heading="PERSONAL INFORMATION"><Info icon="mail" value={email} /><Info icon="phone" value={profile?.personal.phone || "Not provided"} /></Section>
          <Section heading="PROFESSIONAL INFORMATION"><Info icon="award" value={profile ? `${profile.professional.yearsOfExperience} years of experience` : "Not provided"} /><Text style={styles.specializationLabel}>Specializations</Text><Tags values={profile?.professional.specializations ?? []} /></Section>
          <Section heading="VEHICLE TYPES SERVED"><Tags values={profile?.professional.vehicleTypesServed ?? []} /></Section>
          <Section heading="SERVICE AREA"><Info icon="map-pin" value={profile?.professional.serviceArea || "Not provided"} /></Section>
          {status === "VERIFIED" && (
            <Section heading="PUBLIC PROVIDER LISTING">
              <Info icon="briefcase" value={profile?.publicListing?.businessName || "Not set up"} />
              <Info icon="activity" value={profile?.publicListing?.availability || "No availability selected"} />
              <TouchableOpacity style={styles.publicListingButton} onPress={() => router.push("/(onsite-mechanic)/public-listing")}>
                <Feather name="map-pin" size={16} color="#FFFFFF" />
                <Text style={styles.publicListingButtonText}>{profile?.publicListing ? "Update Public Listing" : "Set Up Public Listing"}</Text>
              </TouchableOpacity>
            </Section>
          )}
          <Section heading="ACCOUNT"><TouchableOpacity style={styles.logoutRow} onPress={handleLogout}><Feather name="log-out" size={16} color={COLORS.primary} /><Text style={styles.logoutText}>Logout</Text></TouchableOpacity></Section>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return <><View style={styles.sectionHeaderRow}><Text style={styles.sectionHeading}>{heading}</Text></View><View style={styles.card}>{children}</View></>;
}
function Info({ icon, value }: { icon: keyof typeof Feather.glyphMap; value: string }) {
  return <View style={styles.infoRow}><Feather name={icon} size={14} color={COLORS.textMuted} /><Text style={styles.infoText}>{value}</Text></View>;
}
function Tags({ values }: { values: string[] }) {
  if (!values.length) return <Text style={styles.emptyText}>Not provided</Text>;
  return <View style={styles.tagRow}>{values.map((item) => <View key={item} style={styles.tag}><Text style={styles.tagText}>{item}</Text></View>)}</View>;
}

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:COLORS.background}, scroll:{flex:1,backgroundColor:COLORS.background}, scrollContent:{paddingHorizontal:16,paddingTop:16,paddingBottom:32}, header:{paddingHorizontal:16,paddingBottom:14,backgroundColor:COLORS.primary}, headerTitle:{fontSize:18,fontWeight:"700",color:"#FFFFFF"},
  stateWrap:{flex:1,alignItems:"center",justifyContent:"center",gap:14,padding:28}, stateText:{fontSize:14,color:COLORS.textMuted,textAlign:"center",lineHeight:20}, retryButton:{backgroundColor:COLORS.primary,borderRadius:8,paddingHorizontal:18,paddingVertical:10}, retryText:{fontSize:13,fontWeight:"700",color:"#FFFFFF"},
  identityCard:{backgroundColor:COLORS.primary,borderWidth:1,borderColor:COLORS.primary,borderRadius:12,paddingVertical:20,paddingHorizontal:16,alignItems:"center"}, avatar:{width:56,height:56,borderRadius:28,backgroundColor:"#FFFFFF",alignItems:"center",justifyContent:"center",marginBottom:10}, name:{fontSize:17,fontWeight:"700",color:"#FFFFFF"}, role:{fontSize:12,color:"rgba(255,255,255,0.85)",marginTop:2},
  verifiedBadge:{flexDirection:"row",alignItems:"center",gap:4,backgroundColor:"#FFFFFF",borderRadius:999,paddingHorizontal:9,paddingVertical:3,marginTop:8}, verifiedBadgeText:{fontSize:11,fontWeight:"700",color:COLORS.success}, unverifiedBadge:{flexDirection:"row",alignItems:"center",gap:4,backgroundColor:"#FFFFFF",borderRadius:999,paddingHorizontal:9,paddingVertical:3,marginTop:8}, unverifiedBadgeText:{fontSize:11,fontWeight:"700",color:COLORS.primary},
  editButton:{marginTop:18,flexDirection:"row",alignItems:"center",gap:6,borderWidth:1,borderColor:"#FFFFFF",borderRadius:8,paddingVertical:10,paddingHorizontal:20}, editButtonText:{fontSize:13,fontWeight:"600",color:"#FFFFFF"}, notice:{marginTop:16,backgroundColor:COLORS.primaryMuted,borderRadius:10,padding:14,gap:5}, noticeText:{fontSize:13,color:COLORS.text}, noticeLink:{fontSize:13,fontWeight:"700",color:COLORS.primary},
  sectionHeaderRow:{marginTop:22,marginBottom:10}, sectionHeading:{fontSize:12,fontWeight:"700",color:COLORS.textMuted,letterSpacing:0.6}, card:{backgroundColor:COLORS.background,borderWidth:1,borderColor:COLORS.border,borderRadius:12,padding:16}, infoRow:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:10}, infoText:{fontSize:13,color:COLORS.text}, specializationLabel:{fontSize:12,fontWeight:"600",color:COLORS.textMuted,marginTop:4,marginBottom:8}, tagRow:{flexDirection:"row",flexWrap:"wrap",gap:8}, tag:{backgroundColor:COLORS.sectionBackground,borderWidth:1,borderColor:COLORS.border,borderRadius:8,paddingHorizontal:10,paddingVertical:6}, tagText:{fontSize:12,color:COLORS.text,fontWeight:"500"}, emptyText:{fontSize:13,color:COLORS.textMuted}, publicListingButton:{marginTop:6,backgroundColor:COLORS.primary,borderRadius:8,paddingVertical:11,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7},publicListingButtonText:{color:"#FFFFFF",fontSize:13,fontWeight:"700"},logoutRow:{flexDirection:"row",alignItems:"center",gap:10}, logoutText:{fontSize:13,fontWeight:"600",color:COLORS.primary},
});
