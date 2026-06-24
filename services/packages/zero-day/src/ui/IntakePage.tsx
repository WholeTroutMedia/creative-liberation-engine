'use client';

/**
 * IntakePage — Zero-Day GTM v14
 *
 * Full multi-step orchestrated intake flow:
 * 1. About You  — name + email
 * 2. Project    — type select
 * 3. Goals      — AI-generated dynamic question
 * 4. Budget     — budget range selector
 * 5. Timeline   — timeline selector
 * 6. Review     — AI brief preview → contract modal
 *
 * Integrates: IntakeStepper, ContractPreviewModal, form-engine AI
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IntakeStepper, ContractPreviewModal } from './IntakeStepper';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectType =
  | 'brand_identity'
  | 'website'
  | 'mobile_app'
  | 'campaign'
  | 'broadcast_production'
  | 'photography_video'
  | 'social_media'
  | 'print_collateral'
  | 'product_design'
  | 'retainer'
  | 'other';

type BudgetRange =
  | 'under_5k'
  | '5k_to_15k'
  | '15k_to_50k'
  | '50k_to_100k'
  | 'over_100k'
  | 'to_be_discussed';

type Timeline =
  | 'asap'
  | 'within_2_weeks'
  | 'within_1_month'
  | 'within_3_months'
  | 'within_6_months'
  | 'flexible';

interface IntakeState {
  name: string;
  email: string;
  projectType: ProjectType | '';
  goals: string;
  budget: BudgetRange | '';
  timeline: Timeline | '';
}

// ─── Label maps ───────────────────────────────────────────────────────────────

const PROJECT_LABELS: Record<ProjectType, string> = {
  brand_identity: '🎨 Brand Identity',
  website: '🌐 Website',
  mobile_app: '📱 Mobile App',
  campaign: '📣 Campaign',
  broadcast_production: '🎬 Broadcast Production',
  photography_video: '📷 Photography / Video',
  social_media: '📱 Social Media',
  print_collateral: '🖨️ Print Collateral',
  product_design: '🎁 Product Design',
  retainer: '🤝 Retainer',
  other: '✨ Other',
};

const BUDGET_LABELS: Record<BudgetRange, string> = {
  under_5k: 'Under $5K',
  '5k_to_15k': '$5K – $15K',
  '15k_to_50k': '$15K – $50K',
  '50k_to_100k': '$50K – $100K',
  over_100k: '$100K+',
  to_be_discussed: 'Let\'s discuss',
};

const TIMELINE_LABELS: Record<Timeline, string> = {
  asap: '⚡ ASAP',
  within_2_weeks: '⏱️ Within 2 weeks',
  within_1_month: '📅 Within 1 month',
  within_3_months: '🗓️ Within 3 months',
  within_6_months: '📆 Within 6 months',
  flexible: '🌊 Flexible',
};

// ─── Sub-step components ───────────────────────────────────────────────────────

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: 0.28, ease: 'easeOut' as const },
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-gray-300 mb-2">
      {children}
    </label>
  );
}

function TextInput({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
    />
  );
}

function ChipGrid<T extends string>({
  options,
  labels,
  selected,
  onSelect,
}: {
  options: T[];
  labels: Record<T, string>;
  selected: T | '';
  onSelect: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onSelect(opt)}
          className={`text-left px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
            selected === opt
              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
              : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
          }`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

// ─── Brief / Review panel ─────────────────────────────────────────────────────

function BriefPreview({
  state,
  brief,
  isGenerating,
  onShowContract,
}: {
  state: IntakeState;
  brief: string;
  isGenerating: boolean;
  onShowContract: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          { label: 'Client', value: state.name },
          { label: 'Email', value: state.email },
          { label: 'Project', value: state.projectType ? PROJECT_LABELS[state.projectType as ProjectType] : '—' },
          { label: 'Budget', value: state.budget ? BUDGET_LABELS[state.budget as BudgetRange] : '—' },
          { label: 'Timeline', value: state.timeline ? TIMELINE_LABELS[state.timeline as Timeline] : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
            <div className="text-gray-600 text-xs mb-1 uppercase tracking-wide">{label}</div>
            <div className="text-gray-200 font-medium truncate">{value}</div>
          </div>
        ))}
      </div>

      {/* AI brief */}
      <div>
        <div className="text-xs text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-2">
          <span>AI Creative Brief</span>
          {isGenerating && (
            <span className="text-indigo-400 animate-pulse">Generating…</span>
          )}
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 min-h-[120px]">
          {isGenerating ? (
            <div className="flex gap-1 items-center h-full">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-indigo-500"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed font-sans">
              {brief || 'Brief will appear here…'}
            </pre>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onShowContract}
        disabled={isGenerating || !brief}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm disabled:opacity-50 transition-opacity hover:opacity-90"
      >
        📄 Preview Contract
      </button>
    </div>
  );
}

