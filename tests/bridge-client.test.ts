import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import net from "node:net";
import { BridgeClient } from "../src/mcp/bridge-client.js";
import { createToolResponse, createToolErrorMessage, createHeartbeatMessage } from "../src/shared/protocol.js";

describe("BridgeClient", () => {
  let server: net.Server;
  let port: number;

  beforeEach(async () => {
    // Create a mock TCP server
    server = net.createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(() => {
    server.close();
  });

  it("connects to TCP server", async () => {
    const client = new BridgeClient(port);
    const connected = vi.fn();
    client.on("connected", connected);

    await client.connect();
    expect(connected).toHaveBeenCalled();

    client.disconnect();
  });

  it("receives tool responses", async () => {
    const client = new BridgeClient(port);

    // Handle incoming connections on mock server
    server.on("connection", (socket) => {
      socket.on("data", (data) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          const msg = JSON.parse(line);
          if (msg.type === "tool_request") {
            // Send response back
            const response = createToolResponse(msg.id, msg.tool, { result: "ok" });
            socket.write(JSON.stringify(response) + "\n");
          }
        }
      });
    });

    await client.connect();

    const result = await client.callTool("list_tabs", {});
    expect(result).toEqual({ result: "ok" });

    client.disconnect();
  });

  it("handles tool errors", async () => {
    const client = new BridgeClient(port);

    server.on("connection", (socket) => {
      socket.on("data", (data) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          const msg = JSON.parse(line);
          if (msg.type === "tool_request") {
            const error = createToolErrorMessage(msg.id, msg.tool, "Tool failed");
            socket.write(JSON.stringify(error) + "\n");
          }
        }
      });
    });

    await client.connect();

    await expect(client.callTool("click", { tab_id: 1 })).rejects.toThrow("Tool failed");

    client.disconnect();
  });

  it("times out on no response", async () => {
    const client = new BridgeClient(port);

    // Don't send any response
    server.on("connection", () => {
      // Just accept connection, don't respond
    });

    await client.connect();

    await expect(
      client.callTool("list_tabs", {}, 100) // 100ms timeout
    ).rejects.toThrow(/timed out/);

    client.disconnect();
  });

  it("handles disconnect gracefully", async () => {
    const client = new BridgeClient(port);
    const disconnected = vi.fn();
    client.on("disconnected", disconnected);

    await client.connect();
    expect(disconnected).not.toHaveBeenCalled();

    client.disconnect();
    // Note: disconnect() sets destroyed=true, so reconnect won't happen
  });

  it("emits error on connection failure", async () => {
    const client = new BridgeClient(99999); // Invalid port

    await expect(client.connect()).rejects.toThrow();
  });
});
