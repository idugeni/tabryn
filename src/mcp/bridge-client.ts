/**
 * Tabryn Bridge Client
 *
 * TCP client that connects to the Bridge (Native Messaging Host).
 * The Bridge relays messages between this MCP server and the Chrome Extension.
 *
 * @module mcp/bridge-client
 */

import net from "node:net";
import { EventEmitter } from "node:events";
import {
  DEFAULT_PORT,
  TOOL_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY_MS,
} from "../shared/constants.js";
import { generateId, createToolRequest, deserializeMessage, serializeMessage } from "../shared/protocol.js";
import type { AnyMessage } from "../shared/types.js";
import { ConnectionError, ConnectionTimeoutError, ToolTimeoutError } from "../shared/errors.js";

// ─── Types ──────────────────────────────────────────────────────────

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ─── BridgeClient ───────────────────────────────────────────────────

export class BridgeClient extends EventEmitter {
  private port: number;
  private socket: net.Socket | null = null;
  private buffer = "";
  private pendingRequests = new Map<string, PendingRequest>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(port: number = DEFAULT_PORT) {
    super();
    this.port = port;
  }

  async connect(): Promise<void> {
    this.destroyed = false;
    return this.connectInternal();
  }

  private connectInternal(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.destroyed) {
        reject(new ConnectionError("Client destroyed"));
        return;
      }

      this.socket = new net.Socket();

      const connectTimeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new ConnectionTimeoutError());
      }, 10_000);

      this.socket.connect(this.port, "127.0.0.1", () => {
        clearTimeout(connectTimeout);
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit("connected");
        resolve();
      });

      this.socket.on("data", (chunk: Buffer) => {
        this.handleData(chunk);
      });

      this.socket.on("error", (err) => {
        clearTimeout(connectTimeout);
        this.emit("error", err);
        reject(new ConnectionError(err.message));
      });

      this.socket.on("close", () => {
        this.stopHeartbeat();
        this.socket = null;
        this.emit("disconnected");
        this.rejectAllPending("Connection closed");
        this.scheduleReconnect();
      });
    });
  }

  disconnect(): void {
    this.destroyed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.rejectAllPending("Client disconnected");
  }

  private handleData(chunk: Buffer): void {
    this.buffer += chunk.toString("utf-8");

    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.substring(0, newlineIdx).trim();
      this.buffer = this.buffer.substring(newlineIdx + 1);

      if (!line) continue;

      try {
        const msg = deserializeMessage(line);
        this.handleMessage(msg);
      } catch {
        // Skip malformed messages
      }
    }
  }

  private handleMessage(msg: AnyMessage): void {
    if (msg.type === "heartbeat") return;

    if (msg.type === "tool_response" || msg.type === "tool_error") {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.id);

        if (msg.type === "tool_error") {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    this.emit("message", msg);
  }

  async callTool(tool: string, args: Record<string, unknown>, timeoutMs = TOOL_TIMEOUT_MS): Promise<unknown> {
    if (!this.socket || this.socket.destroyed) {
      throw new ConnectionError("Not connected to bridge");
    }

    const request = createToolRequest(tool as never, args);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new ToolTimeoutError(tool, timeoutMs));
      }, timeoutMs);

      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timer,
      });

      const line = serializeMessage(request) + "\n";
      this.socket!.write(line);
    });
  }

  private rejectAllPending(reason: string): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && !this.socket.destroyed) {
        const hb = { id: generateId(), type: "heartbeat" as const, timestamp: Date.now() };
        this.socket.write(serializeMessage(hb) + "\n");
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.emit("error", new Error("Max reconnect attempts reached"));
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      30_000
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed) {
        this.connectInternal().catch(() => {
          // Error emitted via event
        });
      }
    }, delay);
  }
}
