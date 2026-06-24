import { useState } from 'react';
import TopAppBar from './components/TopAppBar';
import SideNavBar from './components/SideNavBar';
import OperationsDashboard from './components/OperationsDashboard';
import GlobalOverlays from './components/GlobalOverlays';
import SpatialPane from './components/SpatialPane';
import SentinelTrackPane from './components/SentinelTrackPane';
import ScholarHivePane from './components/ScholarHivePane';
import WorkspacePane from './components/WorkspacePane';
import LinearEditorPane from './components/LinearEditorPane';
import GenMediaPane from './components/GenMediaPane';
import AssetsPane from './components/AssetsPane';
import AgentNetworkPane from './components/AgentNetworkPane';
import ArchivePane from './components/ArchivePane';
import ContentFoundryPane from './components/ContentFoundryPane';
import './content-foundry.css';

function App() {
  const [currentView, setCurrentView] = useState('operations');

  const renderPane = () => {
    switch (currentView) {
      case 'operations': return <OperationsDashboard />;
      case 'sentinel-track': return <SentinelTrackPane />;
      case 'workspace': return <WorkspacePane />;
      case 'timeline': return <LinearEditorPane />;
      case 'gen-studio': return <GenMediaPane />;
      case 'content-foundry': return <ContentFoundryPane />;
      case 'assets': return <AssetsPane />;
      case 'spatial': return <SpatialPane />;
      case 'intel': return <AgentNetworkPane />;
      case 'scholar-hive': return <ScholarHivePane />;
      case 'archive': return <ArchivePane />;
      default:
        return (
          <div className="h-full flex items-center justify-center text-[var(--color-primary-muted)] font-mono text-sm uppercase">
            Module [{currentView}] initializing...
          </div>
        );
    }
  };

  return (
    <div className="overflow-hidden min-h-screen bg-[var(--color-surface-base)]">
      <GlobalOverlays />
      <TopAppBar />
      <SideNavBar currentView={currentView} onNavigate={setCurrentView} />
      
      <main className="ml-64 mt-12 h-[calc(100vh-3rem)] relative z-10">
        {renderPane()}
      </main>
    </div>
  );
}

export default App;
