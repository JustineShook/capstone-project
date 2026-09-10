export interface TowingPricingConfig {
  basePrice: number;
  pricePerKm: number;
  createdAt?: string;
  updatedAt?: string;
}

export type TowingPricingConfigInput = Pick<
  TowingPricingConfig,
  "basePrice" | "pricePerKm"
>;
