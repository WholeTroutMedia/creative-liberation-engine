import { AccordionSection } from './AccordionSection';
import { IntentSection } from './IntentSection';
import { MoodAxesSection } from './MoodAxesSection';
import { ColorSystemSection } from './ColorSystemSection';
import { TypeScaleSection } from './TypeScaleSection';
import { PatternSection } from './PatternSection';
import { usePulseStore } from '../../store/usePulseStore';

export function InstrumentPanel() {
  const pushToPenpot = usePulseStore(s => s.pushToPenpot);
  const isPushing    = usePulseStore(s => s.isPushing);

  return (
    <div className="panel-left">
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <div className="font-display text-amber" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
          PULSE
        </div>
        <div className="label-sm" style={{ marginTop: 2 }}>Session · Creative Liberation Engine v5</div>
      </div>

      <div className="accordion" style={{ flex: 1, overflowY: 'auto' }}>
        <AccordionSection id="intent"   label="Intent"       icon="✦">
          <IntentSection />
        </AccordionSection>

        <AccordionSection id="mood"     label="Mood Axes"   icon="⇄">
          <MoodAxesSection />
        </AccordionSection>

        <AccordionSection id="color"    label="Color System" icon="◈">
          <ColorSystemSection />
        </AccordionSection>

        <AccordionSection id="type"     label="Type Scale"  icon="T">
          <TypeScaleSection />
        </AccordionSection>

        <AccordionSection id="patterns" label="Patterns"    icon="⊞">
          <PatternSection />
        </AccordionSection>
      </div>

      <button
        className="push-penpot font-display"
        onClick={() => void pushToPenpot()}
        disabled={isPushing}
      >
        {isPushing ? '⟳ Pushing…' : '↗ Push to Penpot'}
      </button>
    </div>
  );
}
