import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { infraiFromEnvironment, InfraiError } from "./infrai_client.js";
import {
  completeDomainOnboarding,
  DomainProofPending,
  startDomainOnboarding,
} from "./order_workflow.js";

const client = infraiFromEnvironment();

function reply(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

createServer(async (request, response) => {
  try {
    if (request.method !== "POST") return reply(response, 405, { error: "method_not_allowed" });
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    if (request.url === "/onboarding/domain/start") {
      return reply(response, 201, await startDomainOnboarding(client, body));
    }
    if (request.url === "/onboarding/domain/complete") {
      return reply(response, 200, await completeDomainOnboarding(client, body));
    }
    return reply(response, 404, { error: "not_found" });
  } catch (error) {
    if (error instanceof ZodError) return reply(response, 400, { error: "invalid_request", issues: error.issues });
    if (error instanceof DomainProofPending) return reply(response, 409, { error: "domain_proof_pending", domain: error.domain });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return reply(response, status, { error: error.code, details: error.details });
    }
    return reply(response, 500, { error: "internal_error" });
  }
}).listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Domain onboarding listening on http://localhost:${process.env.PORT ?? 3000}`);
});
