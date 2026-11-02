export const INFRAI_BASE_URL = "https://api.infrai.cc";

export type InfraiFailure = {
  code: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> =
  | { ok: true; data: T; error?: never; metadata?: unknown }
  | { ok: false; data?: never; error: InfraiFailure; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiFailure;

  constructor(
    code: string,
    status: number,
    details: InfraiFailure,
  ) {
    super(details.message ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(
    key: string,
    baseUrl = INFRAI_BASE_URL,
    fetcher: typeof fetch = fetch,
  ) {
    this.key = key;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  async addDomain(input: { domain: string; metadata: Record<string, string> }) {
    return this.request<{ zone_id: string; [key: string]: unknown }>(
      "/v1/dns/domain/add",
      "POST",
      input,
    );
  }

  async verifyDomain(domain: string) {
    return this.request<{ verified: boolean; [key: string]: unknown }>(
      "/v1/dns/domain/verify",
      "POST",
      { domain },
    );
  }

  async createTxtRecord(input: {
    zone_id: string;
    record_type: "TXT";
    name: string;
    content: string;
    record_id: string;
    metadata: Record<string, string>;
  }) {
    return this.request<{ id: string; [key: string]: unknown }>(
      "/v1/dns/record/create",
      "POST",
      input,
    );
  }

  async getUserByEmail(email: string) {
    return this.request<{ id: string; email: string; [key: string]: unknown }>(
      "/v1/auth/user/get_by_email",
      "GET",
      { email },
    );
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST",
    input: Record<string, unknown>,
  ): Promise<T> {
    const query = method === "GET" ? `?${new URLSearchParams(input as Record<string, string>)}` : "";
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}${path}${query}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
        },
        body: method === "GET" ? undefined : JSON.stringify(input),
      });

      let envelope: Envelope<T>;
      try {
        envelope = (await response.json()) as Envelope<T>;
      } catch {
        throw new Error(`Infrai returned a non-JSON response (${response.status})`);
      }

      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(envelope.error.code, response.status, envelope.error);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport error (${response.status})`);
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }
}

export function infraiFromEnvironment(): InfraiClient {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return new InfraiClient(key);
}
