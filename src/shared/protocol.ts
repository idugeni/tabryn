/**
 * Tabryn Protocol
 *
 * Message creation, validation, serialization, and version negotiation.
 *
 * @module shared/protocol
 */

import { z } from "zod";
import { PROTOCOL_VERSION, type AnyMessage, type MessageType } from "./types.js";
import { PROTOCOL_VERSION_RANGE, MAX_MESSAGE_SIZE } from "./constants.js";
import { ProtocolError, ValidationError } from "./errors.js";

// ─── ID Generation ──────────────────────────────────────────────────

let idCounter = 0;

export function generateId(): string {
  return `msg_${Date.now()}_${++idCounter}`;
}

// ─── Message Schemas ────────────────────────────────────────────────

const baseMessageSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.number(),
});

const connectMessageSchema = baseMessageSchema.extend({
  type: z.literal("connect"),
  protocolVersion: z.string(),
});

const disconnectMessageSchema = baseMessageSchema.extend({
  type: z.literal("disconnect"),
  reason: z.string().optional(),
});

const heartbeatMessageSchema = baseMessageSchema.extend({
  type: z.literal("heartbeat"),
});

const errorMessageSchema = baseMessageSchema.extend({
  type: z.literal("error"),
  error: z.string(),
  code: z.string().optional(),
});

const toolRequestSchema = baseMessageSchema.extend({
  type: z.literal("tool_request"),
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
});

const toolResponseSchema = baseMessageSchema.extend({
  type: z.literal("tool_response"),
  tool: z.string(),
  result: z.unknown(),
});

const toolErrorMessageSchema = baseMessageSchema.extend({
  type: z.literal("tool_error"),
  tool: z.string(),
  error: z.string(),
  code: z.string().optional(),
});

// ─── Message Creation ───────────────────────────────────────────────

export function createConnectMessage(): z.infer<typeof connectMessageSchema> {
  return {
    id: generateId(),
    type: "connect",
    protocolVersion: PROTOCOL_VERSION,
    timestamp: Date.now(),
  };
}

export function createDisconnectMessage(reason?: string): z.infer<typeof disconnectMessageSchema> {
  return {
    id: generateId(),
    type: "disconnect",
    reason,
    timestamp: Date.now(),
  };
}

export function createHeartbeatMessage(): z.infer<typeof heartbeatMessageSchema> {
  return {
    id: generateId(),
    type: "heartbeat",
    timestamp: Date.now(),
  };
}

export function createErrorMessage(error: string, code?: string): z.infer<typeof errorMessageSchema> {
  return {
    id: generateId(),
    type: "error",
    error,
    code,
    timestamp: Date.now(),
  };
}

export function createToolRequest(
  tool: string,
  args: Record<string, unknown> = {}
): z.infer<typeof toolRequestSchema> {
  return {
    id: generateId(),
    type: "tool_request",
    tool,
    args,
    timestamp: Date.now(),
  };
}

export function createToolResponse(
  id: string,
  tool: string,
  result: unknown
): z.infer<typeof toolResponseSchema> {
  return {
    id,
    type: "tool_response",
    tool,
    result,
    timestamp: Date.now(),
  };
}

export function createToolErrorMessage(
  id: string,
  tool: string,
  error: string,
  code?: string
): z.infer<typeof toolErrorMessageSchema> {
  return {
    id,
    type: "tool_error",
    tool,
    error,
    code,
    timestamp: Date.now(),
  };
}

// ─── Message Validation ─────────────────────────────────────────────

const messageSchemas: Record<MessageType, z.ZodType> = {
  connect: connectMessageSchema,
  disconnect: disconnectMessageSchema,
  heartbeat: heartbeatMessageSchema,
  error: errorMessageSchema,
  tool_request: toolRequestSchema,
  tool_response: toolResponseSchema,
  tool_error: toolErrorMessageSchema,
};

export function validateMessage(data: unknown): AnyMessage {
  if (typeof data !== "object" || data === null) {
    throw new ValidationError("Message must be an object");
  }

  const obj = data as Record<string, unknown>;

  if (!obj.type || typeof obj.type !== "string") {
    throw new ValidationError("Message must have a 'type' field");
  }

  if (!obj.id || typeof obj.id !== "string") {
    throw new ValidationError("Message must have an 'id' field");
  }

  if (!obj.timestamp || typeof obj.timestamp !== "number") {
    throw new ValidationError("Message must have a 'timestamp' field");
  }

  const messageType = obj.type as MessageType;
  const schema = messageSchemas[messageType];

  if (!schema) {
    throw new ValidationError(`Unknown message type: ${messageType}`);
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Invalid ${messageType} message: ${result.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  return result.data as AnyMessage;
}

// ─── Serialization ──────────────────────────────────────────────────

export function serializeMessage(message: AnyMessage): string {
  const json = JSON.stringify(message);
  if (Buffer.byteLength(json, "utf-8") > MAX_MESSAGE_SIZE) {
    throw new ProtocolError("Message exceeds maximum size");
  }
  return json;
}

export function deserializeMessage(data: string): AnyMessage {
  if (data.length === 0) {
    throw new ValidationError("Empty message");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new ValidationError("Invalid JSON");
  }

  return validateMessage(parsed);
}

// ─── Native Messaging Format ────────────────────────────────────────

/** Encode a message for Chrome Native Messaging (4-byte LE length prefix + JSON) */
export function encodeNativeMessage(message: AnyMessage): Buffer {
  const json = JSON.stringify(message);
  const jsonBuffer = Buffer.from(json, "utf-8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(jsonBuffer.length, 0);
  return Buffer.concat([header, jsonBuffer]);
}

/** Decode a Native Messaging message from a buffer. Returns parsed messages and remaining buffer. */
export function decodeNativeMessages(buffer: Buffer): {
  messages: AnyMessage[];
  remainder: Buffer;
} {
  const messages: AnyMessage[] = [];
  let offset = 0;

  while (offset + 4 <= buffer.length) {
    const len = buffer.readUInt32LE(offset);
    if (offset + 4 + len > buffer.length) break;

    const json = buffer.subarray(offset + 4, offset + 4 + len).toString("utf-8");
    try {
      const parsed = JSON.parse(json);
      messages.push(validateMessage(parsed));
    } catch {
      // Skip malformed messages
    }
    offset += 4 + len;
  }

  return { messages, remainder: buffer.subarray(offset) };
}

// ─── Version Negotiation ────────────────────────────────────────────

export function isVersionCompatible(version: string): boolean {
  const parts = version.split(".").map(Number);
  const minParts = PROTOCOL_VERSION_RANGE.min.split(".").map(Number);
  const maxParts = PROTOCOL_VERSION_RANGE.max.split(".").map(Number);
  const major = parts[0] ?? 0;
  const minMajor = minParts[0] ?? 0;
  const maxMajor = maxParts[0] ?? 0;
  return major >= minMajor && major <= maxMajor;
}

export function negotiateVersion(remoteVersion: string): string | null {
  if (!isVersionCompatible(remoteVersion)) {
    return null;
  }
  // For now, use local version. In the future, negotiate highest compatible.
  return PROTOCOL_VERSION;
}
