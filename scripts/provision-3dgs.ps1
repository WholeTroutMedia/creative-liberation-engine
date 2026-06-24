# Creative Liberation Engine — 3DGS Environment Provisioning Script
# This script provisions the local workstation with the necessary dependencies
# to run the splat_trainer.py pipeline autonomously.

Write-Host "=== Provisioning 3DGS Training Environment ===" -ForegroundColor Cyan

# 1. Check/Install Miniconda
$condaPath = "C:\Users\jahar\miniconda3\Scripts\conda.exe"
if (-not (Test-Path $condaPath)) {
    Write-Host "Miniconda not found. Downloading..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe" -OutFile "miniconda.exe"
    Write-Host "Installing Miniconda (Silent)..." -ForegroundColor Yellow
    Start-Process -FilePath "miniconda.exe" -ArgumentList "/InstallationType=JustMe /RegisterPython=0 /S /D=C:\Users\jahar\miniconda3" -Wait -NoNewWindow
    Remove-Item "miniconda.exe"
} else {
    Write-Host "Miniconda already installed." -ForegroundColor Green
}

# 2. Check/Install COLMAP
$colmapDir = "C:\Tools\COLMAP"
if (-not (Test-Path "$colmapDir\colmap.exe")) {
    Write-Host "COLMAP not found. Downloading..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $colmapDir | Out-Null
    # Download COLMAP pre-built windows binary
    Invoke-WebRequest -Uri "https://github.com/colmap/colmap/releases/download/3.9.1/COLMAP-3.9.1-windows-cuda.zip" -OutFile "colmap.zip"
    Write-Host "Extracting COLMAP..." -ForegroundColor Yellow
    Expand-Archive -Path "colmap.zip" -DestinationPath $colmapDir -Force
    Remove-Item "colmap.zip"
    
    # Add to User PATH
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$colmapDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$userPath;$colmapDir", "User")
        Write-Host "Added COLMAP to User PATH." -ForegroundColor Green
    }
} else {
    Write-Host "COLMAP already installed." -ForegroundColor Green
}

# 3. Create Nerfstudio Conda Environment
Write-Host "Creating Nerfstudio Conda Environment..." -ForegroundColor Yellow
& $condaPath create -n nerfstudio -y python=3.10
& $condaPath run -n nerfstudio python -m pip install --upgrade pip
& $condaPath run -n nerfstudio pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
& $condaPath run -n nerfstudio pip install nerfstudio

Write-Host "=== Provisioning Complete ===" -ForegroundColor Cyan
Write-Host "To execute pipeline: C:\Users\jahar\miniconda3\condabin\conda.bat activate nerfstudio && python splat_trainer.py --input ..." -ForegroundColor Green
