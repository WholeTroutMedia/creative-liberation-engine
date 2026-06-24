import { usePulseStore, type PatternId } from '../../store/usePulseStore';

const PATTERNS: Array<{ id: PatternId; label: string; icon: string }> = [
  { id: 'metric-card', label: 'Metric Card', icon: '▦' },
  { id: 'nav-bar',     label: 'Nav Bar',     icon: '☰' },
  { id: 'input-field', label: 'Input Field', icon: '▭' },
  { id: 'modal',       label: 'Modal',       icon: '⬜' },
  { id: 'button',      label: 'Button',      icon: '▬' },
  { id: 'data-table',  label: 'Data Table',  icon: '⊞' },
  { id: 'sidebar',     label: 'Sidebar',     icon: '▏' },
  { id: 'card-grid',   label: 'Card Grid',   icon: '⊟' },
];

export function PatternSection() {
  const activePattern = usePulseStore(s => s.activePattern);
  const setActivePattern = usePulseStore(s => s.setActivePattern);

  return (
    <>
      <p className="label-sm" style={{ marginTop: 8, marginBottom: 2 }}>
        {PATTERNS.length} components · @cle/motion + /spatial
      </p>
      <div className="pattern-grid">
        {PATTERNS.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`pattern-thumb${activePattern === id ? ' active' : ''}`}
            onClick={() => setActivePattern(id)}
            title={label}
          >
            <span style={{ fontSize: 18, color: activePattern === id ? 'var(--amber)' : 'var(--steel)' }}>
              {icon}
            </span>
            <span className="pattern-thumb-label">{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
