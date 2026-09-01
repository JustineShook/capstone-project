// data/mockProviders.ts
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// PROVIDER CATEGORIES
// VeResc has 3 main provider types customers browse by:
//  - Towing: providers that pick up and transport the vehicle
//  - Auto Shops: physical repair shops the customer brings the vehicle to
//  - Onsite Mechanics: independent mechanics who travel to the customer
// ---------------------------------------------------------------------------
export type ProviderCategory = "All" | "Towing" | "Auto Shops" | "Onsite Mechanics";

export const CATEGORIES: { label: ProviderCategory; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "All", icon: "grid-outline" },
  { label: "Towing", icon: "car-outline" },
  { label: "Auto Shops", icon: "storefront-outline" },
  { label: "Onsite Mechanics", icon: "construct-outline" },
];

export function getCategoryIcon(
  category: Exclude<ProviderCategory, "All">
): keyof typeof Ionicons.glyphMap {
  return CATEGORIES.find((c) => c.label === category)?.icon ?? "ellipse-outline";
}

// Small label shown under the provider name on each card
export function getServiceLabel(category: Exclude<ProviderCategory, "All">) {
  switch (category) {
    case "Towing":
      return "Towing Service";
    case "Auto Shops":
      return "Auto Shop";
    case "Onsite Mechanics":
      return "Onsite Mechanic";
  }
}

// Badge describing how the service is delivered
export function getCategoryBadge(category: Exclude<ProviderCategory, "All">): {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
} {
  switch (category) {
    case "Towing":
      return { icon: "car-outline", text: "Pickup & Tow" };
    case "Auto Shops":
      return { icon: "storefront-outline", text: "Visit Shop" };
    case "Onsite Mechanics":
      return { icon: "location-outline", text: "Onsite Service" };
  }
}

// Auto Shops use open/closed hours wording; Towing & Onsite Mechanics use available/busy
export function getStatusLabel(category: Exclude<ProviderCategory, "All">, isPositive: boolean) {
  if (category === "Auto Shops") return isPositive ? "Open" : "Closed";
  return isPositive ? "Available" : "Busy";
}

// Label for the services section — towing providers phrase it differently
export function getServicesSectionLabel(category: Exclude<ProviderCategory, "All">) {
  return category === "Towing" ? "Towing Services" : "Services";
}

// Whether this category shows the "Book Service" action (Auto Shops do not)
export function supportsBooking(category: Exclude<ProviderCategory, "All">) {
  return category !== "Auto Shops";
}

// ---------------------------------------------------------------------------
// VEHICLE TYPES
// Used by all provider categories to indicate which vehicles they can
// service (Onsite Mechanics / Auto Shops) or tow (Towing).
// ---------------------------------------------------------------------------
export type VehicleType = "Sedan" | "Car" | "Cars" | "SUV" | "SUVs" | "Pickup" | "Pickup Truck" | "Pickup Trucks" | "Van" | "Vans" | "Motorcycle" | "Motorcycles" | "Truck";

export const VEHICLE_TYPES: {
  label: VehicleType;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { label: "Sedan", icon: "car" },
  { label: "Car", icon: "car" },
  { label: "Cars", icon: "car" },
  { label: "SUV", icon: "car-estate" },
  { label: "SUVs", icon: "car-estate" },
  { label: "Pickup", icon: "car-pickup" },
  { label: "Pickup Truck", icon: "car-pickup" },
  { label: "Pickup Trucks", icon: "car-pickup" },
  { label: "Van", icon: "van-utility" },
  { label: "Vans", icon: "van-utility" },
  { label: "Motorcycle", icon: "motorbike" },
  { label: "Motorcycles", icon: "motorbike" },
  { label: "Truck", icon: "truck" },
];

export function getVehicleTypeIcon(type: VehicleType): keyof typeof MaterialCommunityIcons.glyphMap {
  return VEHICLE_TYPES.find((v) => v.label === type)?.icon ?? "car-outline";
}

// ---------------------------------------------------------------------------
// REVIEWS
// ---------------------------------------------------------------------------
export interface ProviderReview {
  id: string;
  customerName: string;
  rating: number; // 1-5
  comment: string;
  date: string; // human-readable, e.g. "2 days ago"
}

// ---------------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------------
export interface MockProvider {
  id: string;
  name: string;
  category: Exclude<ProviderCategory, "All">;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  startingPrice: string;
  isPositiveStatus: boolean; // Available/Open when true, Busy/Closed when false
  initials: string;
  color: string;
  lat: number;
  lng: number;
  // Additional detail info shown in the expanded provider detail card
  description: string;
  services: string[];
  hours: string;
  emergencyServiceAvailable?: boolean;
  phone: string;
  vehicleTypes: VehicleType[];
  reviews: ProviderReview[];
}

export const MOCK_CENTER = { lat: 10.3181, lng: 123.9057 };

