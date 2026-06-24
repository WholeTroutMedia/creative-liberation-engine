import { useRef } from 'react';
import { usePulseStore, type ColorScheme } from '../../store/usePulseStore';

const SWATCH_LABELS: Array<{ key: 'primary' | 'surface' | 'accent'; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'surface', label: 'Surface' },
  { key: 'accent',  label: 'Accent'  },
];

const SCHEMES: Array<{ value: ColorScheme; label: string }> = [
  { value: 'dark',  label: 'Dark'  },
  { value: 'light', label: 'Light' },
  { value: 'auto',  label: 'Auto'  },
];

export function ColorSystemSection() {
  const colorSystem = usePulseStore(s => s.colorSystem);
  const colorScheme = usePulseStore(s => s.colorScheme);
  const setColorSystem = usePulseStore(s => s.setColorSystem);
  const setColorScheme = usePulseStore(s => s.setColorScheme);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <>
      {/* Swatches */}
      <div className="color-swatches">
        {SWATCH_LABELS.map(({ key, label }) => (
          <div key={key} className="color-swatch-group">
            <div
              className="color-swatch-box"
              style={{ background: colorSystem[key] }}
              onClick={() => inputRefs.current[key]?.click()}
            >
              <input
                type="color"
                className="color-swatch-input"
                value={colorSystem[key]}
                ref={el => { inputRefs.current[key] = el; }}
                onChange={e => setColorSystem({ [key]: e.target.value })}
                aria-label={`${label} color`}
              />
            </div>
            <span className="color-swatch-hex font-mono">{colorSystem[key].toUpperCase()}</span>
            <span className="label-sm">{label}</span>
          </div>
        ))}
      </div>

      {/* HSL Wheel (decorative + hint for primary) */}
      <div
        className="hsl-wheel-placeholder"
        title="Click to change primary color"
        onClick={() => inputRefs.current['primary']?.click()}
      >
        <div className="hsl-wheel-inner" />
      </div>

      {/* Scheme Toggle */}
      <div className="scheme-toggle">
        {SCHEMES.map(({ value, label }) => (
          <button
            key={value}
            className={`scheme-btn${colorScheme === value ? ' active' : ''}`}
            onClick={() => setColorScheme(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
