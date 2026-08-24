/**
 * LOT APM & Request Tracer
 * Measures request hops, bottlenecks, Time to First Token (TTFT), and stream latency.
 */

export interface TraceMetric {
  requestId: string;
  endpoint: string;
  startTime: number;
  hops: { [key: string]: number };
  totalDurationMs?: number;
  ttftMs?: number;
}

export function createTracer(requestId: string, endpoint: string) {
  const startTime = Date.now();
  const hops: { [key: string]: number } = {};

  return {
    requestId,
    mark(step: string) {
      hops[step] = Date.now() - startTime;
    },
    end(extraInfo?: Record<string, any>) {
      const totalDurationMs = Date.now() - startTime;
      const trace: TraceMetric = {
        requestId,
        endpoint,
        startTime,
        hops,
        totalDurationMs,
        ...extraInfo,
      };

      // Asynchronous non-blocking logging outside the request path
      setImmediate(() => {
        if (totalDurationMs > 3000) {
          console.warn(`[APM SLOW TRACE] ${endpoint} took ${totalDurationMs}ms`, JSON.stringify(trace));
        } else {
          console.log(`[APM TRACE] ${endpoint} completed in ${totalDurationMs}ms (TTFT: ${trace.ttftMs || "N/A"}ms)`);
        }
      });

      return trace;
    },
  };
}
