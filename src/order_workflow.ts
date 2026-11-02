import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

export const startOnboardingBody = z.object({
  domain: z.string().min(3).toLowerCase(),
  onboardingId: z.string().uuid(),
  txt: z.object({
    name: z.string().min(1),
    content: z.string().min(1),
  }).strict(),
}).strict();

export const completeOnboardingBody = z.object({
  domain: z.string().min(3).toLowerCase(),
  onboardingId: z.string().uuid(),
  customerEmail: z.string().email(),
  checkout: z.object({
    orderId: z.string().min(1),
    currency: z.string().length(3).toUpperCase(),
    totalMinor: z.number().int().positive(),
  }).strict(),
}).strict();

export type CommerceOrder = {
  orderId: string;
  customerUserId: string;
  checkout: "accepted";
  fulfillment: "pending";
  receipt: "queued";
  customerUpdate: "order_confirmed";
};

export async function startDomainOnboarding(
  client: InfraiClient,
  raw: unknown,
) {
  const body = startOnboardingBody.parse(raw);
  const domain = await client.addDomain({
    domain: body.domain,
    metadata: { onboarding_id: body.onboardingId },
  });
  const record = await client.createTxtRecord({
    zone_id: domain.zone_id,
    record_type: "TXT",
    name: body.txt.name,
    content: body.txt.content,
    record_id: body.onboardingId,
    metadata: { onboarding_id: body.onboardingId },
  });
  return { domain: body.domain, zoneId: domain.zone_id, txtRecord: record };
}

export async function completeDomainOnboarding(
  client: InfraiClient,
  raw: unknown,
): Promise<CommerceOrder> {
  const body = completeOnboardingBody.parse(raw);
  const verification = await client.verifyDomain(body.domain);
  if (!verification.verified) {
    throw new DomainProofPending(body.domain);
  }
  const user = await client.getUserByEmail(body.customerEmail);
  return {
    orderId: body.checkout.orderId,
    customerUserId: user.id,
    checkout: "accepted",
    fulfillment: "pending",
    receipt: "queued",
    customerUpdate: "order_confirmed",
  };
}

export class DomainProofPending extends Error {
  readonly domain: string;

  constructor(domain: string) {
    super(`TXT proof is pending for ${domain}`);
    this.domain = domain;
  }
}
