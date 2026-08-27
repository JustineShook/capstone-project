// data/mockVehicles.ts
import { Ionicons } from "@expo/vector-icons";
import { VehicleType } from "./mockProviders";

// ---------------------------------------------------------------------------
// VEHICLE TYPES
// ---------------------------------------------------------------------------
export type FuelType = "Gasoline" | "Diesel" | "Electric" | "Hybrid";

export function getFuelIcon(fuel: FuelType): keyof typeof Ionicons.glyphMap {
  switch (fuel) {
    case "Gasoline":
      return "flame-outline";
    case "Diesel":
      return "flame-outline";
    case "Electric":
      return "flash-outline";
    case "Hybrid":
      return "leaf-outline";
  }
}

export type ExpiryStatus = "valid" | "expiring" | "expired";

// Parses "MMM D, YYYY"-style display dates back to a Date for comparison.
// Mock data uses this format directly, so we store a separate ISO field
// alongside each display date to keep this simple and reliable.
export function getExpiryStatus(isoDate: string): ExpiryStatus {
  const today = new Date();
  const target = new Date(isoDate);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "expiring";
  return "valid";
}

export function getExpiryLabel(status: ExpiryStatus): string {
  switch (status) {
    case "valid":
      return "Valid";
    case "expiring":
      return "Expiring Soon";
    case "expired":
      return "Expired";
  }
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  expiryDate: string; // display
  expiryDateIso: string; // for status calc
  coverage: string;
}

export interface MaintenanceItem {
  id: string;
  task: string;
  dueDate?: string;
  dueMileage?: number;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface ServiceRecord {
  id: string;
  date: string;
  type: string;
  mileage: number;
  cost: string;
  shop: string;
}

export interface VehicleDocument {
  id: string;
  name: string;
  type: "Registration" | "Insurance" | "Inspection" | "Other";
  dateAdded: string;
}

export interface MockVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  vin: string;
  color: string;
  colorHex: string;
  mileage: number;
  fuelType: FuelType;
  vehicleType: VehicleType;
  isPrimary: boolean;
  initials: string;
  thumbColor: string;
  insurance: InsuranceInfo;
  registrationExpiry: string;
  registrationExpiryIso: string;
  lastServiceDate: string;
  upcomingMaintenance: MaintenanceItem[];
  serviceHistory: ServiceRecord[];
  documents: VehicleDocument[];
}

