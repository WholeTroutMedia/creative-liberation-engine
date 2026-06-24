// PULSE Dashboard Application

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const hrValue = document.getElementById('hr-value');
    const hrvValue = document.getElementById('hrv-value');
    const rrValue = document.getElementById('rr-value');
    const stressValue = document.getElementById('stress-value');
    const bvpCanvas = document.getElementById('bvp-canvas');
    const connectionStatus = document.getElementById('connection-status');

    let ctx = bvpCanvas ? bvpCanvas.getContext('2d') : null;
    let bvpData = [];
    const maxBvpPoints = 150;

    // Connect to WebSocket
    const wsUrl = `ws://${window.location.hostname}:8765`;
    let ws = null;

    function connectWebSocket() {
        console.log(`Connecting to PULSE WebSocket at ${wsUrl}...`);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Connected to PULSE WebSocket');
            if (connectionStatus) {
                connectionStatus.textContent = 'CONNECTED';
                connectionStatus.style.color = 'var(--neon-green)';
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                updateDashboard(data);
            } catch (err) {
                console.error("Error parsing WebSocket data", err);
            }
        };

        ws.onclose = () => {
            console.log('Disconnected from PULSE WebSocket');
            if (connectionStatus) {
                connectionStatus.textContent = 'DISCONNECTED';
                connectionStatus.style.color = 'var(--neon-red)';
            }
            // Reconnect after 3 seconds
            setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (err) => {
            console.error('WebSocket error', err);
        };
    }

    function updateDashboard(data) {
        // Update metric values
        if (data.heart_rate !== undefined && data.heart_rate !== null) {
            hrValue.textContent = Math.round(data.heart_rate);
        }
        if (data.hrv !== undefined && data.hrv !== null) {
            hrvValue.textContent = Math.round(data.hrv);
        }
        if (data.respiratory_rate !== undefined && data.respiratory_rate !== null) {
            rrValue.textContent = Math.round(data.respiratory_rate);
        }
        if (data.stress_index !== undefined && data.stress_index !== null) {
            stressValue.textContent = Math.round(data.stress_index);
        }

        // Update BVP chart if raw_bvp is present
        if (data.raw_bvp !== undefined && data.raw_bvp !== null) {
            bvpData.push(data.raw_bvp);
            if (bvpData.length > maxBvpPoints) {
                bvpData.shift();
            }
            drawBvpChart();
        }
    }

    function drawBvpChart() {
        if (!ctx || bvpData.length === 0) return;

        // Resize canvas to match display size
        const width = bvpCanvas.clientWidth;
        const height = bvpCanvas.clientHeight;
        if (bvpCanvas.width !== width || bvpCanvas.height !== height) {
            bvpCanvas.width = width;
            bvpCanvas.height = height;
        }

        ctx.clearRect(0, 0, width, height);

        // Find min and max for auto-scaling
        let min = Math.min(...bvpData);
        let max = Math.max(...bvpData);
        
        // Add some padding to the range
        const range = max - min;
        if (range === 0) {
            min -= 1;
            max += 1;
        } else {
            min -= range * 0.1;
            max += range * 0.1;
        }

        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = '#00FF41'; // var(--neon-green)
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';

        for (let i = 0; i < bvpData.length; i++) {
            const x = (i / (maxBvpPoints - 1)) * width;
            const normalizedY = (bvpData[i] - min) / (max - min);
            const y = height - (normalizedY * height);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    }

    // Initialize
    connectWebSocket();
    
    // Window resize handler for canvas
    window.addEventListener('resize', drawBvpChart);
});
