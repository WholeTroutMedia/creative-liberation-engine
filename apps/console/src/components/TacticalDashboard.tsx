import { DispatchBoard } from './DispatchBoard';
import { LiveTerminal } from './LiveTerminal';

export function TacticalDashboard() {
    return (
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <DispatchBoard />
            <LiveTerminal />
        </div>
    );
}