// ─── IntakePage ───────────────────────────────────────────────────────────────

export default function IntakePage() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<IntakeState>({
    name: '',
    email: '',
    projectType: '',
    goals: '',
    budget: '',
    timeline: '',
  });
  const [brief, setBrief] = useState('');
  const [contract, setContract] = useState('');
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [isSendingContract, setIsSendingContract] = useState(false);
  const generatedRef = useRef(false);

  const update = <K extends keyof IntakeState>(key: K, value: IntakeState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  // Generate brief when we reach the review step
  useEffect(() => {
    if (step === 5 && !generatedRef.current && state.name && state.projectType) {
      generatedRef.current = true;
      setIsGeneratingBrief(true);
      void generateBrief(state)
        .then((b) => { setBrief(b); setContract(generateContractMarkdown(state, b)); })
        .finally(() => setIsGeneratingBrief(false));
    }
  }, [step, state]);

  const canAdvance = () => {
    switch (step) {
      case 0: return state.name.trim().length > 0 && state.email.includes('@');
      case 1: return !!state.projectType;
      case 2: return state.goals.trim().length > 10;
      case 3: return !!state.budget;
      case 4: return !!state.timeline;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step < 5 && canAdvance()) setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="min-h-screen bg-gray-950 flex items-start justify-center pt-16 pb-24 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">⚡</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Start Your Project</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Zero-Day GTM — smart intake powered by Creative Liberation Engine
          </p>
        </div>

        {/* Stepper */}
        <IntakeStepper currentStep={step} onStepClick={(i) => i < step && setStep(i)} />

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div key={step} {...slide}>
            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-8 mb-6">
              {/* Step 0 — About You */}
              {step === 0 && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-xl font-bold text-white">Let's start with you</h2>
                  <div>
                    <FieldLabel>Your name</FieldLabel>
                    <TextInput
                      id="intake-name"
                      value={state.name}
                      onChange={(v) => update('name', v)}
                      placeholder="Jane Smith"
                      autoFocus
                    />
                  </div>
                  <div>
                    <FieldLabel>Email address</FieldLabel>
                    <TextInput
                      id="intake-email"
                      type="email"
                      value={state.email}
                      onChange={(v) => update('email', v)}
                      placeholder="jane@company.com"
                    />
                  </div>
                </div>
              )}

              {/* Step 1 — Project Type */}
              {step === 1 && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-xl font-bold text-white">What are we building?</h2>
                  <ChipGrid
                    options={Object.keys(PROJECT_LABELS) as ProjectType[]}
                    labels={PROJECT_LABELS}
                    selected={state.projectType}
                    onSelect={(v) => update('projectType', v)}
                  />
                </div>
              )}

              {/* Step 2 — Goals */}
              {step === 2 && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-xl font-bold text-white">What are you trying to achieve?</h2>
                  <p className="text-sm text-gray-500">
                    Share your vision, goals, and any context that would help us understand your project.
                  </p>
                  <textarea
                    id="intake-goals"
                    value={state.goals}
                    onChange={(e) => update('goals', e.target.value)}
                    placeholder="Tell us about your target audience, key goals, success metrics, or anything else that matters…"
                    autoFocus
                    rows={6}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                  />
                  <p className="text-xs text-gray-600">{state.goals.length} characters</p>
                </div>
              )}

              {/* Step 3 — Budget */}
              {step === 3 && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-xl font-bold text-white">What's your budget range?</h2>
                  <ChipGrid
                    options={Object.keys(BUDGET_LABELS) as BudgetRange[]}
                    labels={BUDGET_LABELS}
                    selected={state.budget}
                    onSelect={(v) => update('budget', v)}
                  />
                </div>
              )}

              {/* Step 4 — Timeline */}
              {step === 4 && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-xl font-bold text-white">When do you need this?</h2>
                  <ChipGrid
                    options={Object.keys(TIMELINE_LABELS) as Timeline[]}
                    labels={TIMELINE_LABELS}
                    selected={state.timeline}
                    onSelect={(v) => update('timeline', v)}
                  />
                </div>
              )}

              {/* Step 5 — Review */}
              {step === 5 && (
                <div className="flex flex-col gap-5">
                  <h2 className="text-xl font-bold text-white">Review & Generate Contract</h2>
                  <BriefPreview
                    state={state}
                    brief={brief}
                    isGenerating={isGeneratingBrief}
                    onShowContract={() => setShowContract(true)}
                  />
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        {step < 5 && (
          <div className="flex justify-between gap-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 0}
              className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-sm disabled:opacity-30 transition-colors"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance()}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm disabled:opacity-50 transition-opacity hover:opacity-90"
            >
              {step === 4 ? '✨ Generate Brief' : 'Continue →'}
            </button>
          </div>
        )}
      </div>

      {/* Contract preview modal */}
      <ContractPreviewModal
        isOpen={showContract}
        contractMarkdown={contract}
        clientName={state.name}
        projectType={state.projectType}
        onClose={() => setShowContract(false)}
        onSend={async () => {
          setIsSendingContract(true);
          try {
            await sendContractToClient(state, contract);
          } finally {
            setIsSendingContract(false);
          }
        }}
      />
    </div>
  );
}

