/**
 * Unit tests for cv-claude-fallback.ts.
 *
 * Runner-agnostic, matching the convention in cv-render.test.ts:
 *   - vitest / jest pick describe/it/expect up directly
 *   - the harness below makes them executable via `node --test` too,
 *     because no test runner is currently configured in package.json
 *
 * Tests inject a mock `fetch` via the options bag, so they never hit
 * the network and never read `import.meta.env`.
 */

import { describe, it, expect } from "vitest";
import {
  callTailorGateway,
  GatewayError,
  type TailorResponse,
} from "./cv-claude-fallback";

const FAKE_URL = "https://fake-gateway.example";

/** Build a Response-shaped object usable with the fetch contract. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("callTailorGateway", () => {
  // ── 1. happy path: correct URL + body shape ─────────────────────────
  it("POSTs to ${gatewayUrl}/tailor with the request body as JSON", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fakeFetch: typeof fetch = async (input, init) => {
      capturedUrl = typeof input === "string" ? input : (input as Request).url;
      capturedInit = init;
      const payload: TailorResponse = {
        tailoredSummary: "S",
        tailoredRoles: [{ roleId: "r1", bullets: ["b"] }],
        model: "claude-sonnet-4-6",
        cached: false,
        elapsedMs: 42,
      };
      return jsonResponse(200, payload);
    };

    const out = await callTailorGateway(
      { audience: "cto", jdText: "JD", archiveContext: "AC" },
      { fetchImpl: fakeFetch, gatewayUrl: FAKE_URL },
    );

    expect(capturedUrl).toBe(`${FAKE_URL}/tailor`);
    expect(capturedInit?.method).toBe("POST");
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      audience: "cto",
      jdText: "JD",
      archiveContext: "AC",
    });
    expect(out.tailoredSummary).toBe("S");
    expect(out.tailoredRoles[0].bullets).toEqual(["b"]);
  });

  // ── 2. 429 surfaces as GatewayError with .status === 429 ───────────
  it("surfaces a 429 as GatewayError(status=429)", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response("rate limited", { status: 429 });

    let caught: unknown;
    try {
      await callTailorGateway(
        { audience: "cto", jdText: "JD", archiveContext: "" },
        { fetchImpl: fakeFetch, gatewayUrl: FAKE_URL },
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GatewayError);
    expect((caught as GatewayError).status).toBe(429);
  });

  // ── 3. 502 triggers fallback semantics ─────────────────────────────
  it("surfaces a 502 as GatewayError(status=502) so the caller can fall through", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response("upstream down", { status: 502 });

    let caught: unknown;
    try {
      await callTailorGateway(
        { audience: "cto", jdText: "JD", archiveContext: "" },
        { fetchImpl: fakeFetch, gatewayUrl: FAKE_URL },
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GatewayError);
    expect((caught as GatewayError).status).toBe(502);
    // The caller (JdPasteInput) checks .status === 502 to switch to
    // archive-only mode; that contract is preserved here.
  });

  // ── 4. abort signal cancels the request ────────────────────────────
  it("aborts when the passed AbortSignal fires", async () => {
    const controller = new AbortController();

    const fakeFetch: typeof fetch = (_input, init) => {
      // Mirror the real fetch: reject with AbortError as soon as the
      // signal aborts.
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    };

    const promise = callTailorGateway(
      { audience: "cto", jdText: "JD", archiveContext: "" },
      { fetchImpl: fakeFetch, gatewayUrl: FAKE_URL, signal: controller.signal },
    );

    controller.abort();

    let caught: unknown;
    try {
      await promise;
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).name).toBe("AbortError");
  });
});
