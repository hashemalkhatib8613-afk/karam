/** Bound backend waits and retry transient reads once. Never replay mutations. */
export async function backendFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const attempts = method === "GET" || method === "HEAD" ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) abort();
    else callerSignal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("Backend request timed out")), 8000);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (attempt + 1 === attempts || ![502, 503, 504].includes(response.status)) return response;
      await response.body?.cancel();
    } catch (error) {
      if (callerSignal?.aborted || attempt + 1 === attempts) throw error;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", abort);
    }
  }
  throw new Error("Backend request failed");
}
