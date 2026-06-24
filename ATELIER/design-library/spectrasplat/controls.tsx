import React from 'react';

/**
 * Standard SVG Icon Path collection to avoid external library dependencies
 */
export const Icons = {
  Orbit: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8" strokeDasharray="4 2" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  ),
  Pan: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m15 9-3-3-3 3M12 6v12M9 15l3 3 3-3M9 12H6M18 12h-6M6 12l3-3M6 12l3 3M18 12l-3-3M18 12l-3 3" />
    </svg>
  ),
  Zoom: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  Perspective: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="7" x2="21" y2="7" />
      <line x1="3" y1="17" x2="21" y2="17" />
    </svg>
  ),
  Orthographic: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Fly: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M12 22v-10" />
      <path d="m17 17-5-5-5 5" />
      <path d="m17 13-5-5-5 5" />
    </svg>
  ),
  Camera: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  ),
  Save: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  Restore: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  ),
  ArrowUpRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  ),
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Settings: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Activity: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Info: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  Sliders: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
};

// ----------------------------------------------------
// ICON BUTTON
// ----------------------------------------------------

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: keyof typeof Icons;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'active';
  tooltip?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'secondary',
  tooltip,
  className = '',
  ...props
}) => {
  const IconComponent = Icons[icon];

  const baseStyles = 'relative flex items-center justify-center p-2 rounded-lg transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-opacity-50 overflow-hidden';
  
  const variantStyles = {
    primary: 'bg-cyan-500 bg-opacity-10 text-cyan-400 border border-cyan-500 border-opacity-30 hover:bg-opacity-20 hover:border-opacity-50 hover:shadow-[0_0_15px_rgba(0,255,204,0.35)]',
    secondary: 'bg-neutral-900 bg-opacity-80 text-neutral-300 border border-neutral-800 hover:border-neutral-700 hover:text-white',
    outline: 'bg-transparent text-neutral-400 border border-neutral-800 hover:border-cyan-500 hover:border-opacity-30 hover:text-cyan-400',
    ghost: 'bg-transparent text-neutral-400 hover:bg-neutral-900 hover:text-white',
    active: 'bg-magenta-500 bg-opacity-20 text-magenta-400 border border-magenta-500 border-opacity-50 shadow-[0_0_15px_rgba(217,70,239,0.3)]'
  };

  const interactiveStyles = 'transform active:scale-95 duration-150';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${interactiveStyles} ${className}`}
      title={tooltip}
      {...props}
    >
      <IconComponent className="w-5 h-5 transition-transform group-hover:scale-110" />
      {/* Decorative scanner line */}
      <span className="absolute inset-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent -translate-y-full hover:animate-[scan_1.5s_infinite]" />
    </button>
  );
};

// ----------------------------------------------------
// VIEWPORT CAMERA BUTTONS
// ----------------------------------------------------

interface ViewportCameraControlsProps {
  activeCamera: string;
  projectionMode: 'PERSPECTIVE' | 'ORTHOGRAPHIC';
  onCameraChange: (cameraType: string) => void;
  onProjectionToggle: () => void;
  onSaveView?: () => void;
  onRestoreView?: () => void;
}

export const ViewportCameraControls: React.FC<ViewportCameraControlsProps> = ({
  activeCamera,
  projectionMode,
  onCameraChange,
  onProjectionToggle,
  onSaveView,
  onRestoreView
}) => {
  const cameraPresets = [
    { id: 'orbit', label: 'Orbit Track', icon: 'Orbit' as const },
    { id: 'pan', label: 'Pan Vector', icon: 'Pan' as const },
    { id: 'fly', label: 'Fly Through', icon: 'Fly' as const },
  ];

  const orthoPresets = [
    { id: 'top', label: 'Top View' },
    { id: 'front', label: 'Front View' },
    { id: 'right', label: 'Right View' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-[#020204]/90 backdrop-blur-md border border-neutral-900 shadow-2xl">
      {/* Projection Mode Toggle */}
      <button
        onClick={onProjectionToggle}
        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all duration-300 border ${
          projectionMode === 'PERSPECTIVE'
            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(0,255,204,0.15)]'
            : 'bg-neutral-950 text-neutral-400 border-neutral-900 hover:text-white'
        }`}
      >
        {projectionMode === 'PERSPECTIVE' ? 'PERSPECTIVE' : 'ORTHOGRAPHIC'}
      </button>

      <div className="w-[1px] h-6 bg-neutral-800" />

      {/* Main Camera Track Modes */}
      <div className="flex gap-1">
        {cameraPresets.map((cam) => (
          <IconButton
            key={cam.id}
            icon={cam.icon}
            variant={activeCamera === cam.id ? 'active' : 'outline'}
            tooltip={cam.label}
            onClick={() => onCameraChange(cam.id)}
          />
        ))}
      </div>

      <div className="w-[1px] h-6 bg-neutral-800" />

      {/* Isometric Presets */}
      <div className="flex gap-1 bg-black/40 p-0.5 rounded-lg border border-neutral-900">
        {orthoPresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onCameraChange(preset.id)}
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-medium transition-all ${
              activeCamera === preset.id
                ? 'bg-neutral-800 text-white shadow-inner'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {preset.id.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="w-[1px] h-6 bg-neutral-800" />

      {/* Save & Restore */}
      <div className="flex gap-1">
        <IconButton icon="Save" variant="ghost" tooltip="Save Focal View" onClick={onSaveView} />
        <IconButton icon="Restore" variant="ghost" tooltip="Restore Default View" onClick={onRestoreView} />
      </div>
    </div>
  );
};