export const MOCK_PROVIDERS: MockProvider[] = [
  {
    id: "p1",
    name: "RoadGuard Towing",
    category: "Towing",
    rating: 4.8,
    reviewCount: 212,
    distanceKm: 1.2,
    startingPrice: "₱1,200",
    isPositiveStatus: true,
    initials: "RG",
    color: "#D32F2F",
    lat: 10.3201,
    lng: 123.9021,
    description: "24/7 roadside towing and vehicle recovery service.",
    services: ["Emergency Towing", "Vehicle Recovery", "Roadside Assistance"],
    hours: "Open 24 hours",
    phone: "+63 917 123 4567",
    vehicleTypes: ["Sedan", "SUV", "Pickup", "Van"],
    reviews: [
      {
        id: "p1-r1",
        customerName: "Juan D.",
        rating: 5,
        comment: "Fast response and very professional.",
        date: "2 days ago",
      },
      {
        id: "p1-r2",
        customerName: "Maria S.",
        rating: 4,
        comment: "Good service and reasonable price.",
        date: "1 week ago",
      },
      {
        id: "p1-r3",
        customerName: "Carlo P.",
        rating: 5,
        comment: "Arrived within 20 minutes, very reliable.",
        date: "3 weeks ago",
      },
    ],
  },
  {
    id: "p2",
    name: "Cebu Auto Care Center",
    category: "Auto Shops",
    rating: 4.7,
    reviewCount: 180,
    distanceKm: 2.1,
    startingPrice: "₱500",
    isPositiveStatus: true,
    initials: "CA",
    color: "#1E88E5",
    lat: 10.3195,
    lng: 123.9095,
    description: "Full-service auto shop specializing in general repairs and maintenance.",
    services: ["Oil Change", "Brake Repair", "Engine Diagnostics"],
    hours: "Mon–Sat, 8:00 AM – 6:00 PM",
    phone: "+63 917 234 5678",
    vehicleTypes: ["Sedan", "SUV", "Pickup"],
    reviews: [
      {
        id: "p2-r1",
        customerName: "Anna L.",
        rating: 5,
        comment: "Very thorough diagnostics, fixed the issue first try.",
        date: "1 day ago",
      },
      {
        id: "p2-r2",
        customerName: "Mark T.",
        rating: 4,
        comment: "Clean shop and friendly staff.",
        date: "5 days ago",
      },
    ],
  },
  {
    id: "p3",
    name: "Juan's Mobile Auto Repair",
    category: "Onsite Mechanics",
    rating: 4.9,
    reviewCount: 98,
    distanceKm: 0.8,
    startingPrice: "₱500",
    isPositiveStatus: true,
    initials: "JM",
    color: "#6A1B9A",
    lat: 10.3155,
    lng: 123.9012,
    description: "Independent mechanic offering onsite repairs wherever your vehicle breaks down.",
    services: ["Battery Jumpstart", "Flat Tire Change", "Minor Engine Repair"],
    hours: "Daily, 7:00 AM – 9:00 PM",
    phone: "+63 917 345 6789",
    vehicleTypes: ["Sedan", "SUV", "Motorcycle"],
    reviews: [
      {
        id: "p3-r1",
        customerName: "Ella R.",
        rating: 5,
        comment: "Came to my house and fixed my battery in minutes.",
        date: "4 days ago",
      },
      {
        id: "p3-r2",
        customerName: "Paolo G.",
        rating: 5,
        comment: "Super polite and knowledgeable mechanic.",
        date: "2 weeks ago",
      },
    ],
  },
  {
    id: "p4",
    name: "24/7 Rescue Towing",
    category: "Towing",
    rating: 4.9,
    reviewCount: 410,
    distanceKm: 0.5,
    startingPrice: "₱1,000",
    isPositiveStatus: true,
    initials: "RT",
    color: "#D32F2F",
    lat: 10.3170,
    lng: 123.9040,
    description: "Fast-response towing fleet covering all of Cebu City and nearby areas.",
    services: ["Emergency Towing", "Accident Recovery", "Long-Distance Towing"],
    hours: "Open 24 hours",
    phone: "+63 917 456 7890",
    vehicleTypes: ["Sedan", "SUV", "Pickup", "Van", "Motorcycle"],
    reviews: [
      {
        id: "p4-r1",
        customerName: "Ramon V.",
        rating: 5,
        comment: "Best towing service in the city, hands down.",
        date: "6 hours ago",
      },
      {
        id: "p4-r2",
        customerName: "Ivy C.",
        rating: 5,
        comment: "They handled my accident recovery with care.",
        date: "3 days ago",
      },
      {
        id: "p4-r3",
        customerName: "Noel F.",
        rating: 4,
        comment: "A bit pricey but worth it for the speed.",
        date: "1 month ago",
      },
    ],
  },
  {
    id: "p5",
    name: "Mendez Auto Body & Repair",
    category: "Auto Shops",
    rating: 4.4,
    reviewCount: 58,
    distanceKm: 2.6,
    startingPrice: "₱800",
    isPositiveStatus: false,
    initials: "MB",
    color: "#6D4C41",
    lat: 10.3140,
    lng: 123.9070,
    description: "Auto body shop specializing in collision repair and paint jobs.",
    services: ["Body Repair", "Paint Job", "Dent Removal"],
    hours: "Mon–Fri, 9:00 AM – 5:00 PM",
    phone: "+63 917 567 8901",
    vehicleTypes: ["Sedan", "SUV", "Pickup", "Van"],
    reviews: [
      {
        id: "p5-r1",
        customerName: "Grace M.",
        rating: 4,
        comment: "Paint job looked brand new after the collision.",
        date: "1 week ago",
      },
      {
        id: "p5-r2",
        customerName: "Dennis A.",
        rating: 4,
        comment: "Took a bit longer than quoted, but quality work.",
        date: "3 weeks ago",
      },
    ],
  },
  {
    id: "p6",
    name: "Cebu Onsite Mechanics",
    category: "Onsite Mechanics",
    rating: 4.6,
    reviewCount: 120,
    distanceKm: 1.5,
    startingPrice: "₱400",
    isPositiveStatus: true,
    initials: "CM",
    color: "#6A1B9A",
    lat: 10.3225,
    lng: 123.9060,
    description: "Onsite mechanic team that comes to you for quick fixes and inspections.",
    services: ["Battery Jumpstart", "Vehicle Inspection", "Belt & Hose Repair"],
    hours: "Daily, 6:00 AM – 10:00 PM",
    phone: "+63 917 678 9012",
    vehicleTypes: ["Sedan", "SUV", "Pickup", "Motorcycle"],
    reviews: [
      {
        id: "p6-r1",
        customerName: "Liza N.",
        rating: 5,
        comment: "Inspected my car quickly and explained everything clearly.",
        date: "2 days ago",
      },
      {
        id: "p6-r2",
        customerName: "Tommy B.",
        rating: 4,
        comment: "Reliable team, will book again.",
        date: "2 weeks ago",
      },
    ],
  },
  {
    id: "p7",
    name: "TirePro Auto Shop",
    category: "Auto Shops",
    rating: 4.3,
    reviewCount: 89,
    distanceKm: 1.9,
    startingPrice: "₱350",
    isPositiveStatus: true,
    initials: "TP",
    color: "#2E7D32",
    lat: 10.3210,
    lng: 123.9110,
    description: "Tire specialists offering fitting, balancing, and alignment services.",
    services: ["Tire Replacement", "Wheel Alignment", "Tire Balancing"],
    hours: "Mon–Sun, 8:00 AM – 7:00 PM",
    phone: "+63 917 789 0123",
    vehicleTypes: ["Sedan", "SUV", "Pickup", "Van", "Motorcycle"],
    reviews: [
      {
        id: "p7-r1",
        customerName: "Ben O.",
        rating: 4,
        comment: "Fast tire replacement, good pricing.",
        date: "3 days ago",
      },
      {
        id: "p7-r2",
        customerName: "Sheryl K.",
        rating: 4,
        comment: "Alignment fixed the pulling issue perfectly.",
        date: "1 week ago",
      },
    ],
  },
  {
    id: "p8",
    name: "Quick Rescue Mechanics",
    category: "Onsite Mechanics",
    rating: 4.9,
    reviewCount: 76,
    distanceKm: 3.0,
    startingPrice: "₱600",
    isPositiveStatus: false,
    initials: "QR",
    color: "#6A1B9A",
    lat: 10.3160,
    lng: 123.9105,
    description: "On-demand mechanics for quick roadside fixes and vehicle checkups.",
    services: ["Roadside Assistance", "Fuel Delivery", "Minor Engine Repair"],
    hours: "Daily, 7:00 AM – 11:00 PM",
    phone: "+63 917 890 1234",
    vehicleTypes: ["Sedan", "SUV", "Motorcycle"],
    reviews: [
      {
        id: "p8-r1",
        customerName: "Fritz L.",
        rating: 5,
        comment: "Saved me on the highway with a fuel delivery.",
        date: "5 days ago",
      },
      {
        id: "p8-r2",
        customerName: "Nina D.",
        rating: 5,
        comment: "Quick and courteous service.",
        date: "1 month ago",
      },
    ],
  },
  {
    id: "p9",
    name: "MotoFix Rescue",
    category: "Onsite Mechanics",
    rating: 4.7,
    reviewCount: 54,
    distanceKm: 1.4,
    startingPrice: "₱300",
    isPositiveStatus: true,
    initials: "MF",
    color: "#F57C00",
    lat: 10.3188,
    lng: 123.9048,
    description: "Motorcycle-only onsite mechanic specializing in roadside repairs for riders.",
    services: ["Chain Adjustment", "Battery Jumpstart", "Minor Engine Repair"],
    hours: "Daily, 6:00 AM – 10:00 PM",
    phone: "+63 917 901 2345",
    vehicleTypes: ["Motorcycle"],
    reviews: [
      {
        id: "p9-r1",
        customerName: "Kevin S.",
        rating: 5,
        comment: "Knows motorcycles inside out, fixed my chain in no time.",
        date: "3 days ago",
      },
      {
        id: "p9-r2",
        customerName: "Bea T.",
        rating: 4,
        comment: "Fast onsite response for a dead battery.",
        date: "1 week ago",
      },
    ],
  },
];

export const MOCK_LOCATION_LABEL = "Cebu Business Park, Cebu City";
export const MOCK_USER_NAME = "Miguel";
