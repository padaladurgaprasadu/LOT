import https from "node:https";

/**
 * High-Performance Persistent HTTPS Agent for LOT AI
 * Maintains a persistent TLS 1.3 socket pool to eliminate
 * TCP SYN + TLS handshake latency (~300ms overhead saved per request).
 */
export const persistentHttpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 64,
  maxFreeSockets: 32,
  timeout: 30000,
});
