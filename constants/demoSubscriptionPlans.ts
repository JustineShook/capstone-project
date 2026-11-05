import type { DemoSubscriptionPlan, DemoSubscriptionPlanId } from "../types/demoSubscription";

// Demo amounts are illustrative only; update the matching Firestore rule
// allowlist and Admin display tests if the amounts change.
export const DEMO_SUBSCRIPTION_PLANS: Record<DemoSubscriptionPlanId, DemoSubscriptionPlan> = {
  monthly: { id: "monthly", label: "Monthly demo plan", amount: 100, durationDays: 30 },
  yearly: { id: "yearly", label: "Yearly demo plan", amount: 1000, durationDays: 365 },
};

export function demoExpiryDate(planId: DemoSubscriptionPlanId, startedAt: Date): Date {
  return new Date(startedAt.getTime() + DEMO_SUBSCRIPTION_PLANS[planId].durationDays * 24 * 60 * 60 * 1000);
}
