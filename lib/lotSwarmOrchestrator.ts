// lib/lotSwarmOrchestrator.ts

export type AgentId =
  | 'lot_code_lead'
  | 'frontend_dev'
  | 'backend_dev'
  | 'web_dev'
  | 'fullstack_dev'
  | 'ml_engineer'
  | 'data_scientist'
  | 'data_analyst'
  | 'vlsi_architect'
  | 'embedded_ai'
  | 'tutor_agent'
  | 'security_gatekeeper';

export interface DomainAgentSpec {
  id: AgentId;
  name: string;
  badge: string;
  preferredModel: string;
  temperature: number;
  domainKeywords: RegExp;
  systemInstruction: string;
}

export const LOT_DOMAIN_AGENTS: Record<AgentId, DomainAgentSpec> = {
  lot_code_lead: {
    id: 'lot_code_lead',
    name: 'LOT Code Architect',
    badge: '⚡ LOT Code',
    preferredModel: 'qwen/qwen-2.5-coder-32b-instruct',
    temperature: 0.1,
    domainKeywords: /\b(refactor|repo|diff|patch|architecture|cline|cursor|codex)\b/i,
    systemInstruction:
      'You are LOT Code Lead Architect. Coordinate multi-file architecture, output <lotFile> or <lotDiff> surgical patches, and delegate specialized subtasks to domain agents when needed.',
  },
  frontend_dev: {
    id: 'frontend_dev',
    name: 'Frontend Developer Agent',
    badge: '🎨 Frontend',
    preferredModel: 'qwen/qwen-2.5-coder-32b-instruct',
    temperature: 0.15,
    domainKeywords: /\b(react|nextjs|tailwind|ui|ux|css|component|animation|responsive|shadcn|frontend)\b/i,
    systemInstruction:
      'You are the Elite Frontend Developer Agent. Build pixel-perfect React, Next.js, and Tailwind CSS interfaces with accessibility, dark mode aesthetics, and zero runtime errors. Consume API contracts from Backend Agent.',
  },
  backend_dev: {
    id: 'backend_dev',
    name: 'Backend Developer Agent',
    badge: '⚙️ Backend',
    preferredModel: 'qwen/qwen-2.5-coder-32b-instruct',
    temperature: 0.1,
    domainKeywords: /\b(api|fastapi|nodejs|express|postgres|supabase|prisma|redis|jwt|webhook|microservice|backend)\b/i,
    systemInstruction:
      'You are the Principal Backend Developer Agent. Design high-throughput REST/GraphQL APIs, SQL schemas, authentication middleware, and rate-limited edge endpoints. Output clear API contracts for the Frontend Agent.',
  },
  web_dev: {
    id: 'web_dev',
    name: 'Web Developer Agent',
    badge: '🌐 Web Dev',
    preferredModel: 'qwen/qwen-2.5-coder-32b-instruct',
    temperature: 0.15,
    domainKeywords: /\b(html|landing page|website|seo|dom|vanilla js|portfolio|vite|web app)\b/i,
    systemInstruction:
      'You are the Web Developer Agent. Build fast, self-contained HTML5/CSS3/JS websites and interactive single-file live previews that render immediately inside the LOT Sandbox.',
  },
  fullstack_dev: {
    id: 'fullstack_dev',
    name: 'Full Stack Developer Agent',
    badge: '🚀 Full Stack',
    preferredModel: 'qwen/qwen-2.5-coder-32b-instruct',
    temperature: 0.1,
    domainKeywords: /\b(full stack|saas|end to end|crud|auth flow|deployment|stripe|razorpay)\b/i,
    systemInstruction:
      'You are the Full Stack Developer Agent. Bridge Database -> Backend API -> Frontend UI seamlessly. Coordinate handoffs between Backend and Frontend agents.',
  },
  ml_engineer: {
    id: 'ml_engineer',
    name: 'ML Engineer Agent',
    badge: '🧠 ML Agent',
    preferredModel: 'meta/llama-3.3-70b-instruct',
    temperature: 0.2,
    domainKeywords: /\b(pytorch|tensorflow|cnn|transformer|fine-tune|lora|onnx|yolo|efficientnet|model training|deep learning)\b/i,
    systemInstruction:
      'You are the Machine Learning Engineer Agent. Write complete PyTorch/TensorFlow training pipelines, custom loss functions, quantization scripts, and ONNX/TFLite export workflows.',
  },
  data_scientist: {
    id: 'data_scientist',
    name: 'Data Scientist Agent',
    badge: '🔬 Data Science',
    preferredModel: 'meta/llama-3.3-70b-instruct',
    temperature: 0.2,
    domainKeywords: /\b(hypothesis|statistics|regression|clustering|xgboost|scikit-learn|feature engineering|ab test|probability)\b/i,
    systemInstruction:
      'You are the Senior Data Scientist Agent. Design statistical models, feature engineering pipelines, cross-validation experiments, and mathematical evaluations.',
  },
  data_analyst: {
    id: 'data_analyst',
    name: 'Data Analyst & BI Developer',
    badge: '📊 Data Analyst',
    preferredModel: 'qwen/qwen-2.5-coder-32b-instruct',
    temperature: 0.15,
    domainKeywords: /\b(pandas|sql query|kpi|dashboard|matplotlib|plotly|csv|excel|eda|cohort|revenue analysis)\b/i,
    systemInstruction:
      'You are the Data Analyst & BI Developer Agent. Write optimized SQL queries, Pandas data-cleaning pipelines, KPI summaries, and interactive chart dashboards.',
  },
  vlsi_architect: {
    id: 'vlsi_architect',
    name: 'VLSI & Silicon Architect Agent',
    badge: '🔌 VLSI / RTL',
    preferredModel: 'qwen/qwen-2.5-coder-32b-instruct',
    temperature: 0.1,
    domainKeywords: /\b(verilog|systemverilog|rtl|fpga|asic|testbench|gtkwave|axi|fsm|timing|synthesis|alu|sram|vlsi)\b/i,
    systemInstruction:
      'You are the Principal VLSI & RTL Hardware Architect. Write synthesizable Verilog/SystemVerilog modules, cycle-accurate testbenches, FSMs, and timing/area optimization constraints.',
  },
  embedded_ai: {
    id: 'embedded_ai',
    name: 'Embedded AI & Firmware Agent',
    badge: '🤖 Embedded AI',
    preferredModel: 'qwen/qwen-2.5-coder-32b-instruct',
    temperature: 0.1,
    domainKeywords: /\b(esp32|stm32|arduino|rtos|tflite micro|edge ai|i2c|spi|uart|ads1299|eeg|sensor|firmware|pcb|c\+\+)\b/i,
    systemInstruction:
      'You are the Embedded AI Systems & Firmware Engineer. Write memory-safe C/C++ firmware for ESP32/STM32, FreeRTOS tasks, SPI/I2C sensor drivers, and TinyML/TFLite Micro edge inference.',
  },
  tutor_agent: {
    id: 'tutor_agent',
    name: 'Socratic AI Tutor Agent',
    badge: '🎓 Tutor',
    preferredModel: 'meta/llama-3.3-70b-instruct',
    temperature: 0.3,
    domainKeywords: /\b(explain|teach|tutor|gate|step by step|intuition|why does|how does|concept|example|quiz)\b/i,
    systemInstruction:
      'You are the Master Socratic Tutor Agent. Explain complex concepts with crystal-clear intuition, real-world analogies, step-by-step worked derivations, and 2 quick check-your-understanding questions.',
  },
  security_gatekeeper: {
    id: 'security_gatekeeper',
    name: 'Red-Team Security Gatekeeper',
    badge: '🛡️ Security',
    preferredModel: 'meta/llama-3.3-70b-instruct',
    temperature: 0.1,
    domainKeywords: /\b(security|vulnerability|audit|owasp|sqli|xss|jwt|auth|leak|sanitize|safe|penetration|exploit|cve)\b/i,
    systemInstruction:
      'You are the Red-Team Security Gatekeeper Agent. Audit code for OWASP Top 10 vulnerabilities, leaked secrets, SQL injection, and memory leaks. Emit a structured [SECURITY VERDICT: PASS/FAIL] with required remediations.',
  },
};

