export const COMPLAINT_CATEGORIES = [
  "Behavior or safety concern",
  "Service quality",
  "Price or payment dispute",
  "Property or vehicle damage",
  "No-show or delay",
  "Other",
] as const;

export type ComplaintCategory = typeof COMPLAINT_CATEGORIES[number];
export type ComplaintService = "onsite-mechanic" | "towing-company" | "shop-owner" | "homegarage";
export type ComplaintStatus = "Pending" | "Under Review" | "Resolved" | "Dismissed";

export interface ComplaintBooking {
  id: string;
  bookingType: ComplaintService;
  customerId: string;
  customerName?: string;
  providerId: string;
  providerName?: string;
  status: string;
  completedAt?: string | { toDate?: () => Date };
  vehicle?: string;
  problem?: string;
}
