# Creative Liberation Engine — Ollama & SSH Tunnel Watchdog
[System.Environment]::SetEnvironmentVariable('OLLAMA_HOST', '0.0.0.0:11434', 'Process')
[System.Environment]::SetEnvironmentVariable('OLLAMA_MODELS', 'D:\Google Antigravity\models', 'Process')

while ($true) {
    try {
        # 1. Check & Ensure Ollama is running
        $ollamaProc = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
        if (-not $ollamaProc) {
            Start-Process -FilePath "C:\Users\jahar\AppData\Local\Programs\Ollama\ollama.exe" -ArgumentList "serve" -WindowStyle Hidden
            Start-Sleep -Seconds 4
        }

        # 2. Check & Ensure SSH Tunnel is running
        $sshProcs = Get-Process -Name "ssh" -ErrorAction SilentlyContinue
        $tunnelRunning = $false
        foreach ($p in $sshProcs) {
            try {
                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)").CommandLine
                if ($cmdLine -like "*11435*") {
                    $tunnelRunning = $true
                }
            } catch {
                $tunnelRunning = $true
            }
        }

        if (-not $tunnelRunning) {
            Start-Process -FilePath "ssh" -ArgumentList "-o StrictHostKeyChecking=no -N -R 11435:localhost:11434 -p 2000 admin@127.0.0.1" -WindowStyle Hidden
            Start-Sleep -Seconds 2
        }

        # 3. Adjust priorities
        $processes = Get-Process -Name "ollama", "ollama_llama_server" -ErrorAction SilentlyContinue
        foreach ($p in $processes) {
            if ($p.PriorityClass -ne [System.Diagnostics.ProcessPriorityClass]::BelowNormal) {
                $p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal
            }
        }
    } catch {
        # Ignore errors
    }
    
    Start-Sleep -Seconds 10
}

