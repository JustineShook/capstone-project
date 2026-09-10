import type { BookingRequest } from "./owner/booking";

export const SHOP_STATUS_FLOW = [
  "pending", "accepted", "vehicle_arrived", "diagnosing", "repairing", "completed",
] as const;

export type ShopBookingStatus = typeof SHOP_STATUS_FLOW[number] | "rejected" | "cancelled";
export type ShopBookingRequest = Omit<BookingRequest, "bookingType" | "status"> & {
  bookingType: "shop-owner";
  status: ShopBookingStatus;
  // Public shop location captured at booking time, available even if a listing is removed.
  shopLatitude?: number;
  shopLongitude?: number;
  shopAreaLabel?: string;
};

export const SHOP_STATUS_LABELS: Record<ShopBookingStatus, string> = {
  pending: "Pending", accepted: "Accepted", vehicle_arrived: "Vehicle Arrived",
  diagnosing: "Diagnosing", repairing: "Repairing", completed: "Completed",
  rejected: "Rejected", cancelled: "Cancelled",
};

export const SHOP_TRANSITIONS: Partial<Record<ShopBookingStatus, readonly ShopBookingStatus[]>> = {
  pending: ["accepted", "rejected"],
  accepted: ["vehicle_arrived"],
  vehicle_arrived: ["diagnosing"],
  diagnosing: ["repairing"],
  repairing: ["completed"],
};

export function isActiveShopService(status: ShopBookingStatus): boolean {
  return status === "accepted" || status === "vehicle_arrived" || status === "diagnosing" || status === "repairing";
}
