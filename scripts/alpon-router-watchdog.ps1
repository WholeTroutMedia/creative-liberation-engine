# Creative Liberation Engine — Alpon Router SSH Tunnel Watchdog
# Monitors and maintains:
#   1. Local forward tunnel on port 8888 to the TP-Link travel router (192.168.0.1 or 172.16.60.1) via Alpon X5 (192.168.2.32)
#   2. Remote reverse tunnel on port 8888 to the NAS (127.0.0.1:2000)

while ($true) {
    try {
        # 1. Determine router IP dynamically
        $routerIp = "192.168.0.1"
        $pingTest = ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no alpon@192.168.2.32 "ping -c 1 -W 2 172.16.60.1" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $routerIp = "172.16.60.1"
        }

        # 2. Check if local and remote tunnels are running
        $sshProcs = Get-Process -Name "ssh" -ErrorAction SilentlyContinue
        $localTunnelRunning = $false
        $remoteTunnelRunning = $false

        foreach ($p in $sshProcs) {
            try {
                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)").CommandLine
                if ($cmdLine -like "*8888:$($routerIp):80*") {
                    $localTunnelRunning = $true
                }
                if ($cmdLine -like "*-R 8887:127.0.0.1:8888*") {
                    $remoteTunnelRunning = $true
                }
            } catch {
                # Fallback to avoid spamming
            }
        }

        # If a local tunnel with the WRONG IP is running, kill it
        if (-not $localTunnelRunning) {
            foreach ($p in $sshProcs) {
                try {
                    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)").CommandLine
                    if ($cmdLine -like "*8888:*:80*" -and $cmdLine -notlike "*8888:$($routerIp):80*") {
                        Stop-Process -Id $p.Id -Force
                    }
                } catch {}
            }
            Start-Process -FilePath "ssh" -ArgumentList "-o StrictHostKeyChecking=no -N -L 127.0.0.1:8888:$($routerIp):80 alpon@192.168.2.32" -WindowStyle Hidden
            Start-Sleep -Seconds 2
        }

        # Check/start remote reverse tunnel
        if (-not $remoteTunnelRunning) {
            Start-Process -FilePath "ssh" -ArgumentList "-p 2000 -o StrictHostKeyChecking=no -N -R 8887:127.0.0.1:8888 admin@127.0.0.1" -WindowStyle Hidden
            Start-Sleep -Seconds 2
        }

    } catch {
        # Ignore errors
    }
    
    Start-Sleep -Seconds 15
}

