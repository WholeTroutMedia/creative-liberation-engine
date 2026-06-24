import { useMemo } from 'react';
import { usePulseStore } from '../../store/usePulseStore';

// ─── Score Gauge (SVG circular arc) ──────────────────────────────────────────

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const R = 48;
  const circumference = 2 * Math.PI * R;
  const progress = (score / 100) * circumference;

  return (
    <div className="score-gauge-wrap">
      <svg
        className="score-gauge-svg"
        width="120"
        height="120"
        viewBox="0 0 120 120"
      >
        {/* Track */}
        <circle
          cx="60" cy="60" r={R}
          fill="none"
          stroke="var(--border)"
          strokeWidth="8"
        />
        {/* Amber arc */}
        <circle
          cx="60" cy="60" r={R}
          fill="none"
          stroke="var(--amber)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          strokeDashoffset={circumference * 0.25}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        {/* Score text */}
        <text
          x="60" y="55"
          textAnchor="middle"
          fontSize="24"
          fontWeight="700"
          fill="var(--white)"
          fontFamily="'Space Grotesk', sans-serif"
        >
          {score}
        </text>
        <text
          x="60" y="72"
          textAnchor="middle"
          fontSize="11"
          fill="var(--steel)"
          fontFamily="'JetBrains Mono', monospace"
        >
          /100
        </text>
      </svg>
      <div className="grade-badge font-display">{grade}</div>
    </div>
  );
}

// ─── Audit Items ──────────────────────────────────────────────────────────────

function AuditItems() {
  const veraIssues = usePulseStore(s => s.veraIssues);
  const applyAutoFix = usePulseStore(s => s.applyAutoFix);

  if (veraIssues.length === 0) {
    return <p className="label-sm" style={{ padding: '8px 0' }}>Running audit…</p>;
  }

  return (
    <>
      {veraIssues.map(issue => (
        <div key={issue.id} className="audit-item">
          <span className="audit-item-icon">
            {issue.type === 'pass' ? '✓' : issue.type === 'warn' ? '⚠' : '✕'}
          </span>
          <div className="audit-item-text" style={{
            color: issue.type === 'pass' ? 'var(--green)' : issue.type === 'warn' ? 'var(--amber)' : 'var(--red)'
          }}>
            {issue.message}
            {issue.fixable && issue.type !== 'pass' && (
              <div>
                <button
                  className="audit-fix-btn"
                  onClick={() => applyAutoFix(issue.id)}
                >
                  Auto-fix →
                </button>
              </div>
            )}
            {!issue.fixable && issue.type === 'fail' && (
              <div>
                <button className="audit-inspect-btn">Inspect →</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Component Ancestry ───────────────────────────────────────────────────────

function ComponentAncestry() {
  const activePattern = usePulseStore(s => s.activePattern);

  const nodes = [
    { label: 'accent.primary', indent: 0 },
    { label: 'surface.card',   indent: 1 },
    { label: activePattern,    indent: 2, bold: true },
  ];

  return (
    <div className="ancestry-tree">
      {nodes.map((n, i) => (
        <div key={i} className="ancestry-node" style={{ paddingLeft: n.indent * 14 }}>
          {n.indent > 0 && <div className="ancestry-line" />}
          <div className="ancestry-dot" />
          <span style={{ fontWeight: n.bold ? 700 : 400, color: n.bold ? 'var(--white)' : 'var(--steel)' }}>
            {n.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Violation List ───────────────────────────────────────────────────────────

function ViolationList() {
  const allIssues = usePulseStore(s => s.veraIssues);
  const issues = useMemo(() => allIssues.filter(i => i.type !== 'pass'), [allIssues]);

  if (issues.length === 0) return (
    <p className="label-sm" style={{ padding: '4px 0' }}>No violations ✓</p>
  );

  return (
    <>
      {issues.map(issue => (
        <div key={issue.id} className={`violation-item ${issue.type === 'warn' ? 'warn' : 'info'}`}>
          {issue.file ? `${issue.file}: ${issue.message}` : issue.message}
        </div>
      ))}
    </>
  );
}

// ─── Audit Panel ─────────────────────────────────────────────────────────────

export function AuditPanel() {
  const veraScore = usePulseStore(s => s.veraScore);
  const veraGrade = usePulseStore(s => s.veraGrade);

  return (
    <div className="panel-right">
      <div className="audit-header">VERA AUDIT</div>

      <ScoreGauge score={veraScore} grade={veraGrade} />

      <div className="audit-section">
        <div className="audit-section-label">Design Pass / Fail</div>
        <AuditItems />
      </div>

      <div className="audit-section">
        <div className="audit-section-label">Component Ancestry</div>
        <ComponentAncestry />
      </div>

      <div className="audit-section">
        <div className="audit-section-label">Active Violations</div>
        <ViolationList />
      </div>
    </div>
  );
}
