import { completeDomainOnboarding } from "./order_workflow.js";
import { infraiFromEnvironment } from "./infrai_client.js";

const result = await completeDomainOnboarding(infraiFromEnvironment(), {
  domain: process.env.STORE_DOMAIN,
  onboardingId: process.env.ONBOARDING_ID,
  customerEmail: process.env.CUSTOMER_EMAIL,
  checkout: { orderId: "order_demo_001", currency: "USD", totalMinor: 4200 },
});

console.log(result);
