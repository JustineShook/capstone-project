// constants/mockServiceHistory.ts
// Mock service history data for UI/mockup purposes only — no Firebase/Firestore yet.

export interface MockServiceRecord {
  id: string;
  vehicleId: string;
  service: string;
  provider: string;
  date: string;
  status: "Completed" | "Cancelled";
  price: number;
}

export const MOCK_SERVICE_HISTORY: MockServiceRecord[] = [
  // v1 — Toyota Vios "Daily"
  {
    id: "s1",
    vehicleId: "v1",
    service: "Oil Change",
    provider: "QuickLube Express",
    date: "Aug 12, 2026",
    status: "Completed",
    price: 1500,
  },
  {
    id: "s2",
    vehicleId: "v1",
    service: "Brake Pad Replacement",
    provider: "Cebu Auto Care Center",
    date: "May 3, 2026",
    status: "Completed",
    price: 2800,
  },
  {
    id: "s3",
    vehicleId: "v1",
    service: "Aircon Repair",
    provider: "Cebu Auto Care Center",
    date: "Feb 18, 2026",
    status: "Cancelled",
    price: 0,
  },

  // v2 — Honda Civic "Weekend Ride"
  {
    id: "s4",
    vehicleId: "v2",
    service: "Brake Repair",
    provider: "Mendez Auto Body & Repair",
    date: "Jul 22, 2026",
    status: "Completed",
    price: 3200,
  },
  {
    id: "s5",
    vehicleId: "v2",
    service: "Wheel Alignment",
    provider: "TirePro Auto Shop",
    date: "Apr 9, 2026",
    status: "Completed",
    price: 900,
  },

  // v3 — Honda Click 160 "Errand Bike"
  {
    id: "s6",
    vehicleId: "v3",
    service: "Chain & Sprocket Replacement",
    provider: "Quick Rescue Mechanics",
    date: "Aug 3, 2026",
    status: "Completed",
    price: 1200,
  },
  {
    id: "s7",
    vehicleId: "v3",
    service: "Battery Jumpstart",
    provider: "Juan's Mobile Auto Repair",
    date: "Jun 15, 2026",
    status: "Completed",
    price: 500,
  },

  // v4 — Mitsubishi Montero Sport "Family SUV"
  {
    id: "s8",
    vehicleId: "v4",
    service: "Tire Rotation",
    provider: "TirePro Auto Shop",
    date: "Jun 30, 2026",
    status: "Completed",
    price: 700,
  },
  {
    id: "s9",
    vehicleId: "v4",
    service: "Full Engine Diagnostics",
    provider: "Cebu Auto Care Center",
    date: "Mar 11, 2026",
    status: "Completed",
    price: 1800,
  },

  // v5 — Toyota Hiace "Cargo Van"
  {
    id: "s10",
    vehicleId: "v5",
    service: "Engine Check",
    provider: "Cebu Onsite Mechanics",
    date: "May 18, 2026",
    status: "Completed",
    price: 2200,
  },
  {
    id: "s11",
    vehicleId: "v5",
    service: "Towing — Engine Stall",
    provider: "24/7 Rescue Towing",
    date: "Jan 27, 2026",
    status: "Completed",
    price: 1000,
  },

  // v6 — Isuzu D-Max
  {
    id: "s12",
    vehicleId: "v6",
    service: "Battery Replacement",
    provider: "RoadGuard Towing",
    date: "Aug 6, 2026",
    status: "Completed",
    price: 4500,
  },
  {
    id: "s13",
    vehicleId: "v6",
    service: "Suspension Check",
    provider: "Mendez Auto Body & Repair",
    date: "Feb 2, 2026",
    status: "Cancelled",
    price: 0,
  },
];