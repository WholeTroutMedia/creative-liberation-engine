'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Step {
  id: string;
  label: string;
  icon: string;
}

const STEPS: Step[] = [
  { id: 'intro', label: 'About You', icon: '👋' },
  { id: 'project', label: 'Project', icon: '🎯' },
  { id: 'goals', label: 'Goals', icon: '✨' },
  { id: 'budget', label: 'Budget', icon: '💰' },
  { id: 'timeline', label: 'Timeline', icon: '📅' },
  { id: 'review', label: 'Review', icon: '🔍' },
];

interface IntakeStepperProps {
  currentStep: number;
  onStepClick?: (index: number) => void;
}

export function IntakeStepper({ currentStep, onStepClick }: IntakeStepperProps) {
  return (
    <div className="w-full mb-8">
      {/* Progress bar */}
      <div className="relative h-1 bg-gray-800 rounded-full mb-6">
        <motion.div
          className="absolute h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>

      {/* Step bubbles */}
      <div className="flex justify-between">
        {STEPS.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          return (
            <button
              key={step.id}
              onClick={() => onStepClick?.(i)}
              disabled={i > currentStep}
              className="flex flex-col items-center gap-1.5 group disabled:cursor-not-allowed"
              aria-label={step.label}
            >
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                  isDone
                    ? 'bg-indigo-600 text-white'
                    : isActive
                    ? 'bg-indigo-600/20 border-2 border-indigo-500 text-indigo-400'
                    : 'bg-gray-800 text-gray-600 border border-gray-700'
                }`}
                animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {isDone ? '✓' : step.icon}
              </motion.div>
              <span className={`text-xs font-medium transition-colors ${
                isActive ? 'text-indigo-400' : isDone ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ContractPreviewModalProps {
  isOpen: boolean;
  contractMarkdown: string;
  clientName: string;
  projectType: string;
  onClose: () => void;
  onSend: () => Promise<void>;
}

export function ContractPreviewModal({
  isOpen,
  contractMarkdown,
  clientName,
  projectType,
  onClose,
  onSend,
}: ContractPreviewModalProps) {
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setIsSending(true);
    try {
      await onSend();
      setSent(true);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-16 z-50 bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-8 py-5 border-b border-gray-800 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">Contract Preview</h2>
                <p className="text-sm text-gray-400">{clientName} · {projectType.replace(/_/g, ' ')}</p>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white p-2">✕</button>
            </div>

            {/* Contract body */}
            <div className="flex-1 overflow-y-auto p-8 min-h-0">
              {sent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center h-full text-center"
                >
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-2xl font-bold text-white mb-2">Contract Sent</h3>
                  <p className="text-gray-400">Your contract has been delivered to {clientName}.</p>
                </motion.div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-gray-300 leading-relaxed text-sm">
                    {contractMarkdown}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            {!sent && (
              <div className="px-8 py-5 border-t border-gray-800 flex justify-between items-center shrink-0">
                <button onClick={onClose} className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
                  Back to Edit
                </button>
                <button
                  onClick={() => void handleSend()}
                  disabled={isSending}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold text-sm disabled:opacity-60 transition-opacity"
                >
                  {isSending ? 'Sending…' : '📨 Send Contract to Client'}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
