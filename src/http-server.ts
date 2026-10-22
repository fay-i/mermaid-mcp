/**
 * Streamable HTTP entry path: serves MCP at /mcp and a liveness probe at /health.
 */

import http from "node:http";

export interface HttpServerOptions {
  port: number;
}

export interface RunningHttpServer {
  port: number;
  close(): Promise<void>;
}

const MCP_PATH = "/mcp";
const HEALTH_PATH = "/health";
const MCP_METHODS = ["GET", "POST", "DELETE"];

function pathOf(req: http.IncomingMessage): string {
  return new URL(req.url ?? "/", "http://localhost").pathname;
}

function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  const path = pathOf(req);

  if (path === HEALTH_PATH) {
    res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
    return;
  }

  if (path === MCP_PATH && !MCP_METHODS.includes(req.method ?? "")) {
    res.writeHead(405, { Allow: MCP_METHODS.join(", ") }).end();
    return;
  }

  res.writeHead(404).end();
}

export function startHttpServer(
  options: HttpServerOptions,
): Promise<RunningHttpServer> {
  const server = http.createServer(handleRequest);

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, () => {
      const address = server.address();
      const port =
        typeof address === "object" && address ? address.port : options.port;
      resolve({
        port,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}
