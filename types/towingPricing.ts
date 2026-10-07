export interface TowingPricingConfig {
  basePrice: number;
  pricePerKm: number;
  pricingMode: "fixed" | "dispatcher";
  dispatcherPhone: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TowingPricingConfigInput = Pick<
  TowingPricingConfig,
  "basePrice" | "pricePerKm" | "pricingMode" | "dispatcherPhone"
>;
