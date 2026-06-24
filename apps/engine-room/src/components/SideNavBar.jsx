const NavGroup = ({ label, children }) => (
  <div className="mb-6">
    <div className="px-4 mb-2 text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase">
      {label}
    </div>
    <div className="space-y-0.5">
      {children}
    </div>
  </div>
);

const NavLink = ({ id, icon, label, currentView, onNavigate }) => {
  const isActive = currentView === id;
  return (
    <a 
      className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-md transition-all text-[12px] cursor-pointer ${
        isActive 
          ? "bg-[var(--color-surface-hover)] text-[var(--color-primary)] font-medium" 
          : "text-[var(--color-primary-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)]"
      }`}
      onClick={() => onNavigate(id)}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      <span>{label}</span>
      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"></span>}
    </a>
  );
};

export default function SideNavBar({ currentView, onNavigate }) {
  return (
    <aside className="fixed left-0 top-12 bottom-0 flex flex-col py-4 bg-[var(--color-surface-panel)] w-64 border-r border-[var(--color-surface-border)] z-40">
      
      {/* User / Workspace Identity */}
      <div className="px-4 mb-8">
        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-[var(--color-surface-hover)] cursor-pointer transition-colors border border-transparent hover:border-[var(--color-surface-border)]">
          <div className="w-8 h-8 rounded bg-[var(--color-surface-base)] border border-[var(--color-surface-border)] flex items-center justify-center">
            <span className="material-symbols-outlined text-[var(--color-primary)] text-[16px]">account_circle</span>
          </div>
          <div className="flex-1">
            <div className="font-medium text-[13px] text-[var(--color-primary)]">Sovereign Artist</div>
            <div className="text-[11px] text-[var(--color-primary-muted)]">Creative Liberation Engine</div>
          </div>
          <span className="material-symbols-outlined text-[var(--color-primary-muted)] text-[16px]">unfold_more</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto">
        <NavGroup label="Admin & Operations">
          <NavLink id="operations" icon="grid_view" label="Dispatch Dashboard" currentView={currentView} onNavigate={onNavigate} />
          <NavLink id="sentinel-track" icon="view_kanban" label="Project Management" currentView={currentView} onNavigate={onNavigate} />
          <NavLink id="workspace" icon="cloud" label="Google Workspace" currentView={currentView} onNavigate={onNavigate} />
        </NavGroup>

        <NavGroup label="Creative & Media">
          <NavLink id="timeline" icon="movie_edit" label="Linear Video Editor" currentView={currentView} onNavigate={onNavigate} />
          <NavLink id="gen-studio" icon="magic_button" label="GenMedia Studio" currentView={currentView} onNavigate={onNavigate} />
          <NavLink id="content-foundry" icon="auto_awesome_mosaic" label="Content Foundry" currentView={currentView} onNavigate={onNavigate} />
          <NavLink id="assets" icon="perm_media" label="Media Assets" currentView={currentView} onNavigate={onNavigate} />
        </NavGroup>

        <NavGroup label="Orchestration">
          <NavLink id="spatial" icon="account_tree" label="Node Systems" currentView={currentView} onNavigate={onNavigate} />
          <NavLink id="intel" icon="hub" label="Agent Network" currentView={currentView} onNavigate={onNavigate} />
        </NavGroup>

        <NavGroup label="Knowledge">
          <NavLink id="scholar-hive" icon="auto_stories" label="Scholar Hive" currentView={currentView} onNavigate={onNavigate} />
          <NavLink id="archive" icon="database" label="Archive" currentView={currentView} onNavigate={onNavigate} />
        </NavGroup>
      </nav>

      {/* Bottom Actions */}
      <div className="px-4 mt-auto pt-4 border-t border-[var(--color-surface-border)]">
        <button className="nexus-button-primary w-full mb-3">
          <span className="material-symbols-outlined text-[14px]">add</span>
          New Operation
        </button>
        <div className="flex justify-between px-2">
          <button className="nexus-button-icon" title="Settings">
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>
          <button className="nexus-button-icon" title="Notifications">
            <span className="material-symbols-outlined text-[18px]">notifications</span>
          </button>
          <button className="nexus-button-icon text-error hover:text-error" title="Logout">
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
