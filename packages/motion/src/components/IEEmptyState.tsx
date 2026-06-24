/**
 * IEEmptyState — Animated empty state placeholder
 * Displays an animation with title, description, and optional action button.
 */

import type { IEEmptyStateProps } from '../types.js';

const DEFAULT_EMPTY_KEYFRAMES = `
  @keyframes ie-empty-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  @keyframes ie-empty-fade-in {
    0% { opacity: 0; transform: translateY(12px); }
    100% { opacity: 1; transform: translateY(0); }
  }
`;

function DefaultEmptyIllustration({ size, color }: { size: number; color: string }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      style={{ animation: 'ie-empty-float 3s ease-in-out infinite' }}
    >
      {/* Folder base */}
      <rect x="20" y="40" width="80" height="55" rx="6" fill={`${color}15`} stroke={`${color}44`} strokeWidth="2" />
      {/* Folder tab */}
      <path d="M20 46V38a6 6 0 0 1 6-6h20l6 8h42a6 6 0 0 1 6 6v0H20z" fill={`${color}22`} stroke={`${color}44`} strokeWidth="2" />
      {/* Decorative dots */}
      <circle cx="60" cy="67" r="3" fill={`${color}66`} />
      <circle cx="50" cy="67" r="2" fill={`${color}44`} />
      <circle cx="70" cy="67" r="2" fill={`${color}44`} />
      {/* Ghost line */}
      <rect x="40" y="78" width="40" height="3" rx="1.5" fill={`${color}22`} />
    </svg>
  );
}

export function IEEmptyState({
  title = 'Nothing here yet',
  description,
  animationSrc,
  animationSize = 120,
  actionLabel,
  onAction,
  className,
  style,
}: IEEmptyStateProps): React.ReactElement {
  const accentColor = '#a78bfa';

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        textAlign: 'center',
        animation: 'ie-empty-fade-in 0.5s ease-out forwards',
        ...style,
      }}
    >
      <style>{DEFAULT_EMPTY_KEYFRAMES}</style>

      {animationSrc ? (
        <img src={animationSrc} alt="" width={animationSize} height={animationSize} style={{ animation: 'ie-empty-float 3s ease-in-out infinite' }} />
      ) : (
        <DefaultEmptyIllustration size={animationSize} color={accentColor} />
      )}

      <h3
        style={{
          margin: '16px 0 8px',
          fontSize: 18,
          fontWeight: 600,
          color: '#e2e8f0',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            margin: '0 0 20px',
            fontSize: 14,
            color: '#94a3b8',
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 500,
            color: '#fff',
            background: `linear-gradient(135deg, ${accentColor}, #7c3aed)`,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: `0 2px 12px ${accentColor}44`,
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)';
            (e.target as HTMLButtonElement).style.boxShadow = `0 4px 20px ${accentColor}66`;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.target as HTMLButtonElement).style.boxShadow = `0 2px 12px ${accentColor}44`;
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default IEEmptyState;
