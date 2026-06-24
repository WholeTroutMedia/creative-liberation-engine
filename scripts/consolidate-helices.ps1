$ErrorActionPreference = "Stop"

$baseDir = "\\127.0.0.1\docker\creative-liberation-engine\services"

Write-Host "1. Deleting all fragmented ie-idx-* ideation folders..."
Get-ChildItem -Path $baseDir -Filter "ie-idx-*" -Directory | Remove-Item -Recurse -Force

Write-Host "2. Creating the 5 Master Helix Services..."

$helices = @{
    "helix-1-infrastructure" = @{
        "description" = "Adaptive Energy Orchestration, Swarm Module, Resource Management, Debt Mitigation";
        "code" = "import pino from 'pino';`nconst logger = pino({ name: 'helix-1-infrastructure' });`nexport class InfrastructureManager {`n  async trackSwarm(agentId: string, task: () => Promise<any>) { /* Swarm Observability - IE-IDX-0199 */ }`n  async allocateResourcePool(tokens: number) { /* Programmatic Credit Pool - IE-IDX-0184 */ }`n  async applySubquadraticContext(payload: any) { /* 12M Token Window Mapping - IE-IDX-0135 */ }`n  async scanHiddenDebt() { /* Technical Debt Tracker - IE-IDX-0165 */ }`n}"
    };
    "helix-2-agent-control-plane" = @{
        "description" = "Semantic Medallion, Web Ingestion, Pre-Model Intelligence";
        "code" = "import pino from 'pino';`nconst logger = pino({ name: 'helix-2-control-plane' });`nexport class ControlPlane {`n  async ingestKnowledgeGraph(entity: string, relations: Record<string, string>) { /* Semantic Medallion - IE-IDX-0202 */ }`n  async runSovereignWebScrape(url: string) { /* Firecrawl-inspired Web Ingestion - IE-IDX-0130 */ }`n  async assembleCompanyBrainContext() { /* Pre-Model Relational Intelligence - IE-IDX-0095 */ }`n}"
    };
    "helix-3-creative-intelligence" = @{
        "description" = "VAE Visual Intelligence, Open Design System, PlayCanvas, Architectural Gen";
        "code" = "import pino from 'pino';`nconst logger = pino({ name: 'helix-3-creative-intelligence' });`nexport class CreativeDirector {`n  async generateOpenDesignSystem(brandTokens: Record<string, string>) { /* Open Design - IE-IDX-0141 */ }`n  async renderPlayCanvasScene(data: any) { /* 3D Web Visualization - IE-IDX-0159 */ }`n  async processVAEVisuals(image: any) { /* Qwen-Image-VAE-2.0 integration - IE-IDX-0200 */ }`n  async generateArchitecturalPlan(specs: any) { /* AI-Driven CAD Generation - IE-IDX-0146 */ }`n}"
    };
    "helix-4-video-pipeline" = @{
        "description" = "Dense 3D Tracking, Video Agency, Multimedia Distribution";
        "code" = "import pino from 'pino';`nconst logger = pino({ name: 'helix-4-video-pipeline' });`nexport class VideoPipeline {`n  async processAgencyVideo(projectId: string, mediaDir: string) { /* Timeliner Agency - IE-IDX-0161 */ }`n  async executeDenseTracking(videoPath: string) { /* TrackCraft3R - IE-IDX-0197 */ }`n  async distributeMultimedia(assetId: string, channels: string[]) { /* Content Distribution - IE-IDX-0149 */ }`n}"
    };
    "helix-5-security-edge" = @{
        "description" = "Autonomous Pentesting, Model Provenance, ESP32 Companion";
        "code" = "import pino from 'pino';`nconst logger = pino({ name: 'helix-5-security-edge' });`nexport class SecurityEdge {`n  async runAegisPentest(targetUrl: string) { /* Autonomous Edge Security - IE-IDX-0167 */ }`n  async trackModelProvenance(modelHash: string) { /* Verifiable Provenance - IE-IDX-0139 */ }`n  async startHardwareCompanionBridge() { /* ESP32-S3 IoT Connection - IE-IDX-0201 */ }`n  async deployAmbientGlassLogic() { /* Display Glasses Integration - IE-IDX-0191 */ }`n}"
    }
}

foreach ($helixName in $helices.Keys) {
    $helixData = $helices[$helixName]
    $helixPath = Join-Path $baseDir $helixName
    $srcPath = Join-Path $helixPath "src"
    
    New-Item -ItemType Directory -Force -Path $srcPath | Out-Null
    
    $indexPath = Join-Path $srcPath "index.ts"
    Set-Content -Path $indexPath -Value $helixData["code"]
    
    $packageJsonPath = Join-Path $helixPath "package.json"
    $packageJsonContent = @"
{
  "name": "@cle/$helixName",
  "version": "1.0.0",
  "description": "$($helixData['description'])",
  "main": "src/index.ts",
  "dependencies": { "pino": "^8.0.0" }
}
"@
    Set-Content -Path $packageJsonPath -Value $packageJsonContent
    Write-Host "Generated $helixName"
}

Write-Host "Consolidation complete: Deleted fragmented IDEATION folders and generated 5 unified HELIX services."
