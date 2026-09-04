# FORM 2
THE PATENTS ACT, 1970
(39 OF 1970)
&
THE PATENTS RULES, 2003

## PROVISIONAL SPECIFICATION
(See section 10 and rule 13)

---

### 1. TITLE OF THE INVENTION
**A THREE-DIMENSIONAL DIRECT-BONDED SRAM ACCELERATOR ARCHITECTURE WITH HARDWARE-FUSED ATTENTION ENGINE FOR ENERGY-EFFICIENT NEURAL NETWORK ACCELERATION**

---

### 2. APPLICANT(S) / INVENTOR(S)
* **Name**: PADALA DURGA PRASAD
* **Nationality**: Indian
* **Address**: Andhra Pradesh, India

---

### 3. PREAMBLE TO THE DESCRIPTION
The following specification describes the invention.

---

### 4. FIELD OF THE INVENTION
The present invention relates generally to semiconductor devices, VLSI microarchitectures, and artificial intelligence (AI) hardware accelerators. More particularly, the invention relates to a three-dimensional (3D) integrated circuit comprising a static random-access memory (SRAM) array vertically coupled via face-to-face copper-to-copper (Cu-Cu) hybrid direct bonding onto a systolic matrix compute tier, eliminating lateral physical interconnects and planar memory bottlenecks in transformer model inference.

---

### 5. BACKGROUND OF THE INVENTION AND PRIOR ART LIMITATIONS
Conventional deep learning accelerators (such as planar graphics processing units and tensor processing units) utilize High-Bandwidth Memory (HBM) modules disposed laterally on a two-and-a-half-dimensional (2.5D) silicon interposer. 

In such planar architectures, moving tensor activations and foundation model weights across 15mm–25mm horizontal traces incurs severe physical penalties:
1. **The Von Neumann Data Movement Penalty**: Data transfers across lateral PHY interfaces require 50 to 100 picojoules per bit ($50\text{--}100\text{ pJ/bit}$), causing lateral memory movement to consume over 75% of total accelerator board power.
2. **Intermediate Attention Memory Stalls**: Standard Transformer attention architectures write unnormalized intermediate Query-Key ($Q \cdot K^T$) inner products back to off-chip memory before executing softmax normalization, creating significant latency stalls and memory bus contention during autoregressive token generation.
3. **Thermal and Interconnect Saturation**: Scaling compute density without increasing local cache bandwidth leads to processing element starvation, where matrix multipliers idle awaiting memory transactions.

Existing solutions, such as wafer-scale planar integration (e.g., Cerebras WSE) or lateral multi-chiplet packaging (e.g., AMD MI300X, NVIDIA B200), rely either on monolithic wafer fabrication with non-standard packaging or horizontal interposer routing with high parasitic capacitance. Therefore, a need exists for a modular, vertically integrated 3D accelerator architecture that provides multi-terabyte-per-second on-chip memory throughput while reducing data movement energy by over an order of magnitude.

---

### 6. OBJECTS OF THE INVENTION
1. The principal object of the present invention is to provide a 3D integrated AI accelerator that significantly reduces data movement power consumption by positioning a dedicated SRAM memory tier directly above a matrix compute array using vertical face-to-face copper-to-copper hybrid bonding.
2. Another object of the present invention is to provide a partitioned vertical memory vault structure wherein independent memory vaults stream matrix operands directly into the local registers of corresponding systolic processing element tiles without intermediate planar bus arbitration.
3. Yet another object of the present invention is to incorporate a dedicated hardware-fused attention engine on the compute tier configured to compute streaming dot products and online softmax normalization in a continuous datapath, eliminating intermediate off-chip tensor writes.
4. Still another object of the present invention is to establish a modular 6-generation hardware architecture scalable from edge devices (35W) up to multi-tile wafer-scale enterprise supercomputing modules (1200W).

---

### 7. SUMMARY OF THE INVENTION
The present invention discloses a 3D AI accelerator architecture comprising:
1. **A Lower Compute Logic Tier**: Fabricated on an advanced digital CMOS process node (e.g., TSMC 3nm N3P), comprising a two-dimensional grid of mixed-precision systolic processing tiles, an array of execution schedulers, and a dedicated hardware-fused attention engine.
2. **An Upper SRAM Memory Vault Tier**: Fabricated on a high-density SRAM process node (e.g., mature or advanced planar CMOS), comprising at least 2,048 Megabytes (2.0 GB) of high-density SRAM partitioned into an array of independent memory vaults (e.g., 128 parallel vaults).
3. **A Vertical Direct-Bonding Interface**: Electrically and mechanically coupling the upper memory tier to the lower compute tier using direct copper-to-copper (Cu-Cu) hybrid bonding at a pitch of 6.0 micrometers or less (with scalability to sub-1.0 micrometer pitch), providing direct vertical through-silicon via (TSV) interconnects between each memory vault and its corresponding compute tile.
4. **Dataflow & Memory Delivery**: The vertical architecture sustains on-chip memory bandwidth exceeding 64.0 Terabytes per second ($>64.0\text{ TB/s}$) directly into systolic matrix registers, achieving an internal data movement energy expenditure of approximately 1.5 picojoules per bit ($1.5\text{ pJ/bit}$).

---

### 8. BRIEF DESCRIPTION OF THE DRAWINGS
* **Figure 1**: Illustrates an exploded perspective view of the 3D accelerator device showing the upper SRAM memory vault tier and the lower systolic compute tier coupled via vertical copper-to-copper direct bonding.
* **Figure 2**: Illustrates a top-level block diagram of an individual $16 \times 16$ systolic matrix tile interconnected with its dedicated vertical SRAM memory vault.
* **Figure 3**: Illustrates a datapath schematic of the hardware-fused attention engine executing online softmax normalization without off-chip intermediate transactions.
* **Figure 4**: Illustrates a multi-tier memory hierarchy showing the coordination between the 3D-bonded SRAM cache and secondary external High-Bandwidth Memory (HBM3e).

