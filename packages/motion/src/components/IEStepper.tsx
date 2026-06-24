/**
 * IEStepper — Animated multi-step wizard with navigation
 */

import { useCallback, useState } from 'react';
import type React from 'react';

export type StepperOrientation = 'horizontal' | 'vertical';
export type StepperVariant = 'default' | 'circles' | 'minimal';

export interface Step {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  optional?: boolean;
  content?: React.ReactNode;
  validate?: () => boolean | Promise<boolean>;
}

export interface IEStepperProps {
  steps: Step[];
  activeStep?: number;
  onStepChange?: (step: number) => void;
  orientation?: StepperOrientation;
  variant?: StepperVariant;
  allowSkip?: boolean;
  showNavigation?: boolean;
  onComplete?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes ie-stepper-check { 0% { stroke-dashoffset: 20; } 100% { stroke-dashoffset: 0; } }
  @keyframes ie-stepper-content-in { 0% { opacity: 0; transform: translateX(16px); } 100% { opacity: 1; transform: none; } }
`;

export function IEStepper({
  steps,
  activeStep: controlledStep,
  onStepChange,
  orientation = 'horizontal',
  variant = 'default',
  allowSkip = false,
  showNavigation = true,
  onComplete,
  className,
  style,
}: IEStepperProps): React.ReactElement {
  const [internalStep, setInternalStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const active = controlledStep ?? internalStep;

  const goTo = useCallback(async (next: number) => {
    if (next < 0 || next > steps.length) return;
    if (next > active && steps[active]?.validate) {
      const ok = await steps[active].validate!();
      if (!ok) return;
    }
    if (next === steps.length) { onComplete?.(); return; }
    if (onStepChange) onStepChange(next);
    else setInternalStep(next);
    setAnimKey((k) => k + 1);
  }, [active, steps, onComplete, onStepChange]);

  const getStepState = (i: number): 'complete' | 'active' | 'pending' | 'error' => {
    if (i < active) return 'complete';
    if (i === active) return 'active';
    return 'pending';
  };

  const STATE_COLORS = {
    complete: '#4ade80',
    active: '#a78bfa',
    pending: '#333348',
    error: '#f87171',
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className={className} style={{ display: 'flex', flexDirection: orientation === 'vertical' ? 'row' : 'column', gap: 24, ...style }}>

        {/* Steps indicators */}
        <div style={{
          display: 'flex',
          flexDirection: orientation === 'horizontal' ? 'row' : 'column',
          alignItems: orientation === 'horizontal' ? 'flex-start' : 'flex-start',
          gap: 0,
        }}>
          {steps.map((step, i) => {
            const state = getStepState(i);
            const color = STATE_COLORS[state];
            const isLast = i === steps.length - 1;

            return (
              <div
                key={step.id}
                style={{ display: 'flex', flexDirection: orientation === 'horizontal' ? 'column' : 'row', alignItems: 'center', flex: orientation === 'horizontal' ? 1 : undefined }}
              >
                <div style={{ display: 'flex', flexDirection: orientation === 'horizontal' ? 'row' : 'column', alignItems: 'center', width: '100%' }}>
                  {/* Connector before */}
                  {i > 0 && orientation === 'horizontal' && (
                    <div style={{ flex: 1, height: 2, background: state === 'complete' ? '#4ade80' : '#1a1a24', transition: 'background 0.4s ease' }} />
                  )}
                  {i > 0 && orientation === 'vertical' && (
                    <div style={{ width: 2, height: 24, background: state === 'complete' ? '#4ade80' : '#1a1a24', transition: 'background 0.4s ease', marginLeft: 15 }} />
                  )}

                  {/* Step circle */}
                  <button
                    type="button"
                    onClick={() => (state === 'complete' || allowSkip) ? goTo(i) : undefined}
                    disabled={state === 'pending' && !allowSkip}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: state === 'active' ? '#1e1030' : state === 'complete' ? '#052e16' : '#111118',
                      border: `2px solid ${color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: (state === 'complete' || allowSkip) ? 'pointer' : 'default',
                      transition: 'all 0.3s ease',
                      fontSize: 12, fontWeight: 700, color,
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                    aria-label={`Step ${i + 1}: ${step.title}`}
                    aria-current={state === 'active' ? 'step' : undefined}
                  >
                    {state === 'complete' ? '✓' : (step.icon ?? (i + 1))}
                  </button>

                  {/* Connector after (horizontal) */}
                  {!isLast && orientation === 'horizontal' && (
                    <div style={{ flex: 1, height: 2, background: getStepState(i + 1) === 'complete' || state === 'complete' ? '#4ade80' : '#1a1a24', transition: 'background 0.4s ease' }} />
                  )}
                </div>

                {/* Label */}
                <div style={{ textAlign: orientation === 'horizontal' ? 'center' : 'left', paddingTop: orientation === 'horizontal' ? 8 : 0, paddingLeft: orientation === 'vertical' ? 12 : 0 }}>
                  <div style={{ fontSize: 12, fontWeight: state === 'active' ? 600 : 400, color: state === 'pending' ? '#555568' : '#e8e8f0', transition: 'color 0.2s ease' }}>
                    {step.title}
                  </div>
                  {step.description && <div style={{ fontSize: 10, color: '#555568', marginTop: 2 }}>{step.description}</div>}
                  {step.optional && <div style={{ fontSize: 10, color: '#555568', fontStyle: 'italic' }}>Optional</div>}
                </div>

                {/* Connector after (vertical) */}
                {!isLast && orientation === 'vertical' && (
                  <div style={{ width: 2, height: 24, background: getStepState(i + 1) !== 'pending' ? '#4ade80' : '#1a1a24', marginLeft: 15, transition: 'background 0.4s ease' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div style={{ flex: 1 }}>
          {steps[active]?.content && (
            <div key={animKey} style={{ animation: 'ie-stepper-content-in 0.3s ease forwards' }}>
              {steps[active].content}
            </div>
          )}

          {/* Navigation */}
          {showNavigation && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {active > 0 && (
                <button
                  type="button"
                  onClick={() => goTo(active - 1)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#c8c8d8', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background 0.15s ease',
                  }}
                >Back</button>
              )}
              <button
                type="button"
                onClick={() => goTo(active + 1)}
                style={{
                  padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: '#a78bfa', color: '#fff', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'opacity 0.15s ease',
                }}
              >
                {active === steps.length - 1 ? 'Complete' : 'Next'}
              </button>
              {steps[active]?.optional && allowSkip && (
                <button type="button" onClick={() => goTo(active + 1)} style={{ fontSize: 12, color: '#555568', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Skip
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default IEStepper;
