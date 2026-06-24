import React, { useState } from 'react';

/**
 * BrutalistButtonProps - Properties for custom brutalist buttons
 */
export interface BrutalistButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'paper';
  size?: 'sm' | 'md' | 'lg';
  isActive?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  animateOnHover?: boolean;
}

/**
 * 1. BASE BRUTALIST BUTTON COMPONENT
 * Implements Solar-Paper Brutalism design paradigms:
 * - Heavy black boundaries: border-2 border-black
 * - Aggressive dimensional offset shadow: shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
 * - Aesthetic color tokens (Solar Orange, Cream Paper, Absolute Black)
 * - Agnostic CSS variables mapping with high-fidelity fallbacks
 */
export const BrutalistButton: React.FC<BrutalistButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isActive = false,
  icon,
  iconPosition = 'left',
  animateOnHover = true,
  className = '',
  disabled = false,
  ...props
}) => {
  // Styles mapped to agnostically-driven custom properties with Solar-Paper Brutalist fallbacks
  const variantStyles = {
    // Solar Orange background, high-contrast black text
    primary: 'bg-[var(--color-primary,#FF4E00)] text-[var(--color-primary-foreground,#000000)] hover:bg-[#ff5f1a]',
    // Cream Paper background, black text
    secondary: 'bg-[var(--color-surface-base,#FDFBF7)] text-[var(--color-text-primary,#000000)] hover:bg-[#f8f3e8]',
    // Accent: Solar Orange backdrop
    accent: 'bg-[var(--color-accent,#FF4E00)] text-[var(--color-accent-foreground,#FFFFFF)] hover:bg-[#e04500]',
    // Danger: High-contrast Alert red
    danger: 'bg-red-500 text-black hover:bg-red-400',
    // Pure White paper variant
    paper: 'bg-[var(--color-surface-elevated,#FFFFFF)] text-[var(--color-text-primary,#000000)] hover:bg-gray-50',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs font-mono',
    md: 'px-6 py-3 text-sm font-bold uppercase tracking-wider',
    lg: 'px-8 py-4 text-base font-black uppercase tracking-widest',
  };

  const borderAndShadow = disabled
    ? 'border-2 border-gray-400 text-gray-400 bg-gray-100 cursor-not-allowed opacity-60 shadow-none'
    : isActive
    ? 'border-2 border-black translate-x-[2px] translate-y-[2px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-[var(--color-primary,#FF4E00)]'
    : `border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
        animateOnHover
          ? 'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
          : ''
      }`;

  const transitionTiming = 'transition-[transform,box-shadow,background-color] duration-[var(--animation-interactive,150ms)] ease-out';

  return (
    <button
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-[var(--font-heading,'Space_Grotesk')] rounded-none select-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${borderAndShadow}
        ${transitionTiming}
        ${className}
      `}
      {...props}
    >
      {icon && iconPosition === 'left' && (
        <span className={`${children ? 'mr-2.5' : ''} flex items-center justify-center`}>{icon}</span>
      )}
      {children}
      {icon && iconPosition === 'right' && (
        <span className={`${children ? 'ml-2.5' : ''} flex items-center justify-center`}>{icon}</span>
      )}
    </button>
  );
};

/**
 * 2. SYNC BUTTON COMPONENT
 * Special interactive action trigger with rotating arrows to indicate active background syncing.
 */
export const SyncButton: React.FC<{
  onSync: () => Promise<void> | void;
  className?: string;
}> = ({ onSync, className = '' }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleClick = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await onSync();
    } finally {
      // Keep rotation visible for a satisfying duration
      setTimeout(() => setIsSyncing(false), 900);
    }
  };

  const syncIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
    >
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );

  return (
    <BrutalistButton
      variant="primary"
      size="md"
      icon={syncIcon}
      iconPosition="left"
      onClick={handleClick}
      className={className}
      isActive={isSyncing}
    >
      {isSyncing ? 'SYNCING...' : 'SYNC SCRIBLES'}
    </BrutalistButton>
  );
};

/**
 * 3. PLAY/PAUSE TOGGLE BUTTON
 * Classic storyboard timeline controller.
 */
export const PlayButton: React.FC<{
  isPlaying: boolean;
  onToggle: () => void;
  className?: string;
}> = ({ isPlaying, onToggle, className = '' }) => {
  const playIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4 text-black"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );

  const pauseIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4 text-black"
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );

  return (
    <BrutalistButton
      variant={isPlaying ? 'accent' : 'secondary'}
      size="md"
      icon={isPlaying ? pauseIcon : playIcon}
      onClick={onToggle}
      className={className}
    >
      {isPlaying ? 'PAUSE TIMELINE' : 'PLAY SEQUENCE'}
    </BrutalistButton>
  );
};

/**
 * 4. MINI FRAME CONTROL ACTIONS
 * Small grid control actions for single frames (Lock, Duplicate, Delete).
 */
export const FrameActionButton: React.FC<{
  actionType: 'lock' | 'unlock' | 'duplicate' | 'delete' | 'edit';
  onClick: () => void;
  disabled?: boolean;
}> = ({ actionType, onClick, disabled = false }) => {
  const actionConfig = {
    lock: {
      colorClass: 'bg-[var(--color-surface-base,#FDFBF7)] hover:bg-gray-100',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    unlock: {
      colorClass: 'bg-[var(--color-primary,#FF4E00)] text-black',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
      ),
    },
    duplicate: {
      colorClass: 'bg-[var(--color-surface-base,#FDFBF7)] hover:bg-gray-100',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ),
    },
    delete: {
      colorClass: 'bg-red-500 hover:bg-red-400 text-black',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
    },
    edit: {
      colorClass: 'bg-[var(--color-surface-elevated,#FFFFFF)] hover:bg-[#FDFBF7] text-black',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
  };

  const selected = actionConfig[actionType];

  return (
    <button
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`
        p-2 border border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
        active:translate-x-0.5 active:translate-y-0.5 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)]
        transition-[transform,box-shadow,background-color] duration-75 cursor-pointer
        ${selected.colorClass}
        ${disabled ? 'opacity-40 cursor-not-allowed shadow-none' : ''}
      `}
      title={`${actionType.toUpperCase()} FRAME`}
    >
      {selected.icon}
    </button>
  );
};

/**
 * 5. DEMO PORTFOLIO GRID SHOWCASE
 * Renderable component showing off the beautiful brutalist library.
 */
export const ButtonShowcase: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="p-8 bg-[var(--color-surface-base,#FDFBF7)] border-4 border-black font-[var(--font-body,'Plus_Jakarta_Sans')] max-w-4xl mx-auto my-10 shadow-[8px_8px_0px_0px_#000000]">
      <div className="border-b-4 border-black pb-4 mb-6">
        <h2 className="text-3xl font-black font-[var(--font-heading,'Space_Grotesk')] text-[var(--color-text-primary,#000000)]">
          SCRIBBLESYNC BUTTON LIBRARY
        </h2>
        <p className="text-sm font-mono text-[var(--color-text-secondary,#1C1C1C)] mt-1">
          Aesthetic Spec: Solar-Paper Brutalism (Ver 7.0.0 Component Kit)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* standard variants */}
        <div className="space-y-4 border-2 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-md font-black font-[var(--font-heading,'Space_Grotesk')] border-b border-black pb-1.5">
            1. STANDARD INTERACTIVE STATES
          </h3>
          <div className="flex flex-wrap gap-3.5">
            <BrutalistButton variant="primary">Primary (Solar Orange)</BrutalistButton>
            <BrutalistButton variant="secondary">Secondary (Cream Paper)</BrutalistButton>
            <BrutalistButton variant="accent">Accent Highlight</BrutalistButton>
            <BrutalistButton variant="paper">Elevated Paper</BrutalistButton>
            <BrutalistButton variant="danger">Destructive Action</BrutalistButton>
          </div>
        </div>

        {/* size options */}
        <div className="space-y-4 border-2 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-md font-black font-[var(--font-heading,'Space_Grotesk')] border-b border-black pb-1.5">
            2. SCALED SIZE GRID
          </h3>
          <div className="flex items-center gap-4">
            <BrutalistButton size="sm" variant="primary">Small Action</BrutalistButton>
            <BrutalistButton size="md" variant="primary">Medium Base</BrutalistButton>
            <BrutalistButton size="lg" variant="primary">Large Hero</BrutalistButton>
          </div>
        </div>

        {/* story actions */}
        <div className="space-y-4 border-2 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-md font-black font-[var(--font-heading,'Space_Grotesk')] border-b border-black pb-1.5">
            3. TIMELINE & CLOUD SYNCS
          </h3>
          <div className="flex flex-wrap gap-4">
            <SyncButton onSync={async () => { await new Promise((r) => setTimeout(r, 1000)); }} />
            <PlayButton isPlaying={isPlaying} onToggle={() => setIsPlaying(!isPlaying)} />
          </div>
        </div>

        {/* mini cell triggers */}
        <div className="space-y-4 border-2 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-md font-black font-[var(--font-heading,'Space_Grotesk')] border-b border-black pb-1.5">
            4. FRAME ACTION ROW
          </h3>
          <div className="flex items-center gap-3">
            <FrameActionButton actionType="edit" onClick={() => {}} />
            <FrameActionButton actionType="lock" onClick={() => {}} />
            <FrameActionButton actionType="unlock" onClick={() => {}} />
            <FrameActionButton actionType="duplicate" onClick={() => {}} />
            <FrameActionButton actionType="delete" onClick={() => {}} />
            <FrameActionButton actionType="edit" onClick={() => {}} disabled />
          </div>
        </div>
      </div>
    </div>
  );
};
