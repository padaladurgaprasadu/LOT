/**
 * LOT AI Sovereign Multi-Domain Agent Orchestrator
 * Central intent router, sub-agent dispatcher, and Human-in-the-Loop (HITL) gatekeeper.
 */

import { hitlGate, OperationTier } from "./hitlGate";
import { lotCodeAgent } from "./domains/codeAgent";
import { lotSiliconAgent } from "./domains/siliconAgent";
import { lotResearchAgent } from "./domains/researchAgent";
import { lotDataAgent } from "./domains/dataAgent";
import { lotBioAgent } from "./domains/bioAgent";
import { lotDocsAgent } from "./domains/docsAgent";
import { lotWebAgent } from "./domains/webAgent";

export type AgentDomain =
  | "CODE"
  | "SILICON"
  | "RESEARCH"
  | "DATA"
  | "BIO"
  | "DOCS"
  | "WEB"
  | "GENERAL";

export interface OrchestratorRequest {
  query: string;
  domainOverride?: AgentDomain;
  contextFiles?: string[];
  autoExecuteSafeRead?: boolean;
}

export interface OrchestratorResponse {
  domain: AgentDomain;
  agentName: string;
  result: any;
  requiresHitlApproval: boolean;
  hitlRequestId?: string;
  executionTimestamp: number;
}

export class AgentOrchestrator {
  private static instance: AgentOrchestrator;

  private constructor() {}

  public static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator();
    }
    return AgentOrchestrator.instance;
  }

  /**
   * Classifies user intent into target domain agent
   */
  public classifyDomain(query: string): AgentDomain {
    const q = query.toLowerCase();

    // 1. Silicon / PCB / Hardware / ECE / EEE
    if (/\b(pcb|schematic|kicad|circuit|verilog|asic|fpga|eda|spice|resistor|capacitor|buck|boost|microcontroller|ee\s*agent|ece)\b/i.test(q)) {
      return "SILICON";
    }

    // 2. Data Scientist / Data Analyst / SQL
    if (/\b(dataset|csv|parquet|pandas|dataframe|sql\s*query|statistical|regression|clustering|chart|analytics)\b/i.test(q)) {
      return "DATA";
    }

    // 3. Bio / Pharma / Chemistry
    if (/\b(smiles|pharmacist|drug|molecule|pubchem|genomic|biomedical|clinical\s*trial|aspirin|ibuprofen)\b/i.test(q)) {
      return "BIO";
    }

    // 4. Document / PDF / Screen Vision
    if (/\b(pdf|ocr|document\s*parsing|screenshot|bounding\s*box|omniparser|docling)\b/i.test(q)) {
      return "DOCS";
    }

    // 5. Headless Web Control
    if (/\b(scrape|crawl|browser|playwright|crawl4ai|web\s*page|http)\b/i.test(q)) {
      return "WEB";
    }

    // 6. Deep Research / Perplexity
    if (/\b(deep\s*research|comprehensive\s*report|literature\s*review|storm\s*research|citations)\b/i.test(q)) {
      return "RESEARCH";
    }

    // 7. Fullstack / Coding
    if (/\b(code|refactor|diff|patch|react|nextjs|typescript|python|bug|debug|function|api\s*endpoint|ast)\b/i.test(q)) {
      return "CODE";
    }

    return "GENERAL";
  }

  /**
   * Routes query to the specialized domain agent
   */
  public async dispatch(req: OrchestratorRequest): Promise<OrchestratorResponse> {
    const domain = req.domainOverride || this.classifyDomain(req.query);

    let result: any = null;
    let requiredTier: OperationTier = "READ";
    let targetEntity = domain;

    switch (domain) {
      case "SILICON": {
        result = lotSiliconAgent.generatePcbDesign(req.query);
        break;
      }
      case "RESEARCH": {
        result = await lotResearchAgent.conductDeepResearch(req.query);
        break;
      }
      case "DATA": {
        result = lotDataAgent.analyzeDataset({ datasetName: "workspace_data", query: req.query });
        break;
      }
      case "BIO": {
        result = lotBioAgent.analyzeCompound(req.query);
        break;
      }
      case "DOCS": {
        result = lotDocsAgent.parseDocument(req.query);
        break;
      }
      case "WEB": {
        const urlMatch = req.query.match(/https?:\/\/[^\s]+/i);
        const url = urlMatch ? urlMatch[0] : "https://github.com";
        result = await lotWebAgent.crawlUrl(url);
        break;
      }
      case "CODE":
      default: {
        result = await lotCodeAgent.execute({ instruction: req.query, files: req.contextFiles });
        requiredTier = "WRITE";
        targetEntity = (result.modifiedFiles && result.modifiedFiles[0]) || "workspace";
        break;
      }
    }

    // Evaluate Human-in-the-Loop Security Gate
    const permission = hitlGate.evaluate(requiredTier, targetEntity, {
      diff: result.diffs,
      command: undefined,
    });

    return {
      domain,
      agentName: this.getAgentDisplayName(domain),
      result,
      requiresHitlApproval: permission.requiresApproval,
      hitlRequestId: permission.requestId,
      executionTimestamp: Date.now(),
    };
  }

  private getAgentDisplayName(domain: AgentDomain): string {
    switch (domain) {
      case "SILICON":
        return lotSiliconAgent.name;
      case "RESEARCH":
        return lotResearchAgent.name;
      case "DATA":
        return lotDataAgent.name;
      case "BIO":
        return lotBioAgent.name;
      case "DOCS":
        return lotDocsAgent.name;
      case "WEB":
        return lotWebAgent.name;
      case "CODE":
        return lotCodeAgent.name;
      default:
        return "LOT SOVEREIGN ORCHESTRATOR";
    }
  }
}

export const agentOrchestrator = AgentOrchestrator.getInstance();
