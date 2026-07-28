/**
 * Tabryn Error Classes
 *
 * Structured error hierarchy for all Tabryn components.
 *
 * @module shared/errors
 */

import { ERROR_CODES, type ErrorCode } from "./constants.js";

// ─── Base Error ─────────────────────────────────────────────────────

export class TabrynError extends Error {
  public readonly code: ErrorCode;
  public readonly timestamp: number;

  constructor(message: string, code: ErrorCode = ERROR_CODES.INTERNAL_ERROR) {
    super(message);
    this.name = "TabrynError";
    this.code = code;
    this.timestamp = Date.now();
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
    };
  }
}

// ─── Connection Errors ──────────────────────────────────────────────

export class ConnectionError extends TabrynError {
  constructor(message: string, code: ErrorCode = ERROR_CODES.CONNECTION_FAILED) {
    super(message, code);
    this.name = "ConnectionError";
  }
}

export class ConnectionTimeoutError extends ConnectionError {
  constructor(message = "Connection timed out") {
    super(message, ERROR_CODES.CONNECTION_TIMEOUT);
    this.name = "ConnectionTimeoutError";
  }
}

export class ConnectionClosedError extends ConnectionError {
  constructor(message = "Connection closed") {
    super(message, ERROR_CODES.CONNECTION_CLOSED);
    this.name = "ConnectionClosedError";
  }
}

// ─── Tool Errors ────────────────────────────────────────────────────

export class ToolError extends TabrynError {
  public readonly tool: string;

  constructor(tool: string, message: string, code: ErrorCode = ERROR_CODES.TOOL_EXECUTION_FAILED) {
    super(message, code);
    this.name = "ToolError";
    this.tool = tool;
  }
}

export class ToolNotFoundError extends ToolError {
  constructor(tool: string) {
    super(tool, `Tool not found: ${tool}`, ERROR_CODES.TOOL_NOT_FOUND);
    this.name = "ToolNotFoundError";
  }
}

export class ToolTimeoutError extends ToolError {
  constructor(tool: string, timeoutMs: number) {
    super(tool, `Tool ${tool} timed out after ${timeoutMs}ms`, ERROR_CODES.TOOL_TIMEOUT);
    this.name = "ToolTimeoutError";
  }
}

// ─── Protocol Errors ────────────────────────────────────────────────

export class ProtocolError extends TabrynError {
  constructor(message: string, code: ErrorCode = ERROR_CODES.PROTOCOL_ERROR) {
    super(message, code);
    this.name = "ProtocolError";
  }
}

export class ProtocolVersionError extends ProtocolError {
  constructor(remoteVersion: string, localVersion: string) {
    super(
      `Protocol version mismatch: remote=${remoteVersion}, local=${localVersion}`,
      ERROR_CODES.PROTOCOL_VERSION_MISMATCH
    );
    this.name = "ProtocolVersionError";
  }
}

// ─── Validation Errors ──────────────────────────────────────────────

export class ValidationError extends TabrynError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, ERROR_CODES.VALIDATION_ERROR);
    this.name = "ValidationError";
    this.field = field;
  }
}

// ─── Browser Errors ─────────────────────────────────────────────────

export class BrowserError extends TabrynError {
  constructor(message: string, code: ErrorCode = ERROR_CODES.BROWSER_NOT_CONNECTED) {
    super(message, code);
    this.name = "BrowserError";
  }
}

export class TabNotFoundError extends BrowserError {
  constructor(tabId: number) {
    super(`Tab not found: ${tabId}`, ERROR_CODES.TAB_NOT_FOUND);
    this.name = "TabNotFoundError";
  }
}

export class NavigationError extends BrowserError {
  constructor(message: string) {
    super(message, ERROR_CODES.NAVIGATION_FAILED);
    this.name = "NavigationError";
  }
}

export class JsExecutionError extends BrowserError {
  constructor(message: string) {
    super(message, ERROR_CODES.JS_EXECUTION_FAILED);
    this.name = "JsExecutionError";
  }
}

export class ScreenshotError extends BrowserError {
  constructor(message: string) {
    super(message, ERROR_CODES.SCREENSHOT_FAILED);
    this.name = "ScreenshotError";
  }
}

// ─── Factory ────────────────────────────────────────────────────────

export function createErrorFromResponse(error: string, code?: string): TabrynError {
  const errorCode = (code as ErrorCode) || ERROR_CODES.INTERNAL_ERROR;
  switch (errorCode) {
    case ERROR_CODES.CONNECTION_FAILED:
    case ERROR_CODES.CONNECTION_TIMEOUT:
    case ERROR_CODES.CONNECTION_CLOSED:
      return new ConnectionError(error, errorCode);
    case ERROR_CODES.TOOL_NOT_FOUND:
      return new ToolNotFoundError("unknown");
    case ERROR_CODES.TOOL_TIMEOUT:
      return new ToolTimeoutError("unknown", 0);
    case ERROR_CODES.TAB_NOT_FOUND:
      return new TabNotFoundError(0);
    case ERROR_CODES.NAVIGATION_FAILED:
      return new NavigationError(error);
    case ERROR_CODES.PROTOCOL_ERROR:
    case ERROR_CODES.PROTOCOL_VERSION_MISMATCH:
      return new ProtocolError(error, errorCode);
    case ERROR_CODES.VALIDATION_ERROR:
      return new ValidationError(error);
    default:
      return new TabrynError(error, errorCode);
  }
}
