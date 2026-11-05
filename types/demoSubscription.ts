export type DemoSubscriptionPlanId = "monthly" | "yearly";
export type DemoSubscriptionType = "activation" | "renewal";

export interface DemoSubscriptionPlan {
  id: DemoSubscriptionPlanId;
  label: string;
  amount: number;
  durationDays: 30 | 365;
}

export interface DemoSubscription {
  status: "active";
  plan: DemoSubscriptionPlanId;
  demoAmount: number;
  startedAt: Date;
  expiresAt: Date;
  lastTransactionId: string;
}

export interface DemoSubscriptionTransaction {
  id: string;
  providerId: string;
  transactionId: string;
  plan: DemoSubscriptionPlanId;
  demoAmount: number;
  durationDays: 30 | 365;
  type: DemoSubscriptionType;
  startedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  label: "demo_only";
}