---

### 9. DETAILED DESCRIPTION OF THE INVENTION
Referring to the architecture in detail, the system comprises a heterogeneous multi-tier stack:

#### 9.1 Physical Layer & 3D Interconnect Structure
The device utilizes a face-to-face (F2F) or face-to-back (F2B) 3D hybrid bonding configuration (such as TSMC 3D SoIC-X). The upper die contains an SRAM array of at least 2,048 Megabytes (2.0 GB), structured into 128 discrete memory vaults. Each vault comprises an internal 2,048-bit wide parallel readout bus coupled to vertical Cu-Cu micro-pads arrayed across the bottom metal layer of the memory die.

The lower compute die comprises 2,048 tensor tiles, each housing a $16 \times 16$ array of mixed-precision (FP8 / INT8 input, FP32 accumulation) processing elements (PEs). At an operating frequency of 2.40 GHz on TSMC 3nm N3P:
$$\text{Peak SRAM Throughput} = 128\text{ Banks} \times \left(\frac{2048\text{ bits}}{8\text{ bits/byte}}\right) \times 2.40 \times 10^9\text{ Hz} = 78.6\text{ TB/s}$$
sustaining greater than $64.0\text{ TB/s}$ continuous bandwidth under real-world multi-bank arbitration.

#### 9.2 Hardware-Fused Attention Subsystem
To eliminate the quadratic memory traffic associated with self-attention in Transformer architectures, the compute tier incorporates hardwired FlashAttention-3 execution blocks. The execution block receives query ($Q$) and key ($K$) tensor chunks directly from the vertical SRAM vaults, evaluates $S = Q \cdot K^T$, and pipes the unnormalized activations into an online reduction and exponent tree. The tree computes running maximums $m_i$ and running normalizers $l_i$ in real time, emitting normalized attention-value ($O = \text{Softmax}(S) \cdot V$) products without spilling intermediate $S$ matrices to off-chip storage.

#### 9.3 6-Generation Modular Scalability
The claimed 3D direct-bonded architecture is scalable across six specific embodiments:
1. **Gen 1 Edge ("Spark")**: 35W TDP, 64 MB SRAM, 1.2 TB/s bandwidth, designed for edge robotics and M.2 modules.
2. **Gen 2 Pro ("Blaze")**: 250W TDP, 256 MB SRAM, 8.0 TB/s bandwidth, designed for PCIe AI workstations.
3. **Gen 3 Cloud ("Storm")**: 550W TDP, 1,024 MB (1GB) SRAM, 24.0 TB/s bandwidth, designed for OAM cloud servers.
4. **Gen 4 Bio ("Synapse")**: 70W TDP, 512 MB SRAM, 12.0 TB/s bandwidth, integrating spiking neural network (SNN) neuromorphic cores.
5. **Gen 4 Beast ("Titan")**: 700W TDP, 2,048 MB (2GB) SRAM, 64.0 TB/s bandwidth, 2.52 PFLOPS FP8 dense compute, designed for frontier foundation models.
6. **PRISM Xtreme ("Nova")**: 1200W TDP, 8,192 MB (8GB) SRAM, 256.0 TB/s bandwidth, integrating 4-tile wafer-scale packaging and silicon photonics.

---

### 10. CLAIMS (PROVISIONAL)
**WE CLAIM:**

1. An integrated artificial intelligence accelerator device comprising:
   * a lower semiconductor compute die comprising an array of systolic matrix multiplication tiles and execution schedulers;
   * an upper semiconductor memory die comprising a high-density static random-access memory (SRAM) array partitioned into a plurality of independent vertical memory vaults; and
   * a direct copper-to-copper (Cu-Cu) hybrid bonding interface electrically and mechanically coupling said upper memory die to said lower compute die at a vertical pitch of 10.0 micrometers or less, wherein each individual vertical memory vault is coupled directly to operand registers of a corresponding systolic matrix tile through vertical through-silicon vias without intermediate planar bus arbiters.

2. The device of Claim 1, wherein said direct hybrid bonding interface operates at a vertical pitch of 6.0 micrometers or less, providing continuous internal memory bandwidth between said upper die and lower die of at least 64.0 Terabytes per second at an energy expenditure of 2.0 picojoules per bit or less.

3. The device of Claim 1, wherein said lower semiconductor compute die further comprises a hardware-fused attention engine configured to execute online softmax normalization synchronously on streaming matrix vectors received from said upper memory die without writing intermediate unnormalized attention maps to external memory.

4. The device of Claim 1, wherein said upper semiconductor memory die has an aggregate SRAM capacity of at least 2,048 Megabytes (2.0 Gigabytes) operating as a low-latency model weight cache for transformer layer activations.

5. A method for accelerating deep neural network token inference in a 3D integrated circuit, comprising the steps of:
   * pre-fetching active model layer weights from a secondary lateral High-Bandwidth Memory (HBM) into an upper 3D-stacked SRAM memory tier;
   * streaming said weights vertically across an array of direct copper-to-copper bonded vias directly into local registers of a lower systolic compute array at an internal bandwidth exceeding 50 Terabytes per second; and
   * executing matrix multiplication and online softmax normalization in a continuous on-chip pipeline without intermediate off-chip DRAM transactions.

---

**Dated this 5th day of September, 2026**

**PADALA DURGA PRASAD**  
(Signature of the Applicant / Inventor)  
Andhra Pradesh, India