// ----------------------------------------------------
// SLIDER CONTROL
// ----------------------------------------------------

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  themeColor?: 'cyan' | 'magenta' | 'neutral';
  onChange: (val: number) => void;
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  themeColor = 'cyan',
  onChange
}) => {
  const isCyan = themeColor === 'cyan';
  const isMagenta = themeColor === 'magenta';

  // Compute percentage for track background
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-1.5 w-full p-3 rounded-lg bg-neutral-950/45 border border-neutral-900/50 hover:border-neutral-900 transition-colors">
      <div className="flex justify-between items-center text-[11px] font-mono">
        <span className="text-neutral-400 font-semibold tracking-wide uppercase">{label}</span>
        <span className={`font-bold ${isCyan ? 'text-[#00FFCC]' : isMagenta ? 'text-[#D946EF]' : 'text-white'}`}>
          {value.toFixed(step >= 1 ? 0 : step.toString().split('.')[1]?.length || 1)}
          <span className="text-neutral-500 font-medium ml-0.5">{unit}</span>
        </span>
      </div>

      <div className="relative flex items-center group w-full h-5">
        {/* Custom Track Background */}
        <div className="absolute left-0 right-0 h-1 rounded-full bg-neutral-800 pointer-events-none overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-75 ${
              isCyan 
                ? 'bg-gradient-to-r from-cyan-900 to-[#00FFCC]' 
                : isMagenta 
                ? 'bg-gradient-to-r from-magenta-900 to-[#D946EF]' 
                : 'bg-neutral-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Real Range input overlay */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
        />

        {/* Interactive Custom Thumb Indicator */}
        <div
          className={`absolute w-3.5 h-3.5 rounded-full border bg-neutral-950 -ml-1.75 pointer-events-none transform group-hover:scale-125 transition-transform duration-100 ${
            isCyan 
              ? 'border-[#00FFCC] shadow-[0_0_8px_rgba(0,255,204,0.8)]' 
              : isMagenta 
              ? 'border-[#D946EF] shadow-[0_0_8px_rgba(217,70,239,0.8)]' 
              : 'border-white'
          }`}
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// ----------------------------------------------------
// PANEL HEADER (GLASSMORPHIC)
// ----------------------------------------------------

interface PanelHeaderProps {
  title: string;
  subTitle?: string;
  icon?: keyof typeof Icons;
  statusColor?: 'cyan' | 'magenta' | 'green' | 'amber';
  onActionClick?: () => void;
  actionIcon?: keyof typeof Icons;
  collapsible?: boolean;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  subTitle,
  icon,
  statusColor = 'cyan',
  onActionClick,
  actionIcon = 'Settings',
  collapsible = false,
  isCollapsed = false,
  onCollapseToggle
}) => {
  const IconComponent = icon ? Icons[icon] : null;
  const ActionIconComponent = Icons[actionIcon];

  const statusColors = {
    cyan: 'bg-[#00FFCC] shadow-[0_0_6px_rgba(0,255,204,0.6)]',
    magenta: 'bg-[#D946EF] shadow-[0_0_6px_rgba(217,70,239,0.6)]',
    green: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]',
    amber: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
  };

  return (
    <div className="flex items-center justify-between p-3.5 border-b border-neutral-900 bg-[#0d0d12]/95 backdrop-blur-xl rounded-t-xl">
      <div className="flex items-center gap-2.5">
        {/* Glowing Active Status indicator */}
        <div className={`w-2 h-2 rounded-full ${statusColors[statusColor]}`} />
        
        {IconComponent && (
          <IconComponent className="w-4 h-4 text-neutral-400" />
        )}

        <div className="flex flex-col">
          <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase leading-none">
            {title}
          </h3>
          {subTitle && (
            <span className="text-[9px] font-mono text-neutral-500 mt-0.5 tracking-tight uppercase">
              {subTitle}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {onActionClick && (
          <button 
            onClick={onActionClick}
            className="p-1.5 rounded-md text-neutral-500 hover:text-cyan-400 hover:bg-neutral-900/60 transition-colors"
          >
            <ActionIconComponent className="w-3.5 h-3.5" />
          </button>
        )}

        {collapsible && onCollapseToggle && (
          <button
            onClick={onCollapseToggle}
            className={`p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-900/60 transition-all ${
              isCollapsed ? 'transform -rotate-90' : ''
            }`}
          >
            <Icons.ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