// ---------------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------------
export const MOCK_VEHICLES: MockVehicle[] = [
  {
    id: "v1",
    make: "Toyota",
    model: "Vios",
    year: 2021,
    plate: "ABC 1234",
    vin: "MR0FR22G701234567",
    color: "Pearl White",
    colorHex: "#F5F5F0",
    mileage: 38250,
    fuelType: "Gasoline",
    vehicleType: "Sedan",
    isPrimary: true,
    initials: "TV",
    thumbColor: "#D32F2F",
    insurance: {
      provider: "Malayan Insurance",
      policyNumber: "MI-2026-0091823",
      expiryDate: "Nov 14, 2026",
      expiryDateIso: "2026-11-14",
      coverage: "Comprehensive",
    },
    registrationExpiry: "Sep 9, 2026",
    registrationExpiryIso: "2026-09-09",
    lastServiceDate: "Jul 2, 2026",
    upcomingMaintenance: [
      { id: "m1", task: "Oil Change", dueMileage: 40000, icon: "water-outline" },
      { id: "m2", task: "Tire Rotation", dueDate: "Sep 20, 2026", icon: "sync-outline" },
      { id: "m3", task: "Brake Inspection", dueMileage: 42000, icon: "disc-outline" },
    ],
    serviceHistory: [
      { id: "s1", date: "Jul 2, 2026", type: "Oil Change & Filter", mileage: 35000, cost: "₱2,450", shop: "Cebu Auto Care Center" },
      { id: "s2", date: "Mar 15, 2026", type: "Brake Pad Replacement", mileage: 30500, cost: "₱4,800", shop: "TirePro Auto Shop" },
      { id: "s3", date: "Nov 8, 2025", type: "Annual PMS", mileage: 25000, cost: "₱6,200", shop: "Toyota Cebu Service Center" },
    ],
    documents: [
      { id: "d1", name: "OR/CR Registration", type: "Registration", dateAdded: "Sep 9, 2025" },
      { id: "d2", name: "Comprehensive Insurance Policy", type: "Insurance", dateAdded: "Nov 14, 2025" },
      { id: "d3", name: "LTO Emission Test Result", type: "Inspection", dateAdded: "Aug 1, 2026" },
    ],
  },
  {
    id: "v2",
    make: "Mitsubishi",
    model: "Montero Sport",
    year: 2019,
    plate: "XYZ 5678",
    vin: "JMBXNGA0WKZ891234",
    color: "Graphite Grey",
    colorHex: "#4A4A4A",
    mileage: 61840,
    fuelType: "Diesel",
    vehicleType: "SUV",
    isPrimary: false,
    initials: "MS",
    thumbColor: "#1E88E5",
    insurance: {
      provider: "Standard Insurance",
      policyNumber: "SI-2025-0044521",
      expiryDate: "Sep 2, 2026",
      expiryDateIso: "2026-09-02",
      coverage: "Comprehensive",
    },
    registrationExpiry: "Dec 18, 2026",
    registrationExpiryIso: "2026-12-18",
    lastServiceDate: "Jun 10, 2026",
    upcomingMaintenance: [
      { id: "m4", task: "Diesel Filter Change", dueMileage: 65000, icon: "filter-outline" },
      { id: "m5", task: "Timing Belt Check", dueDate: "Jan 15, 2027", icon: "settings-outline" },
    ],
    serviceHistory: [
      { id: "s4", date: "Jun 10, 2026", type: "General PMS", mileage: 60000, cost: "₱7,500", shop: "Mendez Auto Body & Repair" },
      { id: "s5", date: "Jan 22, 2026", type: "Battery Replacement", mileage: 55200, cost: "₱6,900", shop: "Cebu Auto Care Center" },
    ],
    documents: [
      { id: "d4", name: "OR/CR Registration", type: "Registration", dateAdded: "Dec 18, 2025" },
      { id: "d5", name: "Comprehensive Insurance Policy", type: "Insurance", dateAdded: "Sep 2, 2025" },
    ],
  },
  {
    id: "v3",
    make: "Honda",
    model: "Click 150i",
    year: 2022,
    plate: "1234 NBA",
    vin: "MH1KF5115NK123456",
    color: "Matte Black",
    colorHex: "#1A1A1A",
    mileage: 12300,
    fuelType: "Gasoline",
    vehicleType: "Motorcycle",
    isPrimary: false,
    initials: "HC",
    thumbColor: "#2E7D32",
    insurance: {
      provider: "Malayan Insurance",
      policyNumber: "MI-2026-0071122",
      expiryDate: "Aug 30, 2026",
      expiryDateIso: "2026-08-30",
      coverage: "CTPL + Comprehensive",
    },
    registrationExpiry: "Oct 5, 2026",
    registrationExpiryIso: "2026-10-05",
    lastServiceDate: "Aug 5, 2026",
    upcomingMaintenance: [
      { id: "m6", task: "Oil Change", dueMileage: 13000, icon: "water-outline" },
      { id: "m7", task: "CVT Belt Check", dueMileage: 15000, icon: "sync-outline" },
    ],
    serviceHistory: [
      { id: "s6", date: "Aug 5, 2026", type: "Oil Change", mileage: 12000, cost: "₱650", shop: "Juan's Mobile Auto Repair" },
      { id: "s7", date: "Feb 18, 2026", type: "CVT Service", mileage: 8000, cost: "₱1,800", shop: "Honda Cebu Service Center" },
    ],
    documents: [
      { id: "d6", name: "OR/CR Registration", type: "Registration", dateAdded: "Oct 5, 2025" },
      { id: "d7", name: "CTPL + Comprehensive Policy", type: "Insurance", dateAdded: "Aug 30, 2025" },
    ],
  },
];