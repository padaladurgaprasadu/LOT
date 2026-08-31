// ============================================================================
// Module: prism_beast_tensor_tile
// Project: PRISM Silicon Gen 4
// Description: 16x16 Mixed-Precision Systolic Matrix-Multiply-Accumulate Tile
// Target: TSMC N3P Standard Cells @ 2.4 GHz
// Architecture: 3D Copper-to-Copper Direct-Bonded SRAM Interfaced Matrix Engine
// ============================================================================

`timescale 1ns / 1ps

module prism_beast_tensor_tile #(
    parameter DATA_WIDTH_IN  = 8,   // FP8 / INT8 Input Operands
    parameter DATA_WIDTH_ACC = 32,  // FP32 Internal Accumulation Register
    parameter MATRIX_SIZE    = 16   // 16x16 Systolic Grid Dimension
)(
    input  wire                                clk,
    input  wire                                rst_n,
    input  wire                                enable,
    input  wire                                clear_acc,
    
    // Activation inputs flowing horizontally (West to East)
    input  wire [MATRIX_SIZE-1:0][DATA_WIDTH_IN-1:0]  act_in,
    output reg  [MATRIX_SIZE-1:0][DATA_WIDTH_IN-1:0]  act_out,
    
    // Weight inputs flowing vertically from 3D-stacked SRAM Vault (North to South)
    input  wire [MATRIX_SIZE-1:0][DATA_WIDTH_IN-1:0]  weight_in,
    output reg  [MATRIX_SIZE-1:0][DATA_WIDTH_IN-1:0]  weight_out,
    
    // Output 32-bit Accumulated Matrix Results
    output reg  [MATRIX_SIZE-1:0][MATRIX_SIZE-1:0][DATA_WIDTH_ACC-1:0] acc_matrix_out
);

    // Internal Systolic Processing Element (PE) Registers
    reg [DATA_WIDTH_IN-1:0]  pe_act   [0:MATRIX_SIZE-1][0:MATRIX_SIZE-1];
    reg [DATA_WIDTH_IN-1:0]  pe_wt    [0:MATRIX_SIZE-1][0:MATRIX_SIZE-1];
    reg [DATA_WIDTH_ACC-1:0] pe_accum [0:MATRIX_SIZE-1][0:MATRIX_SIZE-1];

    integer r, c;

    // Systolic Execution Pipeline
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            for (r = 0; r < MATRIX_SIZE; r = r + 1) begin
                act_out[r]    <= {DATA_WIDTH_IN{1'b0}};
                weight_out[r] <= {DATA_WIDTH_IN{1'b0}};
                for (c = 0; c < MATRIX_SIZE; c = c + 1) begin
                    pe_act[r][c]   <= {DATA_WIDTH_IN{1'b0}};
                    pe_wt[r][c]    <= {DATA_WIDTH_IN{1'b0}};
                    pe_accum[r][c] <= {DATA_WIDTH_ACC{1'b0}};
                    acc_matrix_out[r][c] <= {DATA_WIDTH_ACC{1'b0}};
                end
            end
        end else if (enable) begin
            // 1. Ingest Boundary Data
            for (r = 0; r < MATRIX_SIZE; r = r + 1) begin
                pe_act[r][0] <= act_in[r];
                pe_wt[0][r]  <= weight_in[r];
            end

            // 2. Propagate and Multiply-Accumulate across 2D Systolic Grid
            for (r = 0; r < MATRIX_SIZE; r = r + 1) begin
                for (c = 0; c < MATRIX_SIZE; c = c + 1) begin
                    if (clear_acc) begin
                        pe_accum[r][c] <= (pe_act[r][c] * pe_wt[r][c]);
                    end else begin
                        // Multiply-Accumulate: D = A * B + C
                        pe_accum[r][c] <= pe_accum[r][c] + (pe_act[r][c] * pe_wt[r][c]);
                    end

                    // Horizontal shift (Activations move East)
                    if (c < MATRIX_SIZE - 1) begin
                        pe_act[r][c+1] <= pe_act[r][c];
                    end

                    // Vertical shift (Weights move South)
                    if (r < MATRIX_SIZE - 1) begin
                        pe_wt[r+1][c] <= pe_wt[r][c];
                    end
                end
            end

            // 3. Egress Boundary Signals
            for (r = 0; r < MATRIX_SIZE; r = r + 1) begin
                act_out[r]    <= pe_act[r][MATRIX_SIZE-1];
                weight_out[r] <= pe_wt[MATRIX_SIZE-1][r];
            end

            // 4. Update Output Matrix Port
            for (r = 0; r < MATRIX_SIZE; r = r + 1) begin
                for (c = 0; c < MATRIX_SIZE; c = c + 1) begin
                    acc_matrix_out[r][c] <= pe_accum[r][c];
                end
            end
        end
    end

endmodule
