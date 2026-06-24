import { ReactNode } from 'react';
import { usePulseStore } from '../../store/usePulseStore';

interface AccordionSectionProps {
  id: string;
  label: string;
  icon: string;
  children: ReactNode;
}

export function AccordionSection({ id, label, icon, children }: AccordionSectionProps) {
  const isOpen = usePulseStore(s => s.openSections[id] ?? false);
  const toggle = usePulseStore(s => s.toggleSection);

  return (
    <div className="accordion-section">
      <button
        className={`accordion-header${isOpen ? ' open' : ''}`}
        onClick={() => toggle(id)}
        aria-expanded={isOpen}
      >
        <span className="accordion-icon">{icon}</span>
        <span className="label-caps">{label}</span>
        <svg
          className={`accordion-chevron${isOpen ? ' open' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
      </button>
      <div className={`accordion-body${isOpen ? ' expanded' : ' collapsed'}`}>
        {children}
      </div>
    </div>
  );
}
