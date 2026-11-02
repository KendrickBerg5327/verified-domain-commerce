import { describe, expect, it, vi } from "vitest";
import { completeDomainOnboarding, DomainProofPending } from "../src/order_workflow.js";

const request = {
  domain: "shop.example.com",
  onboardingId: "7edda444-5da7-4c73-973b-c8809e3fdd62",
  customerEmail: "owner@example.com",
  checkout: { orderId: "order_17", currency: "USD", totalMinor: 4200 },
};

describe("domain-gated checkout", () => {
  it("does not resolve the customer or accept checkout before TXT proof", async () => {
    const client = {
      verifyDomain: vi.fn().mockResolvedValue({ verified: false }),
      getUserByEmail: vi.fn(),
    };

    await expect(completeDomainOnboarding(client as never, request)).rejects.toBeInstanceOf(DomainProofPending);
    expect(client.getUserByEmail).not.toHaveBeenCalled();
  });

  it("opens the order lifecycle and resolves the customer after proof", async () => {
    const client = {
      verifyDomain: vi.fn().mockResolvedValue({ verified: true }),
      getUserByEmail: vi.fn().mockResolvedValue({ id: "user_42", email: request.customerEmail }),
    };

    await expect(completeDomainOnboarding(client as never, request)).resolves.toEqual({
      orderId: "order_17",
      customerUserId: "user_42",
      checkout: "accepted",
      fulfillment: "pending",
      receipt: "queued",
      customerUpdate: "order_confirmed",
    });
  });
});
