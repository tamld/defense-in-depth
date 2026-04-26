/**
 * DSPy HTTP stub helper for adversarial fallback tests.
 *
 * Instead of mocking `fetch`, tests use a real local HTTP server so the
 * `callDspy()` code path is exercised end-to-end — matching how DSPy
 * behaves in production (network, AbortController, JSON parse, timeouts).
 *
 * Modes:
 *   - "score"     : respond 200 with { score, feedback }
 *   - "500"       : respond 500 (server error)
 *   - "timeout"   : accept connection but never respond (client must abort)
 *   - "malformed" : respond 200 but body is not valid JSON
 *
 * Used by:
 *   - tests/hollow-artifact-dspy-fallback.test.js (issue #14)
 *   - tests/memory-dspy-gate.test.js (issue #14 scope update)
 *   - tests/cli-dry-run-dspy.test.js (issue #15) — indirectly via closed port
 *
 * Executor: Devin-AI
 */

import http from "node:http";

/**
 * Spin up a local DSPy stub server on an ephemeral port.
 *
 * @param {object} options
 * @param {"score"|"500"|"timeout"|"malformed"} [options.mode="score"]
 * @param {number} [options.score=0.8]
 * @param {string} [options.feedback="ok"]
 * @param {number} [options.status=200]
 * @returns {Promise<{ port: number, endpoint: string, requests: Array<object>, close: () => Promise<void> }>}
 */
export function createDspyStub(options = {}) {
  const {
    mode = "score",
    score = 0.8,
    feedback = "ok",
    status = 200,
  } = options;
  const requests = [];
  // Track sockets so timeout-mode tests can force-close pending connections
  // during afterEach. server.close() alone hangs on never-responded requests.
  const sockets = new Set();
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          requests.push({ url: req.url, method: req.method, body: JSON.parse(body || "null") });
        } catch {
          requests.push({ url: req.url, method: req.method, body });
        }
        switch (mode) {
          case "timeout":
            // Never respond — client AbortController must fire.
            return;
          case "500":
            res.writeHead(500, { "Content-Type": "text/plain" });
            return res.end("internal server error");
          case "malformed":
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end("not valid json{");
          case "score":
            res.writeHead(status, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ score, feedback }));
          default:
            // DEFENSIVE GUARD: unknown mode — fail loudly so test authors
            // catch typos immediately. Without this, unknown modes would
            // silently fall through to the healthy-score response, producing
            // false-passing tests (the stub responds 200 + score 0.8 even
            // though the test author intended a failure scenario).
            res.writeHead(500, { "Content-Type": "text/plain" });
            return res.end(
              `dspy-stub: unrecognised mode "${mode}". Valid: score | 500 | timeout | malformed`,
            );
        }
      });
      req.on("error", () => {});
    });
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    server.on("clientError", () => {});
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        port,
        endpoint: `http://127.0.0.1:${port}/evaluate`,
        requests,
        close: () =>
          new Promise((r) => {
            for (const socket of sockets) socket.destroy();
            sockets.clear();
            server.closeAllConnections?.();
            server.close(() => r());
          }),
      });
    });
  });
}

/**
 * Grab a port that is guaranteed to be closed (server shut down).
 * Callers use this for "DSPy unreachable" scenarios — any connection
 * attempt yields ECONNREFUSED.
 *
 * NOTE: technically there is a TOCTOU window between this function
 * returning the port and the test issuing a connect() to it — another
 * process on the same machine could theoretically bind the same
 * ephemeral port in that gap. In practice on CI runners and dev
 * machines this never happens because (a) the kernel does not hand
 * the same ephemeral port out twice in rapid succession, and (b) the
 * tests run within milliseconds of receiving the port. If you ever
 * see a flake here, switch to the inline `port = 1` pattern used in
 * tests/cli-dry-run-dspy.test.js.
 *
 * @returns {Promise<{ port: number, endpoint: string }>}
 */
export function getClosedPort() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => {
        resolve({ port, endpoint: `http://127.0.0.1:${port}/evaluate` });
      });
    });
  });
}
