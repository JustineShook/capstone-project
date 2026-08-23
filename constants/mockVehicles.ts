// constants/mockVehicles.ts
// Mock vehicle data for UI/mockup purposes only — no Firebase/Firestore yet.
// Plate numbers and details below are fictional.

export interface MockVehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  plateNumber: string;
  color: string;
  vehicleType: "Motorcycle" | "Car" | "SUV" | "Van" | "Truck";
  nickname?: string;
  lastService?: string;
}

export const MOCK_VEHICLES: MockVehicle[] = [
  {
    id: "v1",
    brand: "Toyota",
    model: "Vios",
    year: 2022,
    plateNumber: "ABC 1234",
    color: "White",
    vehicleType: "Car",
    nickname: "Daily",
    lastService: "Oil Change — Aug 12, 2026",
  },
  {
    id: "v2",
    brand: "Honda",
    model: "Civic",
    year: 2020,
    plateNumber: "XYZ 5678",
    color: "Gray",
    vehicleType: "Car",
    nickname: "Weekend Ride",
    lastService: "Brake Repair — Jul 22, 2026",
  },
  {
    id: "v3",
    brand: "Honda",
    model: "Click 160",
    year: 2023,
    plateNumber: "NBC 8842",
    color: "Red",
    vehicleType: "Motorcycle",
    nickname: "Errand Bike",
    lastService: "Chain & Sprocket — Aug 3, 2026",
  },
  {
    id: "v4",
    brand: "Mitsubishi",
    model: "Montero Sport",
    year: 2021,
    plateNumber: "RFT 2291",
    color: "Black",
    vehicleType: "SUV",
    nickname: "Family SUV",
    lastService: "Tire Rotation — Jun 30, 2026",
  },
  {
    id: "v5",
    brand: "Toyota",
    model: "Hiace",
    year: 2019,
    plateNumber: "GHU 4471",
    color: "Silver",
    vehicleType: "Van",
    nickname: "Cargo Van",
    lastService: "Engine Check — May 18, 2026",
  },
  {
    id: "v6",
    brand: "Isuzu",
    model: "D-Max",
    year: 2023,
    plateNumber: "PLK 9903",
    color: "Blue",
    vehicleType: "Truck",
    lastService: "Battery Replacement — Aug 6, 2026",
  },
];