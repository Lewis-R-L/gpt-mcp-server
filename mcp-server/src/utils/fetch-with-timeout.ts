export type FetchWithTimeoutOptions = RequestInit & {
  timeoutMs?: number;
};

/**
 * Node18+ fetch + AbortController timeout wrapper.
 * This prevents MCP requests from hanging until the client transport times out (UND_ERR_HEADERS_TIMEOUT / -32001).
 */
export async function fetchWithTimeout(url: string, options: FetchWithTimeoutOptions = {}) {
  const { timeoutMs = Number(process.env.ITALKI_FETCH_TIMEOUT_MS ?? 12000), ...init } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}


