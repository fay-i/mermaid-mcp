/**
 * Minimal in-process S3 stand-in: path-style PUT stores bytes, GET returns
 * them (signature and expiry are not checked).
 */

import http from "node:http";

export interface FakeObjectStore {
  endpoint: string;
  objects: Map<string, Buffer>;
  close(): Promise<void>;
}

export function startFakeObjectStore(): Promise<FakeObjectStore> {
  const objects = new Map<string, Buffer>();
  const server = http.createServer(async (req, res) => {
    const key = new URL(req.url ?? "/", "http://localhost").pathname;
    if (req.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      objects.set(key, Buffer.concat(chunks));
      res.writeHead(200, { ETag: '"fake"' }).end();
      return;
    }
    const body = objects.get(key);
    if (req.method === "GET" && body) {
      res.writeHead(200).end(body);
      return;
    }
    res.writeHead(404).end();
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        endpoint: `http://127.0.0.1:${port}`,
        objects,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
