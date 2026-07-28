import { describe, it, expect } from "vitest";
import {
  generateId,
  createConnectMessage,
  createDisconnectMessage,
  createHeartbeatMessage,
  createErrorMessage,
  createToolRequest,
  createToolResponse,
  createToolErrorMessage,
  validateMessage,
  serializeMessage,
  deserializeMessage,
  encodeNativeMessage,
  decodeNativeMessages,
  isVersionCompatible,
  negotiateVersion,
} from "../src/shared/protocol.js";

describe("Protocol", () => {
  describe("generateId", () => {
    it("generates unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg_\d+_\d+$/);
    });
  });

  describe("Message Creation", () => {
    it("creates connect message", () => {
      const msg = createConnectMessage();
      expect(msg.type).toBe("connect");
      expect(msg.protocolVersion).toBe("0.1.0");
      expect(msg.id).toBeDefined();
      expect(msg.timestamp).toBeGreaterThan(0);
    });

    it("creates disconnect message", () => {
      const msg = createDisconnectMessage("test reason");
      expect(msg.type).toBe("disconnect");
      expect(msg.reason).toBe("test reason");
    });

    it("creates heartbeat message", () => {
      const msg = createHeartbeatMessage();
      expect(msg.type).toBe("heartbeat");
    });

    it("creates error message", () => {
      const msg = createErrorMessage("test error", "TEST_CODE");
      expect(msg.type).toBe("error");
      expect(msg.error).toBe("test error");
      expect(msg.code).toBe("TEST_CODE");
    });

    it("creates tool request", () => {
      const msg = createToolRequest("list_tabs", { url_pattern: "localhost" });
      expect(msg.type).toBe("tool_request");
      expect(msg.tool).toBe("list_tabs");
      expect(msg.args).toEqual({ url_pattern: "localhost" });
    });

    it("creates tool response", () => {
      const msg = createToolResponse("id-123", "list_tabs", { tabs: [] });
      expect(msg.type).toBe("tool_response");
      expect(msg.id).toBe("id-123");
      expect(msg.tool).toBe("list_tabs");
      expect(msg.result).toEqual({ tabs: [] });
    });

    it("creates tool error", () => {
      const msg = createToolErrorMessage("id-123", "click", "Element not found", "NOT_FOUND");
      expect(msg.type).toBe("tool_error");
      expect(msg.error).toBe("Element not found");
      expect(msg.code).toBe("NOT_FOUND");
    });
  });

  describe("Message Validation", () => {
    it("validates valid messages", () => {
      const msg = createConnectMessage();
      const validated = validateMessage(msg);
      expect(validated.type).toBe("connect");
    });

    it("rejects non-objects", () => {
      expect(() => validateMessage("string")).toThrow();
      expect(() => validateMessage(null)).toThrow();
      expect(() => validateMessage(123)).toThrow();
    });

    it("rejects missing type", () => {
      expect(() => validateMessage({ id: "1", timestamp: 123 })).toThrow();
    });

    it("rejects missing id", () => {
      expect(() => validateMessage({ type: "heartbeat", timestamp: 123 })).toThrow();
    });

    it("rejects unknown type", () => {
      expect(() => validateMessage({ id: "1", type: "unknown", timestamp: 123 })).toThrow();
    });
  });

  describe("Serialization", () => {
    it("serializes and deserializes messages", () => {
      const original = createToolRequest("list_tabs", {});
      const serialized = serializeMessage(original);
      const deserialized = deserializeMessage(serialized);
      expect(deserialized.type).toBe("tool_request");
    });

    it("rejects empty strings", () => {
      expect(() => deserializeMessage("")).toThrow();
    });

    it("rejects invalid JSON", () => {
      expect(() => deserializeMessage("not json")).toThrow();
    });
  });

  describe("Native Messaging", () => {
    it("encodes and decodes messages", () => {
      const original = createHeartbeatMessage();
      const encoded = encodeNativeMessage(original);

      // Check 4-byte LE length prefix
      expect(encoded.length).toBeGreaterThan(4);
      const length = encoded.readUInt32LE(0);
      expect(length).toBe(encoded.length - 4);

      // Decode
      const { messages } = decodeNativeMessages(encoded);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("heartbeat");
    });

    it("handles multiple messages in buffer", () => {
      const msg1 = createHeartbeatMessage();
      const msg2 = createHeartbeatMessage();
      const buf1 = encodeNativeMessage(msg1);
      const buf2 = encodeNativeMessage(msg2);
      const combined = Buffer.concat([buf1, buf2]);

      const { messages, remainder } = decodeNativeMessages(combined);
      expect(messages).toHaveLength(2);
      expect(remainder.length).toBe(0);
    });

    it("handles partial messages", () => {
      const msg = createHeartbeatMessage();
      const encoded = encodeNativeMessage(msg);
      const partial = encoded.subarray(0, 6); // Incomplete

      const { messages, remainder } = decodeNativeMessages(partial);
      expect(messages).toHaveLength(0);
      expect(remainder.length).toBe(6);
    });
  });

  describe("Version Negotiation", () => {
    it("accepts compatible versions", () => {
      expect(isVersionCompatible("0.1.0")).toBe(true);
    });

    it("rejects incompatible versions", () => {
      expect(isVersionCompatible("1.0.0")).toBe(false);
      expect(isVersionCompatible("2.0.0")).toBe(false);
    });

    it("negotiates compatible version", () => {
      expect(negotiateVersion("0.1.0")).toBe("0.1.0");
    });

    it("returns null for incompatible version", () => {
      expect(negotiateVersion("2.0.0")).toBeNull();
    });
  });
});
