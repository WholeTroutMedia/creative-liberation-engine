import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import './LayoutShell.css';

export function LayoutShell({ children }: { children: React.ReactNode }) {
    const [cmdOpen, setCmdOpen] = useState(false);

    // Toggle cmdk palette
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setCmdOpen((open) => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    return (
        <div className="layout-shell">
            {/* Top Bar */}
            <header className="tactical-topbar">
                <div className="topbar-logo">CLE // SOVEREIGN ENGINE</div>
                <nav className="topbar-nav">
                    <NavLink to="/" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>HUD</NavLink>
                    <NavLink to="/health" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>HEALTH</NavLink>
                    <NavLink to="/nexus" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>NEXUS</NavLink>
                    <NavLink to="/flows" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>FLOWS</NavLink>
                </nav>
                <div className="topbar-status">
                    <span className="status-dot ok"></span> LIVE (Cmd+K)
                </div>
            </header>

            {/* Main Content Area */}
            <main className="tactical-main">
                {children}
            </main>

            {/* Command Palette Overlay */}
            {cmdOpen && (
                <div className="cmdk-overlay" onClick={() => setCmdOpen(false)}>
                    <div className="cmdk-modal" onClick={e => e.stopPropagation()}>
                        <div className="cmdk-header">COMMAND PALETTE</div>
                        <input className="cmdk-input" placeholder="Type a command or search..." autoFocus />
                        <div className="cmdk-body">
                            {/* Will integrate actual cmdk later */}
                            <div className="cmdk-item">Go to Dashboard</div>
                            <div className="cmdk-item">Open Console Health</div>
                            <div className="cmdk-item">Create New Task</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
