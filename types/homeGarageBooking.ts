import type { BookingTimingFields } from "./bookingTiming";

export type HomeGarageBookingStatus = "pending" | "accepted" | "vehicle_arrived" | "diagnosing" | "repairing" | "in_progress" | "rejected" | "completed" | "cancelled";

export interface HomeGarageBooking extends BookingTimingFields {
  cancellationReason?: string;
  declineReason?: string;
  id: string;
  bookingType: "homegarage";
  providerId: string;
  providerName: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  vehicleId: string;
  vehicle: string;
  vehicleYear: number;
  vehiclePlate: string;
  problem: string;
  notes: string;
  garageLatitude: number;
  garageLongitude: number;
  serviceAreaLabel: string;
  startingPrice: string;
  assessmentPrice?: number;
  finalPrice?: number;
  status: HomeGarageBookingStatus;
  completionNote?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
