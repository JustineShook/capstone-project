// app/(onsite-mechanic)/verification.tsx
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = {
  primary: "#D32F2F",
  primaryMuted: "#FCE8E8",
  background: "#FFFFFF",
  sectionBackground: "#F7F7F8",
  text: "#1A1A1A",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  success: "#2E7D32",
  successMuted: "#E8F5E9",
};

// ---------------------------------------------------------------------------
// Data shape — mirrors the future Firestore document at
// users/{uid}/providerProfile. UI + mock state only for now; nothing here
// is written to Firebase.
// ---------------------------------------------------------------------------
type VerificationStatus = "INCOMPLETE" | "PENDING" | "VERIFIED" | "REJECTED";

interface ProviderProfileDraft {
  personal: {
    fullName: string;
    phone: string;
    dateOfBirth: string;
    address: string;
    cityMunicipality: string;
  };
  professional: {
    yearsOfExperience: string;
    specializations: string[];
    vehicleTypesServed: string[];
    serviceArea: string;
    maxTravelDistanceKm: string;
  };
  identification: {
    idType: string;
    idNumber: string;
    validIdUploaded: boolean;
    profilePhotoUploaded: boolean;
  };
  credentials: {
    tesdaCertificate: string;
    certificationNumber: string;
    certificateUploaded: boolean;
    yearsProfessionalExperience: string;
  };
  serviceInfo: {
    serviceRate: string;
    emergencyServiceAvailable: boolean | null;
    availableDays: string[];
    availableHours: string;
  };
  consentAccepted: boolean;
  verificationStatus: VerificationStatus;
}

const INITIAL_DRAFT: ProviderProfileDraft = {
  personal: {
    fullName: "",
    phone: "",
    dateOfBirth: "",
    address: "",
    cityMunicipality: "",
  },
  professional: {
    yearsOfExperience: "",
    specializations: [],
    vehicleTypesServed: [],
    serviceArea: "",
    maxTravelDistanceKm: "",
  },
  identification: {
    idType: "",
    idNumber: "",
    validIdUploaded: false,
    profilePhotoUploaded: false,
  },
  credentials: {
    tesdaCertificate: "",
    certificationNumber: "",
    certificateUploaded: false,
    yearsProfessionalExperience: "",
  },
  serviceInfo: {
    serviceRate: "",
    emergencyServiceAvailable: null,
    availableDays: [],
    availableHours: "",
  },
  consentAccepted: false,
  verificationStatus: "INCOMPLETE",
};

const SPECIALIZATION_OPTIONS = [
  "Engine Diagnostics",
  "Battery Replacement",
  "Brake Repair",
  "Tire Replacement",
  "Electrical Repair",
  "Air Conditioning",
];

const VEHICLE_TYPE_OPTIONS = ["Cars", "SUVs", "Pickup Trucks", "Vans", "Motorcycles"];

const ID_TYPE_OPTIONS = ["Driver's License", "UMID", "PhilSys ID", "Passport"];

const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TOTAL_STEPS = 3;

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={styles.requiredAsterisk}> *</Text>}
    </Text>
  );
}

function ChipMultiSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <TouchableOpacity
            key={option}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onToggle(option)}
            activeOpacity={0.7}
          >
            {active && <Feather name="check" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ChipSingleSelect({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = selected === option;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(option)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function UploadBox({
  label,
  description,
  required,
  uploaded,
  fileName,
  onPress,
}: {
  label: string;
  description: string;
  required?: boolean;
  uploaded: boolean;
  fileName: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <FieldLabel label={label} required={required} />
      <TouchableOpacity
        style={[styles.uploadBox, uploaded && styles.uploadBoxDone]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Feather
          name={uploaded ? "check-circle" : "upload-cloud"}
          size={18}
          color={uploaded ? COLORS.success : COLORS.primary}
        />
        <Text style={[styles.uploadBoxText, uploaded && styles.uploadBoxTextDone]}>
          {uploaded ? `${fileName} attached` : "Tap to upload"}
        </Text>
      </TouchableOpacity>
      <Text style={styles.helperText}>{description}</Text>
    </View>
  );
}

function SegmentedYesNo({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.segmentedControl}>
      <TouchableOpacity
        style={[styles.segment, value === true && styles.segmentActive]}
        onPress={() => onChange(true)}
      >
        <Text style={[styles.segmentText, value === true && styles.segmentTextActive]}>YES</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segment, value === false && styles.segmentActive]}
        onPress={() => onChange(false)}
      >
        <Text style={[styles.segmentText, value === false && styles.segmentTextActive]}>NO</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function VerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState<ProviderProfileDraft>(INITIAL_DRAFT);

  const updatePersonal = (field: keyof ProviderProfileDraft["personal"], value: string) =>
    setDraft((prev) => ({ ...prev, personal: { ...prev.personal, [field]: value } }));

  const updateProfessional = (
    field: keyof ProviderProfileDraft["professional"],
    value: string
  ) => setDraft((prev) => ({ ...prev, professional: { ...prev.professional, [field]: value } }));

  const toggleSpecialization = (option: string) =>
    setDraft((prev) => {
      const list = prev.professional.specializations;
      const next = list.includes(option) ? list.filter((item) => item !== option) : [...list, option];
      return { ...prev, professional: { ...prev.professional, specializations: next } };
    });

  const toggleVehicleType = (option: string) =>
    setDraft((prev) => {
      const list = prev.professional.vehicleTypesServed;
      const next = list.includes(option) ? list.filter((item) => item !== option) : [...list, option];
      return { ...prev, professional: { ...prev.professional, vehicleTypesServed: next } };
    });

  const updateIdentification = (
    field: "idType" | "idNumber",
    value: string
  ) => setDraft((prev) => ({ ...prev, identification: { ...prev.identification, [field]: value } }));

  const toggleUpload = (
    section: "identification" | "credentials",
    field: string
  ) =>
    setDraft((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as any), [field]: !(prev[section] as any)[field] },
    }));

  const updateCredentials = (
    field: keyof ProviderProfileDraft["credentials"],
    value: string
  ) => setDraft((prev) => ({ ...prev, credentials: { ...prev.credentials, [field]: value } }));

  const updateServiceInfo = (
    field: "serviceRate" | "availableHours",
    value: string
  ) => setDraft((prev) => ({ ...prev, serviceInfo: { ...prev.serviceInfo, [field]: value } }));

  const setEmergencyAvailable = (value: boolean) =>
    setDraft((prev) => ({
      ...prev,
      serviceInfo: { ...prev.serviceInfo, emergencyServiceAvailable: value },
    }));

  const toggleDay = (day: string) =>
    setDraft((prev) => {
      const list = prev.serviceInfo.availableDays;
      const next = list.includes(day) ? list.filter((item) => item !== day) : [...list, day];
      return { ...prev, serviceInfo: { ...prev.serviceInfo, availableDays: next } };
    });

  const toggleConsent = () =>
    setDraft((prev) => ({ ...prev, consentAccepted: !prev.consentAccepted }));

  // -------------------------------------------------------------------------
  // Validation — per step, required fields only (marked with * in the UI)
  // -------------------------------------------------------------------------
  function validateStep1(): string | null {
    const { fullName, phone, dateOfBirth, address, cityMunicipality } = draft.personal;
    if (!fullName.trim() || !phone.trim() || !dateOfBirth.trim() || !address.trim() || !cityMunicipality.trim()) {
      return "Please complete all required Personal Information fields.";
    }
    const { yearsOfExperience, specializations, vehicleTypesServed, serviceArea, maxTravelDistanceKm } =
      draft.professional;
    if (
      !yearsOfExperience.trim() ||
      specializations.length === 0 ||
      vehicleTypesServed.length === 0 ||
      !serviceArea.trim() ||
      !maxTravelDistanceKm.trim()
    ) {
      return "Please complete all required Professional Information fields, including at least one specialization and vehicle type.";
    }
    return null;
  }

  function validateStep2(): string | null {
    const { idType, idNumber, validIdUploaded, profilePhotoUploaded } = draft.identification;
    if (!idType || !idNumber.trim() || !validIdUploaded || !profilePhotoUploaded) {
      return "Please complete ID Type, ID Number, and upload both your valid ID and profile photo.";
    }
    return null;
  }

  function validateStep3(): string | null {
    const { serviceRate, emergencyServiceAvailable, availableDays, availableHours } = draft.serviceInfo;
    if (
      !serviceRate.trim() ||
      emergencyServiceAvailable === null ||
      availableDays.length === 0 ||
      !availableHours.trim()
    ) {
      return "Please complete all required Service Information fields.";
    }
    if (!draft.consentAccepted) {
      return "Please confirm the verification consent checkbox before submitting.";
    }
    return null;
  }

  const handleContinue = () => {
    const error = step === 1 ? validateStep1() : step === 2 ? validateStep2() : null;
    if (error) {
      Alert.alert("Missing information", error);
      return;
    }
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    setStep((prev) => prev - 1);
  };

  const handleSubmit = () => {
    const error = validateStep3();
    if (error) {
      Alert.alert("Missing information", error);
      return;
    }
    // Mock submission only — in the future this writes draft to
    // users/{uid}/providerProfile with verificationStatus set to "PENDING".
    setDraft((prev) => ({ ...prev, verificationStatus: "PENDING" }));
    setSubmitted(true);
  };

  // -------------------------------------------------------------------------
  // Confirmation screen
  // -------------------------------------------------------------------------
  if (submitted) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.headerTitle}>Verification</Text>
        </View>
        <View style={styles.confirmationWrap}>
          <View style={styles.confirmationIcon}>
            <Feather name="check-circle" size={40} color={COLORS.success} />
          </View>
          <Text style={styles.confirmationTitle}>Verification Submitted</Text>
          <Text style={styles.confirmationText}>
            Your documents are being reviewed. We&apos;ll notify you once your account has been
            verified.
          </Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>Status: {draft.verificationStatus}</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/(onsite-mechanic)/profile")}
          >
            <Text style={styles.primaryButtonText}>Back to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Complete Your Profile</Text>
          <View style={styles.backButtonSpacer} />
        </View>

        <Text style={styles.headerSubtitle}>
          Finish setting up your provider profile so customers can trust and book you.
        </Text>

        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressSegment,
                index < step && styles.progressSegmentDone,
              ]}
            />
          ))}
        </View>
        <Text style={styles.progressLabel}>
          Step {step} of {TOTAL_STEPS}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <>
            <SectionCard title="Personal Information">
              <View style={styles.fieldBlock}>
                <FieldLabel label="Full Name" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Juan Dela Cruz"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.personal.fullName}
                  onChangeText={(text) => updatePersonal("fullName", text)}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="Phone Number" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 0917 123 4567"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="phone-pad"
                  value={draft.personal.phone}
                  onChangeText={(text) => updatePersonal("phone", text)}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="Date of Birth" required />
                <TextInput
                  style={styles.input}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.personal.dateOfBirth}
                  onChangeText={(text) => updatePersonal("dateOfBirth", text)}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="Address" required />
                <TextInput
                  style={styles.input}
                  placeholder="House / street / barangay"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.personal.address}
                  onChangeText={(text) => updatePersonal("address", text)}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="City / Municipality" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Quezon City"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.personal.cityMunicipality}
                  onChangeText={(text) => updatePersonal("cityMunicipality", text)}
                />
              </View>
            </SectionCard>

            <SectionCard title="Professional Information">
              <View style={styles.fieldBlock}>
                <FieldLabel label="Years of Experience" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 5"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  value={draft.professional.yearsOfExperience}
                  onChangeText={(text) => updateProfessional("yearsOfExperience", text)}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="Specializations" required />
                <ChipMultiSelect
                  options={SPECIALIZATION_OPTIONS}
                  selected={draft.professional.specializations}
                  onToggle={toggleSpecialization}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="Vehicle Types Served" required />
                <ChipMultiSelect
                  options={VEHICLE_TYPE_OPTIONS}
                  selected={draft.professional.vehicleTypesServed}
                  onToggle={toggleVehicleType}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="Service Area" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Quezon City"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.professional.serviceArea}
                  onChangeText={(text) => updateProfessional("serviceArea", text)}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="Maximum Travel Distance (km)" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 10"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  value={draft.professional.maxTravelDistanceKm}
                  onChangeText={(text) => updateProfessional("maxTravelDistanceKm", text)}
                />
              </View>
            </SectionCard>
          </>
        )}

        {step === 2 && (
          <>
            <SectionCard title="Identification / Verification">
              <View style={styles.fieldBlock}>
                <FieldLabel label="ID Type" required />
                <ChipSingleSelect
                  options={ID_TYPE_OPTIONS}
                  selected={draft.identification.idType}
                  onSelect={(value) => updateIdentification("idType", value)}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="ID Number" required />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your ID number"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.identification.idNumber}
                  onChangeText={(text) => updateIdentification("idNumber", text)}
                />
              </View>
              <UploadBox
                label="Upload Valid ID"
                required
                description="Upload a clear photo of your government-issued ID (front side). JPG or PNG, max 5MB."
                uploaded={draft.identification.validIdUploaded}
                fileName="valid_id.jpg"
                onPress={() => toggleUpload("identification", "validIdUploaded")}
              />
              <UploadBox
                label="Upload Profile Photo"
                required
                description="A recent, clear photo of your face. This will be shown to customers on your profile."
                uploaded={draft.identification.profilePhotoUploaded}
                fileName="profile_photo.jpg"
                onPress={() => toggleUpload("identification", "profilePhotoUploaded")}
              />
            </SectionCard>

            <SectionCard title="Mechanic Credentials">
              <View style={styles.fieldBlock}>
                <FieldLabel label="TESDA / Training Certificate" />
                <TextInput
                  style={styles.input}
                  placeholder="Optional — e.g. TESDA Automotive Servicing NC II"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.credentials.tesdaCertificate}
                  onChangeText={(text) => updateCredentials("tesdaCertificate", text)}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="Certification / License Number" />
                <TextInput
                  style={styles.input}
                  placeholder="Optional"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.credentials.certificationNumber}
                  onChangeText={(text) => updateCredentials("certificationNumber", text)}
                />
              </View>
              <UploadBox
                label="Upload Certificate"
                description="Optional — upload your TESDA certificate or professional license, if you have one."
                uploaded={draft.credentials.certificateUploaded}
                fileName="certificate.pdf"
                onPress={() => toggleUpload("credentials", "certificateUploaded")}
              />
              <View style={styles.fieldBlock}>
                <FieldLabel label="Years of Professional Experience" />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 5"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  value={draft.credentials.yearsProfessionalExperience}
                  onChangeText={(text) => updateCredentials("yearsProfessionalExperience", text)}
                />
              </View>
            </SectionCard>
          </>
        )}

        {step === 3 && (
          <>
            <SectionCard title="Service Information">
              <View style={styles.fieldBlock}>
                <FieldLabel label="Service Rate / Starting Fee" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. \u20B1500"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  value={draft.serviceInfo.serviceRate}
                  onChangeText={(text) => updateServiceInfo("serviceRate", text)}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="Emergency Service Available" required />
                <SegmentedYesNo
                  value={draft.serviceInfo.emergencyServiceAvailable}
                  onChange={setEmergencyAvailable}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="Available Days" required />
                <ChipMultiSelect
                  options={DAY_OPTIONS}
                  selected={draft.serviceInfo.availableDays}
                  onToggle={toggleDay}
                />
              </View>
              <View style={styles.fieldBlock}>
                <FieldLabel label="Available Hours" required />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 8:00 AM - 6:00 PM"
                  placeholderTextColor={COLORS.textMuted}
                  value={draft.serviceInfo.availableHours}
                  onChangeText={(text) => updateServiceInfo("availableHours", text)}
                />
              </View>
            </SectionCard>

            <SectionCard title="Verification Consent">
              <TouchableOpacity
                style={styles.consentRow}
                onPress={toggleConsent}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, draft.consentAccepted && styles.checkboxChecked]}>
                  {draft.consentAccepted && <Feather name="check" size={13} color="#FFFFFF" />}
                </View>
                <Text style={styles.consentText}>
                  I confirm that the information and documents I provided are accurate and belong
                  to me.
                </Text>
              </TouchableOpacity>
            </SectionCard>
          </>
        )}

        <View style={{ height: 8 }} />
      </ScrollView>

      <View style={styles.footer}>
        {step < TOTAL_STEPS ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
            <Text style={styles.primaryButtonText}>Save & Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
            <Text style={styles.primaryButtonText}>Submit for Verification</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.primary,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: { padding: 4 },
  backButtonSpacer: { width: 28 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 10,
    lineHeight: 17,
  },

  progressRow: { flexDirection: "row", gap: 6, marginTop: 16 },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  progressSegmentDone: { backgroundColor: "#FFFFFF" },
  progressLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    marginTop: 8,
  },

  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 14,
    letterSpacing: 0.2,
  },

  fieldBlock: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.text, marginBottom: 6 },
  requiredAsterisk: { color: COLORS.primary, fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: COLORS.sectionBackground,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: COLORS.sectionBackground,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  chipTextActive: { color: "#FFFFFF" },

  uploadBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.primaryMuted,
  },
  uploadBoxDone: {
    borderStyle: "solid",
    borderColor: COLORS.success,
    backgroundColor: COLORS.successMuted,
  },
  uploadBoxText: { fontSize: 13, fontWeight: "600", color: COLORS.primary },
  uploadBoxTextDone: { color: COLORS.success },
  helperText: { fontSize: 11, color: COLORS.textMuted, marginTop: 6, lineHeight: 15 },

  segmentedControl: {
    flexDirection: "row",
    backgroundColor: COLORS.sectionBackground,
    borderRadius: 8,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: "center" },
  segmentActive: { backgroundColor: COLORS.primary },
  segmentText: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, letterSpacing: 0.3 },
  segmentTextActive: { color: "#FFFFFF" },

  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  consentText: { flex: 1, fontSize: 12, color: COLORS.text, lineHeight: 18 },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  confirmationWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  confirmationIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.successMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  confirmationTitle: { fontSize: 19, fontWeight: "700", color: COLORS.text, textAlign: "center" },
  confirmationText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 19,
  },
  statusPill: {
    marginTop: 18,
    backgroundColor: COLORS.sectionBackground,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusPillText: { fontSize: 11, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.4 },
});