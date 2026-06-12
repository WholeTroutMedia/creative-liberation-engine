"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
// Initialize the Aegis-Sense MCP Server
const server = new index_js_1.Server({
    name: "aegis-sense-server",
    version: "2.0.3",
}, {
    capabilities: {
        tools: {},
    },
});
// Define tools
const TOOLS = [
    {
        name: "get_hardware_topology",
        description: "Get native hardware configuration details (CPU, RAM, GPU vendor, CUDA cores, disk speed)",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "scan_local_network",
        description: "Perform non-invasive network discovery scanning the local subnet to locate Synology NAS hosts, Gitea servers, or connected MCP nodes",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "get_connected_devices",
        description: "List connected creative peripherals and media equipment (ASIO/CoreAudio interfaces, MIDI controllers, Sony cameras, Stream Decks)",
        inputSchema: { type: "object", properties: {} },
    },
];
// Register the tool list request
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});
// Register the call tool handler
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    try {
        switch (name) {
            case "get_hardware_topology": {
                // Return dummy/mocked hardware spec mapped dynamically (linked to Rust deviced backend later)
                const topology = {
                    cpu: {
                        brand: "AMD Ryzen 9 7950X",
                        physical_cores: 16,
                        logical_cores: 32,
                    },
                    memory: {
                        total_gb: 64,
                        available_gb: 42,
                    },
                    gpu: {
                        vendor: "NVIDIA",
                        model: "GeForce RTX 4090",
                        vram_mb: 24576,
                        cuda_cores: 16384,
                    },
                    storage: [
                        { mount: "C:", total_gb: 2000, free_gb: 1100, is_ssd: true },
                        { mount: "D:", total_gb: 4000, free_gb: 1800, is_ssd: true },
                    ],
                };
                return {
                    content: [{ type: "text", text: JSON.stringify(topology, null, 2) }],
                };
            }
            case "scan_local_network": {
                const netScan = {
                    subnet: "192.168.2.0/24",
                    detected_hosts: [
                        { ip: "192.168.2.1", role: "Router Gateway", status: "online" },
                        { ip: "122.0.3.1", role: "Synology NAS (Sovereign Vault)", services: ["gitea", "docker", "smb", "ssh"], status: "online" },
                    ],
                };
                return {
                    content: [{ type: "text", text: JSON.stringify(netScan, null, 2) }],
                };
            }
            case "get_connected_devices": {
                const devices = {
                    audio_interfaces: [
                        { name: "Universal Audio Apollo Twin USB (ASIO)", channels: "10x12", sample_rate: "96kHz" }
                    ],
                    midi_controllers: [
                        { name: "Ableton Push 3 (USB-MIDI)", ports: 1 }
                    ],
                    cameras: [
                        { name: "Sony Alpha 7R V (UVC/USB-Stream)", connection: "USB-C SuperSpeed" }
                    ],
                    controllers: [
                        { name: "Elgato Stream Deck XL", keys: 32 }
                    ]
                };
                return {
                    content: [{ type: "text", text: JSON.stringify(devices, null, 2) }],
                };
            }
            default:
                throw new Error(`Tool not found: ${name}`);
        }
    }
    catch (error) {
        return {
            isError: true,
            content: [{ type: "text", text: error.message || "Unknown error" }],
        };
    }
});
// Run STDIO transport
async function run() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("Aegis-Sense MCP server running on stdio");
}
run().catch((error) => {
    console.error("Fatal error running MCP server:", error);
    process.exit(1);
});
//# sourceMappingURL=mcp_server.js.map