import { createContext, useContext, useState, useEffect } from 'react';

const TelemetryContext = createContext(null);

const NAS_SSE_URL = 'http://127.0.0.1:5160/sse';

export function TelemetryProvider({ children }) {
  const [telemetry, setTelemetry] = useState({
    latency: 12,
    systemsNominal: true,
    globalHeat: 78.4,
    nodesActive: 14209,
    dispatch: {
      pending: 3,
      active: 1,
      resolved: 12
    },
    agents: [
      {
        id: 'ATHENA',
        name: 'ATHENA',
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBWN2ULoYes2e8uwL7A7-GF8oDM5zCcfVGjY_5TWZbK8XXJaj0tHccpIIaT4ydbdgKMewKcc7g2CdTnYWBz7-zmf2Y-SEcI6c9hBjxo6SDPZWhCD2w7orFVSMQWYyE3viRHv71cnY23fRuDWInAAQCKfOi-vtVwGluhR0WXpOyFbamJ5f5GD2CogAdh_Pae_LqDcmbCyhXULpJyXWqLXDpbFMXNjFxwcstwFa9KJdLde2E3GL7Tcn4DB3OMjsVaqsEDILVit4w5bQ',
        status: 'ONLINE // CORE_SYSTEM',
        statusColor: '#00ff41',
        cpu: 42,
        gpu: 88,
        uptime: '142:12:05',
        isActive: true
      },
      {
        id: 'VERA',
        name: 'VERA',
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcH08Unb9hnaQYq3ij6aIi9VxYwOl1Tj9fzdxeQ8NphWdlaIWXpI8DCBJ84c83c14rVd-_tKqonukenKpfuKMvUn7RiEHQ-LscC4DZ1pfRjWuIn6jYXC-B5bb9DVmCV4KHKr1KH_rlJtUgiatgf0voEaz8QxnuuHEvigs1AzAXMPh9ZFDc9vSUYXzV0z-kyM9hxuBySYBpjIfaSWJxeBhmUtKGgS0LxZKvPdV8tMBlkceA96NHlKDvHwm3JL5JpNx0_5oCtdtNig',
        status: 'BUSY // INTEL_SCAN',
        statusColor: '#00ff41',
        cpu: 76,
        gpu: 92,
        uptime: '89:44:12',
        isActive: true
      },
      {
        id: 'IRIS',
        name: 'IRIS',
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYY6Y198XPM1dOdWjcNfHKNf_4UStZ2TgosDI6YmzzZE50SI86L2r6xK-BxNKw-se-mjd2axISNXfTjUTPWPXEal8o4FZZTd5ZQ_vUIkNHMhHYcl7PbBNZCMKbeiSZLaxxbdtZUGn9ATRrSt9_3bgcNXhRFAba2-X8ePwg2mX2RhDcGHZ0EsKONeJkYuBejlkLiZbPP1gK7jiHu4ULLVgRR1pw56b8Ii-bvsJ_i3ZK53xarAMBevYoNwQGNxfNGUOSFBPGSpqvdw',
        status: 'OFFLINE // STANDBY',
        statusColor: '#dfe2eb',
        cpu: 0,
        gpu: 0,
        uptime: '00:00:00',
        isActive: false
      }
    ],
    memoryLogs: [
      { id: 1, time: '14:22:01', tag: '[SEC_LOG]', text: 'Unauthorized access attempt blocked from IP: 192.168.1.104', type: 'normal' },
      { id: 2, time: '14:22:04', tag: '[SYS]', text: 'Kernel update synchronized across all local nodes.', type: 'sys' },
      { id: 3, time: '14:22:15', tag: '[AGENT_ATHENA]', text: 'Processing intelligence packet #8442 - Priority assigned: LOW', type: 'agent' },
      { id: 4, time: '14:23:00', tag: '[CRITICAL]', text: 'Satellite ping timeout in Sector 7G. Re-routing through NODE_B.', type: 'error' },
      { id: 5, time: '14:23:12', tag: '[AGENT_VERA]', text: 'Establishing neural link with orbital asset ALPHA_ZERO...', type: 'agent' },
      { id: 6, time: '14:23:15', tag: '[SYS]', text: 'Link established. Signal strength: 98.4%.', type: 'sys' },
    ],
    inbox: {
      newAlerts: 2,
      items: [
        { id: 1, type: 'PRIORITY_ALERT', icon: 'report', time: '02 MIN AGO', title: 'Satellite intercept confirmed in sector 7', desc: 'Encrypted data stream detected originating from abandoned relay station 404. Agent deployment recommended.', priority: 'high' },
        { id: 2, type: 'INTEL_BRIEF', icon: 'info', time: '14 MIN AGO', title: 'Regional Network Fluctuation', desc: 'Minor outages reported in the Neo-Tokyo grid. Analyzing potential correlation with OP_GHOST_RUN.', priority: 'normal' },
        { id: 3, type: 'CRITICAL_BREACH', icon: 'warning', time: '22 MIN AGO', title: 'Encryption Vault Compromised', desc: 'Sub-level 4 security layers have been bypassed. Immediate lockdown of all archive modules initiated.', priority: 'critical' }
      ]
    }
  });

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let eventSource;
    let fallbackInterval;

    const connectSSE = () => {
      try {
        eventSource = new EventSource(NAS_SSE_URL);
        
        eventSource.onopen = () => {
          setIsConnected(true);
          console.log('Connected to NAS Telemetry Stream');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setTelemetry(prev => ({
              ...prev,
              ...data
            }));
          } catch (e) {
            console.error('Error parsing SSE telemetry:', e);
          }
        };

        eventSource.onerror = () => {
          console.warn('SSE connection lost or failed. Falling back to simulation.');
          eventSource.close();
          setIsConnected(false);
          startFallback();
        };
      } catch (e) {
        console.warn('Failed to initialize EventSource. Falling back to simulation.');
        startFallback();
      }
    };

    const startFallback = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(() => {
        setTelemetry(prev => {
          const newTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
          
          // Randomly add a new memory log occasionally
          let newLogs = [...prev.memoryLogs];
          if (Math.random() > 0.7) {
            const tags = ['[SYS]', '[NET]', '[AGENT_VERA]', '[SEC_LOG]', '[AGENT_ATHENA]'];
            const texts = [
              'Recalibrating quantum flux capacitors.',
              'Packet loss detected on outer rim relays.',
              'Analyzing atmospheric anomaly in sector 4.',
              'Firewall rules updated successfully.',
              'Ping latency spike detected: 145ms.',
              'Neural link stabilization in progress...'
            ];
            const typeMap = {
              '[SYS]': 'sys', '[NET]': 'sys', '[AGENT_VERA]': 'agent', '[AGENT_ATHENA]': 'agent', '[SEC_LOG]': 'normal'
            };
            const tag = tags[Math.floor(Math.random() * tags.length)];
            newLogs.push({
              id: Date.now(),
              time: newTime,
              tag: tag,
              text: texts[Math.floor(Math.random() * texts.length)],
              type: typeMap[tag]
            });
            if (newLogs.length > 50) newLogs.shift();
          }

          return {
            ...prev,
            latency: Math.max(5, Math.floor(prev.latency + (Math.random() * 4 - 2))),
            globalHeat: Math.min(100, Math.max(0, +(prev.globalHeat + (Math.random() * 2 - 1)).toFixed(1))),
            nodesActive: prev.nodesActive + Math.floor(Math.random() * 5 - 2),
            agents: prev.agents.map(agent => {
              if (!agent.isActive) return agent;
              return {
                ...agent,
                cpu: Math.min(100, Math.max(5, agent.cpu + Math.floor(Math.random() * 10 - 5))),
                gpu: Math.min(100, Math.max(5, agent.gpu + Math.floor(Math.random() * 10 - 5))),
              };
            }),
            memoryLogs: newLogs
          };
        });
      }, 2000);
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  return (
    <TelemetryContext.Provider value={{ ...telemetry, isConnected }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}
