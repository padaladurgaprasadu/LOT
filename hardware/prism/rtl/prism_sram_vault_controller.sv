// ============================================================================
// Module: prism_sram_vault_controller
// Project: PRISM Silicon Gen 4
// Description: 3D Copper-to-Copper Direct-Bonded SRAM Vault Memory Controller
// Target: TSMC 3D SoIC-X Hybrid Bonded Interface (6μm pitch, roadmap <1μm)
// Bandwidth: 128 Banks × 2048-bit × 2.4 GHz = 78.6 TB/s Peak (>64 TB/s spec)
// ============================================================================

`timescale 1ns / 1ps

module prism_sram_vault_controller #(
    parameter VAULT_BANKS   = 128,   // 128 Parallel On-Chip Memory Vaults
    parameter ADDR_WIDTH    = 24,    // 24-bit Local SRAM Address Space (16MB per Vault)
    parameter DATA_WIDTH    = 2048   // 2048-bit (256-byte) Wide Parallel Data Bus per Vault
)(
    input  wire                                 clk,
    input  wire                                 rst_n,
    
    // Core Tile Memory Request Interface
    input  wire [VAULT_BANKS-1:0]               req_valid,
    input  wire [VAULT_BANKS-1:0]               req_write,
    input  wire [VAULT_BANKS-1:0][ADDR_WIDTH-1:0] req_addr,
    input  wire [VAULT_BANKS-1:0][DATA_WIDTH-1:0] req_wdata,
    
    // Core Tile Data Return Interface
    output reg  [VAULT_BANKS-1:0]               resp_valid,
    output reg  [VAULT_BANKS-1:0][DATA_WIDTH-1:0] resp_rdata,
    
    // 3D Cu-Cu Physical Via Interface (Direct to Top Die)
    output wire [VAULT_BANKS-1:0][ADDR_WIDTH-1:0] via_sram_addr,
    output wire [VAULT_BANKS-1:0][DATA_WIDTH-1:0] via_sram_wdata,
    output wire [VAULT_BANKS-1:0]                 via_sram_we,
    input  wire [VAULT_BANKS-1:0][DATA_WIDTH-1:0] via_sram_rdata
);

    genvar b;
    generate
        for (b = 0; b < VAULT_BANKS; b = b + 1) begin : gen_vault_ports
            assign via_sram_addr[b]  = req_addr[b];
            assign via_sram_wdata[b] = req_wdata[b];
            assign via_sram_we[b]    = req_valid[b] & req_write[b];
        end
    endgenerate

    integer i;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            resp_valid <= {VAULT_BANKS{1'b0}};
            for (i = 0; i < VAULT_BANKS; i = i + 1) begin
                resp_rdata[i] <= {DATA_WIDTH{1'b0}};
            end
        end else begin
            for (i = 0; i < VAULT_BANKS; i = i + 1) begin
                resp_valid[i] <= req_valid[i] & ~req_write[i];
                if (req_valid[i] & ~req_write[i]) begin
                    // Zero-cycle sub-nanosecond direct 3D Cu-Cu wire read latency
                    resp_rdata[i] <= via_sram_rdata[i];
                end
            end
        end
    end

endmodule
