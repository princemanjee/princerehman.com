/**
 * cv-claude-fallback — client-side caller for the CV gateway.
 *
 * The princerehman.com Adaptive CV has two "tailor for this JD" paths:
 *
 *   1. Archive match (Agent C's cv-archive-match.ts) — closest already-
 *      tailored resume from the archive. Runs entirely client-side, no
 *      network call, instant.
 *
 *   2. THIS path: live tailoring via the Anthropic API, brokered by the
 *      Cloudflare Worker at `PUBLIC_CV_GATEWAY_URL`. Slower and
 *      rate-limited, but produces a JD-specific output instead of a
 *      reference match.
 *
 * The UI invokes path 2 first; on 502 (gateway/Anthropic down) or
 * 429 (rate-limited) it falls back to path 1. That contract lives in
 * the consuming component (`JdPasteInput.astro`); this module just
 * surfaces the right error shape so the caller can branch on it.
 *
 * `fetchImpl` is injectable so tests can run without a network or env
 * var. In production it defaults to the global `fetch`.
 */

export interface TailorRequest {
  /** Audience key from cvAudienceTags.ts ("cto", "recruiter", etc). */
  audience: string;
  /** Raw pasted job description text. */
  jdText: string;
  /**
   * 1-3 archived tailored resumes (concatenated string), passed as
   * few-shot reference. May be empty.
   */
  archiveContext: string;
}

export interface TailorResponseRole {
  roleId: string;
  bullets: string[];
}

export interface TailorResponse {
  tailoredSummary: string;
  tailoredRoles: TailorResponseRole[];
  model: string;
  cached: boolean;
  elapsedMs: number;
}

/**
 * Error thrown by `callTailorGateway` for any non-2xx response or
 * network failure. `.status` and `.body` give the caller enough to
 * branch (e.g. 429 → show "try again later", 502 → fall through to
 * archive-only).
 */
export class GatewayError extends Error {
  public readonly status: number;
  public readonly body: string;

  constructor(status: number, body: string, message?: string) {
    super(message ?? `Gateway error ${status}: ${body}`);
    this.name = "GatewayError";
    this.status = status;
    this.body = body;
  }
}

/** Options bag, primarily for test injection. */
export interface CallTailorGatewayOptions {
  signal?: AbortSignal;
  /** Override the global `fetch`. Used by tests. */
  fetchImpl?: typeof fetch;
  /** Override the gateway URL. Used by tests. */
  gatewayUrl?: string;
}

/**
 * Resolve the gateway URL from Astro's `import.meta.env`.
 *
 * Wrapped in a function (not a top-level constant) so the module
 * doesn't throw at import time when `PUBLIC_CV_GATEWAY_URL` is unset
 * during SSR builds. The throw only happens at call time, which is
 * what we want — the JdPasteInput component imports this module
 * dynamically and can show a graceful error.
 */
function readGatewayUrl(): string {
  // Reason: defensive read. `import.meta.env` works in Astro at build
  // time AND at runtime in the client bundle. In non-Astro contexts
  // (tests) it may be undefined, which is why callers can pass
  // `gatewayUrl` directly.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env;
  const url = env?.PUBLIC_CV_GATEWAY_URL;
  if (!url) {
    throw new Error(
      "PUBLIC_CV_GATEWAY_URL is not set. Configure it in .env (see gateway/README.md).",
    );
  }
  return url;
}

/**
 * POST a tailor request to the gateway and return the parsed response.
 *
 * Surfaces `GatewayError` for any non-2xx. Aborts cleanly when the
 * passed `signal` fires (the underlying `fetch` rejects with an
 * AbortError, which we re-throw unchanged so the caller can detect it
 * via `err.name === "AbortError"`).
 */
export async function callTailorGateway(
  req: TailorRequest,
  optionsOrSignal?: AbortSignal | CallTailorGatewayOptions,
): Promise<TailorResponse> {
  // Allow both the legacy 2-arg form `(req, signal)` and the
  // structured options form so test code can inject fetch without
  // monkey-patching globals.
  const opts: CallTailorGatewayOptions =
    optionsOrSignal instanceof AbortSignal
      ? { signal: optionsOrSignal }
      : (optionsOrSignal ?? {});

  const fetchImpl = opts.fetchImpl ?? fetch;
  const gatewayUrl = opts.gatewayUrl ?? readGatewayUrl();

  const endpoint = `${gatewayUrl.replace(/\/$/, "")}/tailor`;

  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await safeText(res);
    if (res.status === 429) {
      throw new GatewayError(
        429,
        text,
        "Rate limit reached. Try again in an hour, or use the closest archive match instead.",
      );
    }
    if (res.status === 502) {
      throw new GatewayError(
        502,
        text,
        "Tailoring service is temporarily unreachable. Falling back to archive match.",
      );
    }
    if (res.status === 400) {
      throw new GatewayError(400, text, `Bad request: ${text}`);
    }
    throw new GatewayError(res.status, text);
  }

  let payload: TailorResponse;
  try {
    payload = (await res.json()) as TailorResponse;
  } catch (err) {
    throw new GatewayError(
      502,
      String((err as Error).message),
      "Gateway returned malformed JSON.",
    );
  }
  return payload;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
