import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { auth } from "../../services/firebase";
import { getTowingPricing, saveTowingPricing } from "../../services/towingPricingService";

const C = { primary: "#D32F2F", background: "#FFFFFF", text: "#1A1A1A", muted: "#6B7280", border: "#E5E7EB", surface: "#F7F7F8" };

export default function TowingPricingScreen() {
  const router = useRouter();
  const [basePrice, setBasePrice] = useState("");
  const [pricePerKm, setPricePerKm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("You must be signed in to manage towing pricing.");
      const pricing = await getTowingPricing(uid);
      setBasePrice(pricing ? String(pricing.basePrice) : "");
      setPricePerKm(pricing ? String(pricing.pricePerKm) : "");
    } catch (error) { Alert.alert("Pricing unavailable", (error as Error).message); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    if (!basePrice.trim() || !pricePerKm.trim()) {
      Alert.alert("Missing information", "Enter a base price and price per kilometer.");
      return;
    }
    setSaving(true);
    try {
      await saveTowingPricing({ basePrice: Number(basePrice), pricePerKm: Number(pricePerKm) });
      Alert.alert("Pricing saved", "Your towing rates are now available to customers.");
      await load();
    } catch (error) { Alert.alert("Could not save pricing", (error as Error).message); }
    finally { setSaving(false); }
  };

  return <SafeAreaView style={s.safe}>
    <View style={s.header}><TouchableOpacity onPress={() => router.back()}><Feather name="arrow-left" size={22} color="#FFFFFF" /></TouchableOpacity><Text style={s.title}>Towing Pricing</Text><View style={{ width: 22 }} /></View>
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.help}>Customers will see an estimate calculated from your base fee plus the total estimated towing distance multiplied by your per-kilometer rate.</Text>
      <View style={s.form}>
        <Text style={s.formTitle}>Your Towing Rates</Text>
        {loading ? <ActivityIndicator color={C.primary} /> : <>
          <Field label="Base price (₱)" value={basePrice} change={setBasePrice} />
          <Field label="Price per kilometer (₱/km)" value={pricePerKm} change={setPricePerKm} />
          <View style={s.example}><Text style={s.exampleText}>Estimate = base price + (total distance × price per km)</Text></View>
          <TouchableOpacity style={s.primary} disabled={saving} onPress={() => void save()}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>Save Pricing</Text>}</TouchableOpacity>
        </>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function Field({ label, value, change }: { label: string; value: string; change: (value: string) => void }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput style={s.input} value={value} onChangeText={change} keyboardType="decimal-pad" placeholder="0" /></View>;
}

const s = StyleSheet.create({ safe:{flex:1,backgroundColor:C.background},header:{backgroundColor:C.primary,padding:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},title:{fontSize:18,fontWeight:"700",color:"#FFFFFF"},content:{padding:16,paddingBottom:32},help:{fontSize:13,color:C.muted,lineHeight:19,marginBottom:14},form:{borderWidth:1,borderColor:C.border,borderRadius:12,padding:16,gap:14},formTitle:{fontSize:15,fontWeight:"700",color:C.text},field:{gap:5},label:{fontSize:12,fontWeight:"600",color:C.muted},input:{borderWidth:1,borderColor:C.border,borderRadius:8,paddingHorizontal:12,paddingVertical:10,color:C.text},example:{backgroundColor:C.surface,padding:12,borderRadius:8},exampleText:{color:C.muted,fontSize:12,lineHeight:18},primary:{backgroundColor:C.primary,borderRadius:8,paddingHorizontal:16,paddingVertical:12,alignItems:"center"},primaryText:{color:"#FFFFFF",fontWeight:"700"} });
