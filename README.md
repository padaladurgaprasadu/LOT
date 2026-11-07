# 🌌 LOT-OS: Multi-Agent AI Operating System
### Frontier Sovereign Multi-Agent Workspace, Speculative Coding Swarm & Edge Reasoning

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x-green.svg)](https://nodejs.org)
[![Next.js 14](https://img.shields.io/badge/Next.js-14%20App%20Router-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)
[![Production URL](https://img.shields.io/badge/Production-lot--ai.in-emerald.svg)](https://lot-ai.in)

**Architect & Creator**: [Padala Durga Prasad](https://padaladurgaprasadu.github.io/prasad.dev) (AI Systems Architect & Published IEEE Researcher)

---

## 🏛️ Executive Summary

**LOT-OS** is an autonomous, sovereign multi-agent operating system engineered for zero-hallucination engineering, live workspace sandboxing, and multimodal intelligence. Running on high-performance microservices and in-browser WASM client compute, LOT-OS delivers sub-second reasoning and interactive execution at zero server infrastructure cost.

* **Live Domain**: [lot-ai.in](https://lot-ai.in)
* **Vercel Mirror**: [lot-ai.vercel.app](https://lot-ai.vercel.app)

---

## ⚡ Core OS Architecture & Capabilities

### 1. Split-Screen Dynamic Workspace (45% / 55%)
* **Cognitive Stream (Left Pane - 45%)**: Streaming high-reasoning chat with duration-timed collapsible `<think>` blocks, voice input, and accessible mode selector pills.
* **Morphing Dynamic Canvases (Right Pane - 55%)**:
  * **App Preview Canvas**: In-browser Sandpack React/Node live code runner with interactive desktop and Android mobile device viewports.
  * **PCB Hardware Canvas**: Declarative React circuit schematic synthesis, 2D copper layout, and 3D board rendering with KiCad/Gerber export hooks.
  * **Autonomous Action Card**: 4-stage commerce and ticketing state machine with a 3-tier Human-in-the-Loop (HITL) UPI QR checkout approval gate.
  * **Meeting Co-pilot HUD**: Real-time display tab audio capture, in-browser speech-to-text, and live jargon explainer.
  * **Academic Research Canvas**: ArXiv discovery engine, KaTeX mathematical equations, and zoomable interactive Mermaid diagrams.

### 2. Multi-Provider Zero-Downtime Failover Gateway (`/api/lot-os`)
Eliminates HTTP 429 rate limits through sub-10ms automatic rotation:
* **Primary**: Enterprise NVIDIA NIM (`meta/llama-3.3-70b-instruct`, `nvidia/nemotron-3-nano-30b-a3b`).
* **Secondary**: Groq Cloud (`llama-3.3-70b-versatile`, `qwen-2.5-coder-32b`).
* **Tertiary**: OpenRouter Free (`deepseek-r1:free`).
* **Quaternary**: Google Gemini 1.5 Flash.

### 3. Chronological Temporal Memory & Verified Reasoning (`lib/lotNvidiaEngine.ts`)
* **Dual-Tier Memory**: Virtual memory paging (FIFO 6-turn working context) combined with a Temporal Knowledge Graph (`valid_from`, `superseded_at`) ensuring chronological accuracy over 50+ hour sessions without context degradation.
* **Optical Director Photorealism**: 2-stage optical camera director feeding NVIDIA NIM `black-forest-labs/flux.1-dev` with zero-key Pollinations Flux fallback.

### 4. Zero-Cost Client-Side Compute
* **In-Browser Python**: Pyodide WebAssembly runner.
* **In-Browser Transcription**: HuggingFace Transformers.js Whisper WebWorker.

---

## 🚀 Quickstart & Local Development

### Prerequisites
* Node.js 18.x or 20.x
* npm 9+

### Installation & Run

```bash
# 1. Clone repository
git clone https://github.com/padaladurgaprasadu/LOT.git
cd LOT

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.local.example .env.local

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Verification Suite

Run the full programmatic verification suite to test file architecture, route fallbacks, UI components, and TypeScript compilation:

```bash
python scripts/verify_lot_os.py
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
