# Creative Liberation Engine Auto-Pairing & Device Ingestion Scribe
# This script continuously polls for direct USB (ADB) and Bluetooth (BLE) connections of the Ray-Ban Meta glasses.

$Adb = "y:\creative-liberation-engine\scratch\platform-tools\adb.exe"
$DurationSeconds = 120
$IntervalSeconds = 3

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " 🕶️  CLE Spatial OS Bridge - Auto-Pairing Daemon " -ForegroundColor Cyan
Write-Host " - Running for $DurationSeconds seconds. Interval: $IntervalSeconds s." -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# ─────────────────────────────────────────────────────────────────────────────
# 1. WINRT BLUETOOTH DISCOVERY INITIALIZATION
# ─────────────────────────────────────────────────────────────────────────────

[void][Windows.Devices.Enumeration.DeviceInformation, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Devices.Bluetooth.BluetoothLEDevice, Windows.Foundation, ContentType = WindowsRuntime]

$Selector = [Windows.Devices.Bluetooth.BluetoothLEDevice]::GetDeviceSelector()
$Watcher = [Windows.Devices.Enumeration.DeviceInformation]::CreateWatcher($Selector)

$DevicesFound = @{}

$Watcher.add_Added({
    param($sender, $args)
    if ($args.Name -and ($args.Name -like "*Ray-Ban*" -or $args.Name -like "*Meta*" -or $args.Name -like "*RB*" -or $args.Name -like "*Glasses*")) {
        if (-not $DevicesFound.ContainsKey($args.Id)) {
            $DevicesFound[$args.Id] = $args.Name
            Write-Host "[Bluetooth] Found smart glasses device: $($args.Name) [ID: $($args.Id)]" -ForegroundColor Green
            
            # Attempt WinRT programmatic pairing
            Write-Host "[Bluetooth] Attempting programmatic WinRT pairing handshake..." -ForegroundColor Yellow
            $pairTask = $args.Pairing.PairAsync()
            # Wait for pairing result (standard AOSP requires prompt on phone)
            Write-Host "[Bluetooth] Handshake dispatched. Please monitor your paired smartphone view app for any prompts." -ForegroundColor Magenta
        }
    }
})

$Watcher.Start()
Write-Host "[Bluetooth] Live BLE Discovery Scan started..." -ForegroundColor Gray

# ─────────────────────────────────────────────────────────────────────────────
# 2. USB (ADB) AND GENERAL PAIRING POLL LOOP
# ─────────────────────────────────────────────────────────────────────────────

$StartTime = Get-Date
$UsbLinked = $false

while (((Get-Date) - $StartTime).TotalSeconds -lt $DurationSeconds) {
    # Run ADB devices poll
    $AdbOut = & $Adb devices
    $Devices = @()
    
    foreach ($Line in $AdbOut) {
        if ($Line -match "\s+device$") {
            $Devices += $Line.Split("`t")[0]
        } elseif ($Line -match "\s+unauthorized$") {
            $Serial = $Line.Split("`t")[0]
            Write-Host "[USB] Glasses Detected ($Serial) but UNAUTHORIZED! ⚠️" -ForegroundColor Yellow
            Write-Host "[USB] CRITICAL: Look at your phone's Meta View app screen and tap 'ALLOW USB DEBUGGING'." -ForegroundColor Red
        }
    }

    if ($Devices.Count -gt 0) {
        $UsbLinked = $true
        $GlassesSerial = $Devices[0]
        Write-Host "[USB] Glasses CONNECTED & AUTHORIZED (Serial: $GlassesSerial) 🎉" -ForegroundColor Green
        
        # Pull system properties from glasses shell to verify AOSP status
        $Model = & $Adb -s $GlassesSerial shell getprop ro.product.model
        $Ver = & $Adb -s $GlassesSerial shell getprop ro.build.version.release
        Write-Host "[USB] Hardware Specs: $Model (AOSP Version $Ver)" -ForegroundColor Cyan
        
        # Launch real-time logcat forwarding to the workspace log
        Write-Host "[USB] Launching direct logcat diagnostic forwarder..." -ForegroundColor Gray
        Start-Process -FilePath $Adb -ArgumentList "-s $GlassesSerial logcat *:S CLESpatialOSBridge:D Chromium:I" -NoNewWindow
        
        # Launch spatial bridge E2E simulation script
        Write-Host "[USB] Instantly triggering E2E spatial surface bridge validation..." -ForegroundColor Green
        node y:\creative-liberation-engine\scripts\validate-spatial-bridge.js
        break
    }

    Start-Sleep -Seconds $IntervalSeconds
}

$Watcher.Stop()
Write-Host "[Daemon] Discovery loop terminated." -ForegroundColor Gray
