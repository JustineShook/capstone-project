// constants/mockHistory.ts

export interface MockHistory {
  id: string;
  vehicleId: string;
  vehicleName: string;
  plateNumber: string;
  serviceType: "Towing" | "Onsite Mechanic";
  serviceName: string;
  providerName: string;
  providerRating: number;
  date: string; // e.g. "Aug 15, 2026 · 10:30 AM"
  status: "Completed" | "Cancelled";
  price: number;
}

export const MOCK_HISTORY: MockHistory[] = [
  {
    id: "h1",
    vehicleId: "v1",
    vehicleName: "Toyota Vios (Red)",
    plateNumber: "ABC 1234",
    serviceType: "Towing",
    serviceName: "Flatbed Towing",
    providerName: "24/7 Rescue Towing",
    providerRating: 4.9,
    date: "Aug 15, 2026 · 10:30 AM",
    status: "Completed",
    price: 1200,
  },
  {
    id: "h2",
    vehicleId: "v2",
    vehicleName: "Honda Civic (Black)",
    plateNumber: "XYZ 5678",
    serviceType: "Onsite Mechanic",
    serviceName: "Battery Replacement",
    providerName: "Juan's Mobile Auto Repair",
    providerRating: 4.9,
    date: "Aug 10, 2026 · 2:15 PM",
    status: "Completed",
    price: 850,
  },
  {
    id: "h3",
    vehicleId: "v1",
    vehicleName: "Toyota Vios (Red)",
    plateNumber: "ABC 1234",
    serviceType: "Onsite Mechanic",
    serviceName: "Overheating Diagnosis",
    providerName: "Cebu Onsite Mechanics",
    providerRating: 4.6,
    date: "Jul 28, 2026 · 9:00 AM",
    status: "Completed",
    price: 650,
  },
  {
    id: "h4",
    vehicleId: "v3",
    vehicleName: "Ford Ranger (White)",
    plateNumber: "DEF 4321",
    serviceType: "Towing",
    serviceName: "Accident Recovery",
    providerName: "RoadGuard Towing",
    providerRating: 4.8,
    date: "Jul 19, 2026 · 6:45 PM",
    status: "Cancelled",
    price: 0,
  },
  {
    id: "h5",
    vehicleId: "v2",
    vehicleName: "Honda Civic (Black)",
    plateNumber: "XYZ 5678",
    serviceType: "Towing",
    serviceName: "Wheel-Lift Towing",
    providerName: "RoadGuard Towing",
    providerRating: 4.8,
    date: "Jul 02, 2026 · 8:20 AM",
    status: "Completed",
    price: 1350,
  },
  {
    id: "h6",
    vehicleId: "v1",
    vehicleName: "Toyota Vios (Red)",
    plateNumber: "ABC 1234",
    serviceType: "Onsite Mechanic",
    serviceName: "Brake Adjustment",
    providerName: "Quick Rescue Mechanics",
    providerRating: 4.9,
    date: "Jun 24, 2026 · 4:00 PM",
    status: "Completed",
    price: 700,
  },
];