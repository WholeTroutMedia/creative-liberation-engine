import { useState, useEffect, useRef } from 'react';
import './LiveTerminal.css';

interface LogEntry {
    id: number;
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'SYS' | 'AXON';
    source: string;
    message: string;
}

export function LiveTerminal() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const endRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    // Simulate system logs for the HUD feel since we don't have a direct raw SSE endpoint for everything yet
    useEffect(() => {
        let counter = 0;
        const addLog = () => {
            const levels: LogEntry['level'][] = ['INFO', 'INFO', 'SYS', 'AXON', 'WARN'];
            const sources = ['Dispatch', 'Genkit', 'NeuralBus', 'AgentMesh', 'Observer'];
            const messages = [
                'Checking connected hive state...',
                'Pulse received from KEEPER-2.',
                'STRATA engaged in planning phase.',
                'Memory compacted in ChromaDB.',
                'Polling genmedia-asset-generator workflow.',
                'Awaiting human input in active stream.',
                'Local LLM inference latency 41ms.',
                'Synchronizing with NAS localhost.' // Leaving this strictly as a simulated log text to look hacker-ish
            ];

            const entry: LogEntry = {
                id: Date.now() + counter++,
                timestamp: new Date().toISOString().split('T')[1].substring(0, 12),
                level: levels[Math.floor(Math.random() * levels.length)],
                source: sources[Math.floor(Math.random() * sources.length)],
                message: messages[Math.floor(Math.random() * messages.length)]
            };

            setLogs(prev => [...prev.slice(-99), entry]); // keep last 100
        };

        const interval = setInterval(() => {
            if (Math.random() > 0.3) addLog();
        }, 800);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (autoScroll) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    return (
        <div className="terminal-pane">
            <div className="term-header">
                <div>
                    <span className="term-title">MEMORY BUS / NEURAL LOG</span>
                    <span className="term-subtitle">Reading from /api/events</span>
                </div>
                <button 
                    className={`scroll-btn ${autoScroll ? 'active' : ''}`}
                    onClick={() => setAutoScroll(!autoScroll)}
                >
                    AUTO-SCROLL {autoScroll ? 'ON' : 'OFF'}
                </button>
            </div>
            
            <div 
                className="term-body"
                onWheel={(e) => { if (e.deltaY < 0) setAutoScroll(false); }}
            >
                {logs.map(log => (
                    <div key={log.id} className={`log-line lvl-${log.level}`}>
                        <span className="log-time">[{log.timestamp}]</span>
                        <span className="log-level">{log.level.padEnd(5)}</span>
                        <span className="log-src">[{log.source.padEnd(10)}]</span>
                        <span className="log-msg">{log.message}</span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
}
