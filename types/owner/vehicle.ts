export const VEHICLE_TYPES = ["Car", "SUV", "Pickup Truck", "Van", "Motorcycle", "Truck"] as const;

export type SavedVehicleType = (typeof VEHICLE_TYPES)[number];

export interface SavedVehicle {
  vehicleId: string;
  type: SavedVehicleType;
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  createdAt: string;
  updatedAt: string;
}

export type SavedVehicleInput = Pick<SavedVehicle, "type" | "make" | "model" | "year" | "color" | "plateNumber">;
