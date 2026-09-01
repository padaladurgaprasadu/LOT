# ==============================================================================
# Synopsys Design Constraints (SDC)
# Target Design: prism_beast_tensor_tile
# Target Technology: TSMC N3P Standard Cells (3nm FinFET / GAA)
# Operating Conditions: 0.75V VDD, 105°C Worst-Case Junction Temperature
# ==============================================================================

# 1. Primary Clock Definition (2.40 GHz = 416.66 ps Period)
create_clock -name "clk" -period 0.41666 [get_ports clk]

# 2. Clock Uncertainty & Jitter (20 ps Setup / 10 ps Hold)
set_clock_uncertainty -setup 0.020 [get_clocks clk]
set_clock_uncertainty -hold 0.010 [get_clocks clk]
set_clock_transition 0.015 [get_clocks clk]

# 3. Input & Output Timing Delays (3D Cu-Cu Direct Via Interfaces)
set_input_delay -clock clk -max 0.080 [get_ports act_in*]
set_input_delay -clock clk -min 0.020 [get_ports act_in*]

set_input_delay -clock clk -max 0.050 [get_ports weight_in*]
set_input_delay -clock clk -min 0.015 [get_ports weight_in*]

set_output_delay -clock clk -max 0.080 [get_ports acc_matrix_out*]
set_output_delay -clock clk -min 0.020 [get_ports acc_matrix_out*]

# 4. Physical Drive & Load Constraints
set_driving_cell -lib_cell INVX1_N3P [get_ports {act_in* weight_in* enable clear_acc}]
set_load 0.005 [get_ports {act_out* weight_out* acc_matrix_out*}]

# 5. Timing Derating for On-Chip Variation (AOCV / POCV)
set_timing_derate -early 0.95
set_timing_derate -late 1.05
