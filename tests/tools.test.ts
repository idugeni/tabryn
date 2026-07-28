import { describe, it, expect } from "vitest";
import { TOOLS, getToolDefinition, getToolNames } from "../src/mcp/tools.js";

describe("MCP Tools", () => {
  describe("TOOLS array", () => {
    it("contains all 16 tools", () => {
      expect(TOOLS).toHaveLength(16);
    });

    it("each tool has required fields", () => {
      for (const tool of TOOLS) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      }
    });

    it("has unique tool names", () => {
      const names = TOOLS.map((t) => t.name);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });
  });

  describe("getToolDefinition", () => {
    it("finds existing tool", () => {
      const tool = getToolDefinition("list_tabs");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("list_tabs");
    });

    it("returns undefined for unknown tool", () => {
      const tool = getToolDefinition("unknown_tool");
      expect(tool).toBeUndefined();
    });
  });

  describe("getToolNames", () => {
    it("returns all tool names", () => {
      const names = getToolNames();
      expect(names).toHaveLength(16);
      expect(names).toContain("list_tabs");
      expect(names).toContain("screenshot");
      expect(names).toContain("click");
    });
  });

  describe("Tool Schemas", () => {
    it("list_tabs accepts optional filters", () => {
      const tool = getToolDefinition("list_tabs")!;
      const result = tool.inputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("list_tabs accepts url_pattern", () => {
      const tool = getToolDefinition("list_tabs")!;
      const result = tool.inputSchema.safeParse({ url_pattern: "localhost" });
      expect(result.success).toBe(true);
    });

    it("navigate requires tab_id and url", () => {
      const tool = getToolDefinition("navigate")!;
      const result = tool.inputSchema.safeParse({ tab_id: 1, url: "https://example.com" });
      expect(result.success).toBe(true);
    });

    it("navigate fails without required fields", () => {
      const tool = getToolDefinition("navigate")!;
      const result = tool.inputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("click requires tab_id, x, y", () => {
      const tool = getToolDefinition("click")!;
      const result = tool.inputSchema.safeParse({ tab_id: 1, x: 100, y: 200 });
      expect(result.success).toBe(true);
    });

    it("screenshot accepts optional format", () => {
      const tool = getToolDefinition("screenshot")!;
      const result = tool.inputSchema.safeParse({ tab_id: 1, format: "jpeg", quality: 80 });
      expect(result.success).toBe(true);
    });

    it("read_console accepts optional filters", () => {
      const tool = getToolDefinition("read_console")!;
      const result = tool.inputSchema.safeParse({
        tab_id: 1,
        level: "error",
        pattern: "TypeError",
        limit: 10,
      });
      expect(result.success).toBe(true);
    });

    it("execute_js requires tab_id and expression", () => {
      const tool = getToolDefinition("execute_js")!;
      const result = tool.inputSchema.safeParse({
        tab_id: 1,
        expression: "document.title",
      });
      expect(result.success).toBe(true);
    });

    it("wait requires tab_id and condition", () => {
      const tool = getToolDefinition("wait")!;
      const result = tool.inputSchema.safeParse({
        tab_id: 1,
        condition: "network_idle",
        timeout_ms: 5000,
      });
      expect(result.success).toBe(true);
    });
  });
});
