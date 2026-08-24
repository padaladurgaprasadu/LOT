/**
 * LOT Code Model Context Protocol (MCP) Client
 * Standardized connector for external tools, databases, and services via JSON-RPC.
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface McpServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "sse" | "websocket";
  endpoint?: string;
  command?: string;
  args?: string[];
}

export class McpClientManager {
  private servers: Map<string, McpServerConfig> = new Map();
  private tools: Map<string, McpTool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools() {
    this.tools.set("github_mcp", {
      name: "github_mcp",
      description: "Manage repository issues, pull requests, commits, and branch workflows.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create_pr", "review_pr", "read_issue"] },
          repo: { type: "string" },
        },
      },
    });

    this.tools.set("strix_security_mcp", {
      name: "strix_security_mcp",
      description: "Run automated static and dynamic vulnerability scans across source files.",
      inputSchema: {
        type: "object",
        properties: {
          targetPath: { type: "string" },
        },
      },
    });
  }

  public listTools(): McpTool[] {
    return Array.from(this.tools.values());
  }

  public registerServer(config: McpServerConfig) {
    this.servers.set(config.id, config);
  }
}

export const globalMcpManager = new McpClientManager();