// Auto-detect which ensemble of agents should collaborate on a user request based on input intent
export function planAgentSwarmPipeline(
  userPrompt: string,
  explicitAgents?: AgentId[]
): AgentId[] {
  if (explicitAgents && explicitAgents.length > 0) {
    return explicitAgents;
  }

  const matched: AgentId[] = [];
  for (const agent of Object.values(LOT_DOMAIN_AGENTS)) {
    if (agent.domainKeywords.test(userPrompt)) {
      matched.push(agent.id);
    }
  }

  // Automatic Multi-Agent Collaboration Rules based on user intent:
  // 1. If user asks for a Full-Stack app / end-to-end, automatically pair Backend -> Frontend -> Fullstack
  if (
    matched.includes('fullstack_dev') ||
    (matched.includes('backend_dev') && matched.includes('frontend_dev'))
  ) {
    return ['backend_dev', 'frontend_dev', 'fullstack_dev'];
  }

  // 2. If user asks for Edge/Embedded AI + Hardware/ML, pair ML -> Embedded
  if (matched.includes('embedded_ai') && matched.includes('ml_engineer')) {
    return ['ml_engineer', 'embedded_ai'];
  }

  // 3. If user asks for VLSI + Embedded Firmware
  if (matched.includes('vlsi_architect') && matched.includes('embedded_ai')) {
    return ['vlsi_architect', 'embedded_ai'];
  }

  // 4. If user asks for Data Science + Analysis
  if (matched.includes('data_scientist') && matched.includes('data_analyst')) {
    return ['data_scientist', 'data_analyst'];
  }

  // 5. If user asks for Security Audit along with code building
  if (matched.includes('security_gatekeeper') && (matched.includes('backend_dev') || matched.includes('fullstack_dev'))) {
    return ['backend_dev', 'security_gatekeeper'];
  }

  if (matched.length === 0) {
    return ['lot_code_lead'];
  }

  // Cap automatic sequential swarm at 3 collaborating agents per turn for fast response
  return matched.slice(0, 3);
}

// Helper to detect primary intent domain agent
export function detectIntentDomainAgent(userPrompt: string): DomainAgentSpec {
  const pipeline = planAgentSwarmPipeline(userPrompt);
  const primaryId = pipeline[0] || 'lot_code_lead';
  return LOT_DOMAIN_AGENTS[primaryId] || LOT_DOMAIN_AGENTS.lot_code_lead;
}
