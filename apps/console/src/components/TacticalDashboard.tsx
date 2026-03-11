import { DispatchBoard } from './DispatchBoard';
import { HealthMetricsTab } from './HealthMetricsTab';
import './TacticalDashboard.css';

export function TacticalDashboard() {
    return (
        <div className="tactical-dash-layout">
            <div className="tactical-pane-top">
                <DispatchBoard />
            </div>
            <div className="tactical-pane-bottom">
                <HealthMetricsTab />
            </div>
        </div>
    );
}
