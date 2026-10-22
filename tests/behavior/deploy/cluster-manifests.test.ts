/**
 * B024: The committed cluster manifests deploy the working server as-is:
 * S3 settings from the existing secret, no missing pull secret, no SSE
 * naming, probes on /health, and the Service keeping 8100 -> 8000.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface Container {
  ports: { containerPort: number; name?: string }[];
  envFrom?: { secretRef?: { name: string } }[];
  livenessProbe: { httpGet: { path: string; port: number } };
  readinessProbe: { httpGet: { path: string; port: number } };
}

interface Deployment {
  spec: {
    template: {
      spec: { imagePullSecrets?: unknown; containers: Container[] };
    };
  };
}

interface Service {
  spec: { ports: { port: number; targetPort: number; name?: string }[] };
}

const deployment: Deployment = parse(
  readFileSync("k8s/deployment.yaml", "utf8"),
);
const service: Service = parse(readFileSync("k8s/service.yaml", "utf8"));
const podSpec = deployment.spec.template.spec;
const container = podSpec.containers[0];

describe("cluster manifests", () => {
  it("loads environment from the mermaid-s3-credentials secret by name", () => {
    expect(container.envFrom).toContainEqual({
      secretRef: { name: "mermaid-s3-credentials" },
    });
  });

  it("references no image pull secret", () => {
    expect(podSpec.imagePullSecrets).toBeUndefined();
  });

  it("names no port sse", () => {
    const names = [
      ...container.ports.map((port) => port.name),
      ...service.spec.ports.map((port) => port.name),
    ];
    expect(names).not.toContain("sse");
  });

  it("probes /health on container port 8000", () => {
    expect(container.ports.map((port) => port.containerPort)).toContain(8000);
    for (const probe of [container.livenessProbe, container.readinessProbe]) {
      expect(probe.httpGet).toEqual({ path: "/health", port: 8000 });
    }
  });

  it("keeps the Service mapping 8100 to 8000", () => {
    expect(service.spec.ports).toContainEqual(
      expect.objectContaining({ port: 8100, targetPort: 8000 }),
    );
  });
});
