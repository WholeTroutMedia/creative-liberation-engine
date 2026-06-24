import React from 'react';
import { TaskStatus } from './types';

/**
 * Agnostic Custom-designed HUD SVG Icon Registry
 * Standardized path vectors avoiding raw static file linking or external dependencies.
 */
export const HUDIcons = {
  Play: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  ),
  Pause: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </svg>
  ),
  Sync: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  ),
  Terminal: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  Clock: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Dollar: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  Branch: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  ),
  Activity: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Copy: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Settings: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Lock: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Cpu: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
    </svg>
  ),
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
};

// ==========================================
// 1. MICRO-SIZED HUD BUTTON CONTROLS
// ==========================================

export interface MicroHUDButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'destructive' | 'flat';
  icon?: keyof typeof HUDIcons;
  isActive?: boolean;
  tooltip?: string;
}

export const MicroHUDButton: React.FC<MicroHUDButtonProps> = ({
  children,
  variant = 'secondary',
  icon,
  isActive = false,
  tooltip,
  className = '',
  disabled = false,
  ...props
}) => {
  const IconComponent = icon ? HUDIcons[icon] : null;

  // Custom property driven variants matching Carbon HUD specifications
  const variantStyles = {
    primary: 'bg-[var(--color-primary,#F5F5F4)] text-[var(--color-primary-foreground,#121214)] border-[var(--color-primary,#F5F5F4)] hover:bg-opacity-95 shadow-[0_0_12px_rgba(245,245,244,0.15)]',
    secondary: 'bg-transparent text-[var(--color-text-secondary,#A8A29E)] border-[var(--color-surface-glass-border,rgba(245,245,244,0.1))] hover:text-[var(--color-text-primary,#F5F5F4)] hover:border-[var(--color-text-secondary,#A8A29E)]',
    accent: 'bg-transparent text-[var(--color-accent,#E7E5E4)] border-[var(--color-accent-subtle,rgba(231,229,228,0.15))] hover:border-[var(--color-accent,#E7E5E4)]',
    destructive: 'bg-transparent text-red-400 border-red-500/20 hover:border-red-500 hover:bg-red-500/5',
    flat: 'bg-transparent text-[var(--color-text-tertiary,#57534E)] border-transparent hover:text-[var(--color-text-secondary,#A8A29E)] hover:bg-[var(--color-primary-subtle,rgba(245,245,244,0.04))]'
  };

  const activeStyles = isActive
    ? 'bg-[var(--color-primary-subtle,rgba(245,245,244,0.08))] text-[var(--color-text-primary,#F5F5F4)] border-[var(--color-text-primary,#F5F5F4)]'
    : '';

  const transitionStyle = 'transition-[background-color,border-color,text-color,transform,box-shadow] duration-[var(--animation-interactive,180ms)] ease-out';

  return (
    <button
      disabled={disabled}
      title={tooltip}
      className={`
        inline-flex items-center justify-center gap-1.5
        px-2.5 py-1 text-[10px] font-[var(--font-mono,monospace)] uppercase tracking-wider
        border rounded-sm select-none focus:outline-none focus:ring-1 focus:ring-stone-500/40
        ${disabled ? 'opacity-30 cursor-not-allowed border-stone-800 text-stone-600' : 'cursor-pointer active:scale-95'}
        ${variantStyles[variant]}
        ${activeStyles}
        ${transitionStyle}
        ${className}
      `}
      {...props}
    >
      {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
};

// ==========================================
// 2. HUD STATUS BADGE COMPONENT
// ==========================================

interface TaskStatusBadgeProps {
  status: TaskStatus;
  showDot?: boolean;
  className?: string;
}

export const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({
  status,
  showDot = true,
  className = ''
}) => {
  const configs: Record<TaskStatus, { text: string; bg: string; border: string; dot: string }> = {
    [TaskStatus.IDLE]: {
      text: 'text-stone-500',
      bg: 'bg-stone-500/5',
      border: 'border-stone-800',
      dot: 'bg-stone-700'
    },
    [TaskStatus.QUEUED]: {
      text: 'text-amber-500',
      bg: 'bg-amber-500/5',
      border: 'border-amber-900/30',
      dot: 'bg-amber-500 animate-pulse'
    },
    [TaskStatus.RUNNING]: {
      text: 'text-white',
      bg: 'bg-white/5',
      border: 'border-white/20',
      dot: 'bg-white animate-[ping_1.5s_infinite]'
    },
    [TaskStatus.COMPLETED]: {
      text: 'text-stone-300',
      bg: 'bg-stone-100/5',
      border: 'border-stone-200/20',
      dot: 'bg-stone-300'
    },
    [TaskStatus.FAILED]: {
      text: 'text-red-400',
      bg: 'bg-red-400/5',
      border: 'border-red-900/30',
      dot: 'bg-red-500'
    },
    [TaskStatus.SUSPENDED]: {
      text: 'text-orange-400',
      bg: 'bg-orange-400/5',
      border: 'border-orange-900/30',
      dot: 'bg-orange-500'
    },
    [TaskStatus.CANCELLED]: {
      text: 'text-stone-600',
      bg: 'bg-stone-800/5',
      border: 'border-stone-900',
      dot: 'bg-stone-800'
    },
    [TaskStatus.RETRIED]: {
      text: 'text-cyan-400',
      bg: 'bg-cyan-400/5',
      border: 'border-cyan-900/30',
      dot: 'bg-cyan-500 animate-pulse'
    }
  };

  const selected = configs[status];

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5
        text-[9px] font-[var(--font-mono,monospace)] uppercase tracking-widest
        border rounded-full ${selected.bg} ${selected.border} ${selected.text}
        ${className}
      `}
    >
      {showDot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${selected.dot}`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${selected.dot}`} />
        </span>
      )}
      {status}
    </div>
  );
};

// ==========================================
// 3. HUD TERMINAL LINE WRAPPERS
// ==========================================

interface TerminalLineProps {
  timestamp: string;
  coordinate: string;
  level?: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'SYSTEM';
  label: string;
  content: string;
  financialCost?: number;
  latencyMs?: number;
  className?: string;
  onCopy?: () => void;
}

export const TerminalLine: React.FC<TerminalLineProps> = ({
  timestamp,
  coordinate,
  level = 'INFO',
  label,
  content,
  financialCost,
  latencyMs,
  className = '',
  onCopy
}) => {
  const levelColor = {
    INFO: 'text-[var(--color-text-secondary,#A8A29E)]',
    SUCCESS: 'text-[var(--color-primary,#F5F5F4)]',
    WARN: 'text-amber-400/90',
    ERROR: 'text-red-400',
    SYSTEM: 'text-[var(--color-text-tertiary,#57534E)] font-bold'
  };

  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`[${timestamp}] [${coordinate}] [${level}] ${label}: ${content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    if (onCopy) onCopy();
  };

  return (
    <div
      className={`
        group relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5
        w-full p-2 hover:bg-[var(--color-primary-subtle,rgba(245,245,244,0.02))]
        border-b border-[var(--color-surface-glass-border,rgba(245,245,244,0.03))]
        font-[var(--font-mono,monospace)] text-[11px] text-[var(--color-text-primary,#F5F5F4)]
        transition-colors duration-150 ${className}
      `}
    >
      <div className="flex items-center gap-2 max-w-[82%]">
        {/* Step Coordinate Prefix */}
        <span className="text-[var(--color-text-tertiary,#57534E)] select-none">
          {coordinate}
        </span>
        
        {/* Dynamic Timestamp Prefix */}
        <span className="text-stone-600 select-none">
          {timestamp}
        </span>

        {/* Level symbol */}
        <span className={`text-[9px] uppercase tracking-wider font-semibold select-none ${levelColor[level]}`}>
          [{level}]
        </span>

        {/* Action Label tag */}
        <span className="text-stone-300 font-bold select-all">
          {label}:
        </span>

        {/* Actual trace value content */}
        <span className="text-[var(--color-text-secondary,#A8A29E)] break-all select-all">
          {content}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Financial telemetry tags if present */}
        {financialCost !== undefined && (
          <span className="text-[9px] text-stone-600 uppercase select-none">
            ${financialCost.toFixed(5)}
          </span>
        )}

        {/* Duration timestamp */}
        {latencyMs !== undefined && (
          <span className="text-[9px] text-stone-600 select-none">
            {latencyMs}ms
          </span>
        )}

        {/* Floating trigger copy controls */}
        <button
          onClick={handleCopy}
          className="
            opacity-0 group-hover:opacity-100
            p-1 rounded-sm border border-stone-800 bg-[#121214]
            text-stone-500 hover:text-white hover:border-stone-600
            transition-all duration-150 focus:outline-none
          "
          title="Copy Trace Line"
        >
          {copied ? (
            <span className="text-[8px] uppercase tracking-tighter px-0.5 text-stone-400">DONE</span>
          ) : (
            <HUDIcons.Copy className="w-3 h-3" />
          )}
        </button>
      </div>
    </div>
  );
};