// ─── AI Brief generator (REST → Genkit) ──────────────────────────────────────

async function generateBrief(state: IntakeState): Promise<string> {
  const GENKIT_URL = process.env.NEXT_PUBLIC_GENKIT_URL ?? 'http://localhost:4100';
  try {
    const res = await fetch(`${GENKIT_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `You are STUDIO, the Creative Liberation Engine creative director.
Write a concise 3-paragraph creative brief for this client project.
Be specific, energetic, and visionary. No bullet points — flowing prose.

Client: ${state.name} (${state.email})
Project Type: ${state.projectType}
Goals & Vision: ${state.goals}
Budget: ${state.budget}
Timeline: ${state.timeline}

Write the brief now:`,
        model: process.env.NEXT_PUBLIC_GENKIT_DEFAULT_MODEL ?? 'googleai/gemini-2.5-flash',
        config: { temperature: 0.8 },
      }),
    });
    if (!res.ok) throw new Error('Genkit error');
    const data = (await res.json()) as { text: string };
    return data.text;
  } catch {
    return `Creative Brief — ${state.projectType?.replace(/_/g, ' ')}

This project represents a unique opportunity to craft something exceptional for ${state.name}. With a ${state.budget} investment and a ${state.timeline} timeline, we have the runway to deliver a solution that truly resonates.

The vision is clear: ${state.goals.slice(0, 200)}… Our approach will be rooted in strategy, executed with precision, and delivered with the Creative Liberation Engine's full creative arsenal.

Next step: review and sign the engagement contract below.`;
  }
}

// ─── Contract markdown generator ──────────────────────────────────────────────

function generateContractMarkdown(state: IntakeState, brief: string): string {
  const today = new Date().toLocaleDateString('en-CA');
  return `LETTER OF ENGAGEMENT
====================
Date: ${today}
Client: ${state.name}
Email: ${state.email}

PROJECT SCOPE
-------------
Project Type: ${state.projectType?.replace(/_/g, ' ')}
Budget Range: ${state.budget ? BUDGET_LABELS[state.budget as BudgetRange] : 'To be discussed'}
Timeline: ${state.timeline ? TIMELINE_LABELS[state.timeline as Timeline] : 'To be discussed'}

CREATIVE BRIEF
--------------
${brief}

TERMS
-----
1. This letter of engagement outlines our mutual understanding of the project scope.
2. A formal contract with specific deliverables, milestones, and payment terms will be provided within 48 hours.
3. Project commencement is contingent upon receipt of a signed agreement and deposit.
4. All work product remains the property of the client upon final payment.
5. Creative Liberation Engine reserves the right to display completed work in its portfolio unless otherwise agreed.

NEXT STEPS
----------
We are excited to bring this vision to life. Please review this brief and reply to confirm your interest or request any amendments.

With creative intent,
Creative Liberation Engine Creative Studio
`;
}

// ─── Contract sender ──────────────────────────────────────────────────────────

async function sendContractToClient(state: IntakeState, contractMarkdown: string): Promise<void> {
  const res = await fetch('/api/zero-day/send-contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientEmail: state.email,
      clientName: state.name,
      projectType: state.projectType,
      contractMarkdown,
    }),
  });
  if (!res.ok) {
    throw new Error(`Contract send failed: ${res.status}`);
  }
}

