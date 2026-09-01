# ==============================================================================
# OpenROAD & Yosys RTL-to-GDSII Synthesis Flow Script
# Design: PRISM Gen 4 Beast 16x16 Systolic Matrix Engine
# PDK: TSMC N3P High-Performance Computing (HPC) Standard Cells
# ==============================================================================

# 1. Read Verilog RTL Source
read_verilog -sv ../rtl/prism_beast_tensor_tile.sv
read_verilog -sv ../rtl/prism_sram_vault_controller.sv

# 2. Elaborate Design Hierarchy
hierarchy -top prism_beast_tensor_tile

# 3. High-Level RTL Optimizations & Constant Folding
proc
opt_expr
opt_clean
fsm_detect
fsm_extract
fsm_opt
opt
wreduce
peepopt
opt_clean

# 4. Map Multiply-Accumulate Operators to Dedicated Hard MACs
techmap -map +/mul2dsp.v
opt

# 5. Logic Synthesis into Standard Cell Gates
dfflibmap -liberty ../lib/tsmc_n3p_hpc_typical.lib
abc -liberty ../lib/tsmc_n3p_hpc_typical.lib -script +strash;ifraig;scorr;dc2;dretime;strash;&get,-n;&dch,-f;&nf,{D};&put
clean

# 6. Read SDC Timing Constraints
read_sdc prism_beast_constraints.sdc

# 7. Static Timing Analysis (STA) & Area Reports
sta -clock clk -setup -hold
report_area -detail
report_power -detail

# 8. Export Gate-Level Netlist (for Place-and-Route)
write_verilog -noattr prism_beast_tensor_tile_synth.v
