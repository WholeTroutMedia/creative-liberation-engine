import { useEffect, useRef } from 'react';
import { usePulseStore } from '../store/usePulseStore';

// Simulated VERA audit — in production this calls @cle/design-agent
// QualityScoreAggregator.evaluateSpec() with actual token data
function runVera(primary: string, _surface: string): {
  score: number;
  grade: string;
  issues: Array<{ id: string; type: 'pass' | 'warn' | 'fail'; message: string; fixable: boolean; file?: string }>;
} {
  // Contrast ratio approximation based on lightness
  const hexToLightness = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const primaryL = hexToLightness(primary.startsWith('#') && primary.length === 7 ? primary : '#C89040');
  const contrastOk = primaryL > 0.08;   // rough check against dark bg
  const tokenCoverage = 94;

  const score = contrastOk ? 89 : 72;
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';

  return {
    score,
    grade,
    issues: [
      { id: 'contrast',  type: contrastOk ? 'pass' : 'warn', message: `Contrast ratios ${contrastOk ? 'pass' : 'need review'}`,  fixable: !contrastOk },
      { id: 'grid',      type: 'pass',                        message: '8pt grid compliant',                      fixable: false },
      { id: 'coverage',  type: tokenCoverage >= 90 ? 'pass' : 'warn', message: `Token coverage ${tokenCoverage}%`, fixable: false },
      { id: 'hardcode',  type: 'warn',                        message: '1 hardcoded color value',                 fixable: true, file: 'Nav.tsx:42' },
      { id: 'spacing',   type: 'fail',                        message: 'Spacing override ×3 (not in scale)',      fixable: false, file: 'Card.tsx' },
    ],
  };
}

export function useVeraAudit() {
  const colorSystem = usePulseStore(s => s.colorSystem);
  const setVeraResults = usePulseStore(s => s.setVeraResults);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const { score, grade, issues } = runVera(colorSystem.primary, colorSystem.surface);
      setVeraResults(score, grade, issues);
    }, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [colorSystem.primary, colorSystem.surface, setVeraResults]);
}
