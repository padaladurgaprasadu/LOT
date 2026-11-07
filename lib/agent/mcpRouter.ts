// lib/agent/mcpRouter.ts

export interface MCPToolDescriptor {
  id: string;
  category: "Data MCPs" | "Commerce MCPs" | "DevOps MCPs";
  server: string;
  description: string;
  keywords: string[];
}

export const ENTERPRISE_MCP_CATALOG: MCPToolDescriptor[] = [
  {
    id: "supabase.query",
    category: "Data MCPs",
    server: "Supabase",
    description: "Execute pgvector & SQL queries",
    keywords: ["db", "sql", "supabase", "vector", "table", "auth"],
  },
  {
    id: "postgres.schema",
    category: "Data MCPs",
    server: "PostgreSQL",
    description: "Inspect relational schema & indexes",
    keywords: ["postgres", "schema", "migration", "column"],
  },
  {
    id: "redis.cache",
    category: "Data MCPs",
    server: "Redis",
    description: "Low-latency key-value state cache",
    keywords: ["cache", "redis", "session", "fast"],
  },
  {
    id: "swiggy.order",
    category: "Commerce MCPs",
    server: "Swiggy",
    description: "Search restaurants, apply coupons & build food cart",
    keywords: ["biryani", "food", "swiggy", "order", "restaurant"],
  },
  {
    id: "zomato.search",
    category: "Commerce MCPs",
    server: "Zomato",
    description: "Compare live dining & delivery menus",
    keywords: ["zomato", "menu", "delivery", "dinner"],
  },
  {
    id: "redbus.book",
    category: "Commerce MCPs",
    server: "redBus",
    description: "Search sleeper/AC buses and lock seat inventory",
    keywords: ["bus", "ticket", "redbus", "travel", "sleeper"],
  },
  {
    id: "github.pr",
    category: "DevOps MCPs",
    server: "GitHub",
    description: "Commit branches, open PRs & inspect diffs",
    keywords: ["git", "github", "commit", "branch", "repo", "code"],
  },
  {
    id: "linear.issue",
    category: "DevOps MCPs",
    server: "Linear",
    description: "Track engineering sprint issues & DAG tasks",
    keywords: ["issue", "bug", "task", "sprint", "linear"],
  },
];

export class SemanticMCPRouter {
  public static pruneToTop5(prompt: string): MCPToolDescriptor[] {
    const tokens = prompt.toLowerCase().split(/\W+/);
    return [...ENTERPRISE_MCP_CATALOG]
      .map((tool) => {
        const overlap = tool.keywords.filter(
          (k) => tokens.includes(k) || prompt.toLowerCase().includes(k)
        ).length;
        return { tool, score: overlap };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.tool);
  }
}
