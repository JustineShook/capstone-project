export type ParkingBookingStatus = "reserved" | "active" | "completed" | "cancelled";

export interface ParkingBooking {
  id: string;
  providerId: string;
  providerName: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehicle: string;
  vehiclePlate: string;
  vehicleType: string;
  slotId: string;
  slotNumber: number;
  notes: string;
  status: ParkingBookingStatus;
  bookedAt: string;
  parkingStartedAt?: string;
  parkingEndedAt?: string;
  updatedAt: string;
}
