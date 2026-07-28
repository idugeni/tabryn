import { describe, it, expect } from "vitest";
import {
  TabrynError,
  ConnectionError,
  ConnectionTimeoutError,
  ConnectionClosedError,
  ToolError,
  ToolNotFoundError,
  ToolTimeoutError,
  ProtocolError,
  ProtocolVersionError,
  ValidationError,
  BrowserError,
  TabNotFoundError,
  NavigationError,
  createErrorFromResponse,
} from "../src/shared/errors.js";
import { ERROR_CODES } from "../src/shared/constants.js";

describe("Errors", () => {
  describe("TabrynError", () => {
    it("creates error with code", () => {
      const err = new TabrynError("test", ERROR_CODES.INTERNAL_ERROR);
      expect(err.message).toBe("test");
      expect(err.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(err.name).toBe("TabrynError");
      expect(err.timestamp).toBeGreaterThan(0);
    });

    it("serializes to JSON", () => {
      const err = new TabrynError("test", ERROR_CODES.INTERNAL_ERROR);
      const json = err.toJSON();
      expect(json.name).toBe("TabrynError");
      expect(json.message).toBe("test");
      expect(json.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });
  });

  describe("Connection Errors", () => {
    it("creates ConnectionError", () => {
      const err = new ConnectionError("connection failed");
      expect(err).toBeInstanceOf(TabrynError);
      expect(err.name).toBe("ConnectionError");
    });

    it("creates ConnectionTimeoutError", () => {
      const err = new ConnectionTimeoutError();
      expect(err).toBeInstanceOf(ConnectionError);
      expect(err.code).toBe(ERROR_CODES.CONNECTION_TIMEOUT);
    });

    it("creates ConnectionClosedError", () => {
      const err = new ConnectionClosedError();
      expect(err).toBeInstanceOf(ConnectionError);
      expect(err.code).toBe(ERROR_CODES.CONNECTION_CLOSED);
    });
  });

  describe("Tool Errors", () => {
    it("creates ToolError", () => {
      const err = new ToolError("click", "failed to click");
      expect(err).toBeInstanceOf(TabrynError);
      expect(err.tool).toBe("click");
    });

    it("creates ToolNotFoundError", () => {
      const err = new ToolNotFoundError("unknown");
      expect(err).toBeInstanceOf(ToolError);
      expect(err.code).toBe(ERROR_CODES.TOOL_NOT_FOUND);
    });

    it("creates ToolTimeoutError", () => {
      const err = new ToolTimeoutError("screenshot", 5000);
      expect(err).toBeInstanceOf(ToolError);
      expect(err.code).toBe(ERROR_CODES.TOOL_TIMEOUT);
      expect(err.message).toContain("5000");
    });
  });

  describe("Protocol Errors", () => {
    it("creates ProtocolError", () => {
      const err = new ProtocolError("invalid message");
      expect(err).toBeInstanceOf(TabrynError);
      expect(err.name).toBe("ProtocolError");
    });

    it("creates ProtocolVersionError", () => {
      const err = new ProtocolVersionError("2.0.0", "0.1.0");
      expect(err).toBeInstanceOf(ProtocolError);
      expect(err.message).toContain("2.0.0");
      expect(err.message).toContain("0.1.0");
    });
  });

  describe("Validation Errors", () => {
    it("creates ValidationError", () => {
      const err = new ValidationError("invalid field", "name");
      expect(err).toBeInstanceOf(TabrynError);
      expect(err.field).toBe("name");
    });
  });

  describe("Browser Errors", () => {
    it("creates BrowserError", () => {
      const err = new BrowserError("not connected");
      expect(err).toBeInstanceOf(TabrynError);
      expect(err.name).toBe("BrowserError");
    });

    it("creates TabNotFoundError", () => {
      const err = new TabNotFoundError(123);
      expect(err).toBeInstanceOf(BrowserError);
      expect(err.message).toContain("123");
    });

    it("creates NavigationError", () => {
      const err = new NavigationError("failed to navigate");
      expect(err).toBeInstanceOf(BrowserError);
    });
  });

  describe("createErrorFromResponse", () => {
    it("creates ConnectionError", () => {
      const err = createErrorFromResponse("failed", ERROR_CODES.CONNECTION_FAILED);
      expect(err).toBeInstanceOf(ConnectionError);
    });

    it("creates TabNotFoundError", () => {
      const err = createErrorFromResponse("not found", ERROR_CODES.TAB_NOT_FOUND);
      expect(err).toBeInstanceOf(TabNotFoundError);
    });

    it("creates generic TabrynError for unknown code", () => {
      const err = createErrorFromResponse("unknown");
      expect(err).toBeInstanceOf(TabrynError);
    });
  });
});
