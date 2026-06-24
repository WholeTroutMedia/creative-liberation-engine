$ErrorActionPreference = "Stop"
$baseDir = "\\127.0.0.1\docker\creative-liberation-engine"

$helices = @("helix-1-infrastructure", "helix-2-agent-control-plane", "helix-3-creative-intelligence", "helix-4-video-pipeline", "helix-5-security-edge")

Write-Host "1. Injecting runtime execution loops and generating Dockerfiles..."
foreach ($helix in $helices) {
    $indexPath = Join-Path $baseDir "services\$helix\src\index.ts"
    $currentCode = Get-Content $indexPath -Raw
    
    # Only append if not already appended
    if ($currentCode -notmatch "Execution & Integration Boilerplate") {
        $executionLogic = @"

// -- Execution & Integration Boilerplate --
const http = require('http');
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'online', service: '$helix' }));
});
server.listen(PORT, () => {
  logger.info(`$helix is fully integrated and executing on port ` + PORT);
  console.log(`[CLE ENGINE] $helix LIVE on port ` + PORT);
});
"@
        Set-Content -Path $indexPath -Value ($currentCode + $executionLogic)
    }
    
    # Write Dockerfile
    $dockerfile = @"
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY src ./src
RUN npm install -g typescript ts-node
CMD ["ts-node", "src/index.ts"]
"@
    Set-Content -Path (Join-Path $baseDir "services\$helix\Dockerfile") -Value $dockerfile
}

Write-Host "2. Wiring into docker-compose.nas.yml..."
$composePath = Join-Path $baseDir "docker-compose.nas.yml"
$composeContent = Get-Content $composePath -Raw

$composeAppends = ""
$portStart = 6001

foreach ($helix in $helices) {
    if ($composeContent -notmatch $helix) {
        $composeAppends += @"

  ${helix}:
    image: 127.0.0.1:5000/$helix:latest
    container_name: $helix
    build:
      context: ./services/$helix
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "$portStart:3000"
    environment:
      - NODE_ENV=production
      - DISPATCH_URL=http://127.0.0.1:5050
    networks:
      - cle-mesh
    labels:
      - cle.service=$helix
      - cle.tier=helix
"@
        $portStart++
    }
}

if ($composeAppends.Length -gt 0) {
    Add-Content -Path $composePath -Value $composeAppends
    Write-Host "Added Helices to docker-compose.nas.yml"
} else {
    Write-Host "Helices already present in docker-compose.nas.yml"
}

Write-Host "Integration Script Complete."
