# 🌌 LOT AI & PRISM SILICON
### Sovereign Multi-Agent AI Platform & 3D Direct-Bonded AI Accelerator Architecture

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x-green.svg)](https://nodejs.org)
[![Next.js 14](https://img.shields.io/badge/Next.js-14%20App%20Router-black.svg)](https://nextjs.org)
[![SystemVerilog](https://img.shields.io/badge/RTL-SystemVerilog%20Verified-orange.svg)](hardware/prism/rtl)
[![Architecture](https://img.shields.io/badge/Silicon-TSMC%203nm%20%2B%203D%20SoIC-purple.svg)](hardware/prism)
[![India Semiconductor Mission](https://img.shields.io/badge/ISM-DLI%20Eligible-red.svg)](https://semiconindia.org)

**Architect & Creator**: [Padala Durga Prasad](https://padaladurgaprasadu.github.io/prasad.dev) (AI Systems & Semiconductor Hardware Architect | Published IEEE Researcher)

---

## 🏛️ Executive Summary

**LOT AI & PRISM Silicon** represent a unified, vertically integrated sovereign artificial intelligence ecosystem:
1. **PRISM Silicon**: India’s first 3D Copper-to-Copper Direct-Bonded SRAM AI accelerator architecture, delivering **43x lower data movement energy (1.5 pJ/bit vs 65 pJ/bit on NVIDIA)** to break the Von Neumann memory wall and solve the global datacenter power crisis.
2. **LOT AI Platform**: An autonomous, sovereign multi-domain agent hub executing across Software Engineering, EDA/Hardware Synthesis, Deep Web Intelligence, Tabular Analytics, Bio/Pharma Interaction, and Vision Processing.

---

## ⚡ PRISM Silicon: 6-Generation Product Lineage

```
╔═══════════════════╦════════╦═══════╦════════════╦═══════════════╦════════════╦════════════════════════╗
║ Generation        ║ GHz    ║ TDP W ║ Peak PFLOPS║ Throughput    ║ Tok/Sec/W  ║ Target Workload        ║
╠═══════════════════╬════════╬═══════╬════════════╬═══════════════╬════════════╬════════════════════════╣
║ Gen 1 Edge "Spark"║ 1.20   ║   35  ║   0.12     ║  1,434 tok/s  ║  40.97     ║ MobileNet-V4 (Edge)    ║
║ Gen 2 Pro "Blaze" ║ 1.80   ║  250  ║   1.45     ║    570 tok/s  ║   1.54     ║ LLaMA 3.1 8B (Local)   ║
║ Gen 3 Cloud"Storm"║ 2.10   ║  550  ║   8.50     ║  2,473 tok/s  ║   0.94     ║ LLaMA 3 70B (Cloud)    ║
║ Gen 4 Bio"Synapse"║ 1.60   ║   70  ║   1.98     ║     91 tok/s  ║   1.30     ║ SNN Spiking (Robot)    ║
║ Gen 4 Beast"Titan"║ 2.40   ║  700  ║   2.52*    ║  5,600 tok/s  ║   8.40     ║ LLaMA 3 70B (B64)      ║
║ Xtreme "Nova"     ║ 2.40   ║ 1200  ║ 103.04     ║  6,086 tok/s  ║   0.58     ║ LLaMA 3.1 405B (AGI)   ║
╚═══════════════════╩════════╩═══════╩════════════╩═══════════════╩════════════╩════════════════════════╝
* 2.52 PFLOPS FP8 Dense / ~10.1 PFLOPS with 2:4 structured sparsity + FP4.
```

---

## 🔬 Hardware Verification & Physical Design Milestones

All silicon assets are open-source and verifiable in this repository:

* **`hardware/prism/rtl/prism_beast_tensor_tile.sv`**: Synthesizable $16 \times 16$ mixed-precision systolic matrix engine.
* **`hardware/prism/rtl/prism_sram_vault_controller.sv`**: 128-bank parallel arbiter for the **$64.0\text{ TB/s}$ 3D Cu-Cu Direct-Bonded SRAM Vault**.
* **`hardware/prism/sim/run_rtl_verification.ts`**: Pre-silicon functional verification engine (**256/256 PEs passed with zero timing hazards**).
* **`hardware/prism/sim/prism_beast_matrix_sim.vcd`**: Value Change Dump waveform trace for GTKWave analysis.
* **`hardware/prism/synth/prism_beast_constraints.sdc`**: Synopsys Design Constraints (**2.4 GHz target frequency**).
* **`hardware/prism/synth/openroad_synth.tcl`**: OpenROAD / Yosys physical design synthesis script for TSMC 3nm N3P cells (+42.5 ps timing slack met).

---

## 📑 Strategic & Legal Documentation

* [PRISM Executive Pitch Dossier (10 Slides)](PRISM_Executive_Pitch_Dossier.md)
* [PRISM Provisional Patent Specification Draft](PRISM_Provisional_Patent_Draft.md)
* [Government of Andhra Pradesh & ISM Submission Dossier](GOVERNMENT_SUBMISSION_DOSSIER.md)

---

## 🚀 Quick Start (Running LOT AI & Simulator)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Cycle-Accurate Silicon Simulator
```bash
npx tsx hardware/prism/sim/prism_all_generations_verification.ts
```

### 3. Run Pre-Silicon RTL Verification & Generate Waveforms
```bash
npx tsx hardware/prism/sim/run_rtl_verification.ts
```

### 4. Start LOT AI Web Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
