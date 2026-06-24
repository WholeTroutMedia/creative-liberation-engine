import { usePulseStore } from '../../store/usePulseStore';

const DISPLAY_FONTS = ['Space Grotesk', 'Inter', 'Outfit', 'DM Sans', 'Sora'];
const BODY_FONTS    = ['Inter', 'Space Grotesk', 'DM Sans', 'Manrope', 'Geist'];

const SCALE = [
  { label: '3xl', size: 30 },
  { label: '2xl', size: 24 },
  { label: 'xl',  size: 20 },
  { label: 'lg',  size: 16 },
  { label: 'sm',  size: 12 },
];

export function TypeScaleSection() {
  const displayFont = usePulseStore(s => s.displayFont);
  const bodyFont    = usePulseStore(s => s.bodyFont);
  const setDisplay  = usePulseStore(s => s.setDisplayFont);
  const setBody     = usePulseStore(s => s.setBodyFont);

  return (
    <>
      <div className="type-font-row" style={{ marginTop: 8 }}>
        <span className="type-label">Display</span>
        <select
          className="type-select"
          value={displayFont}
          onChange={e => setDisplay(e.target.value)}
        >
          {DISPLAY_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div className="type-font-row" style={{ marginTop: 8 }}>
        <span className="type-label">Body</span>
        <select
          className="type-select"
          value={bodyFont}
          onChange={e => setBody(e.target.value)}
        >
          {BODY_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div className="type-scale-preview">
        {SCALE.map(({ label, size }) => (
          <span
            key={label}
            style={{ fontSize: size, fontFamily: bodyFont, lineHeight: 1.1 }}
          >
            Aa <span className="label-sm">{label}</span>
          </span>
        ))}
      </div>
    </>
  );
}
