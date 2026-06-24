import { usePulseStore } from '../../store/usePulseStore';

export function IntentSection() {
  const intentText = usePulseStore(s => s.intentText);
  const intentTags = usePulseStore(s => s.intentTags);
  const isOracleLoading = usePulseStore(s => s.isOracleLoading);
  const oracleReasoning = usePulseStore(s => s.oracleReasoning);
  const setIntentText = usePulseStore(s => s.setIntentText);
  const applyIntent = usePulseStore(s => s.applyIntent);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) applyIntent();
  };

  return (
    <>
      <textarea
        className="intent-textarea"
        value={intentText}
        onChange={e => setIntentText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe the feeling you're after..."
        spellCheck={false}
      />
      {intentTags.length > 0 && (
        <div className="intent-tags">
          {intentTags.map(tag => (
            <span key={tag} className="intent-tag">{tag}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          className="intent-apply"
          onClick={applyIntent}
          disabled={isOracleLoading}
        >
          {isOracleLoading ? '⟳ Thinking…' : '↵ Apply'}
        </button>
      </div>
      {oracleReasoning && (
        <details className="oracle-card" style={{ marginTop: 8 }}>
          <summary>Agent Reasoning</summary>
          <p style={{ marginTop: 6 }}>{oracleReasoning.summary}</p>
        </details>
      )}
    </>
  );
}
