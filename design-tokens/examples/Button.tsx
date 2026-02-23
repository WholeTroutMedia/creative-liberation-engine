/**
 * Button.tsx — Example React component using Inception Engine design tokens
 *
 * Demonstrates CSS-in-JS usage via CSS custom properties and
 * direct JS token imports. Both approaches are production-valid.
 *
 * Prerequisites:
 *   1. Run `npm run build` in /design-tokens
 *   2. Import tokens.css in your app entry: import '@inception-engine/design-tokens/css'
 */

import React from 'react';
import type { CSSProperties, ButtonHTMLAttributes, ReactNode } from 'react';

// ---- Approach A: import resolved JS tokens for programmatic use ----
// import tokens from '@inception-engine/design-tokens';

// ---- Approach B: use CSS custom properties (preferred) ----
// Tokens are available globally via :root after importing tokens.css

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    backgroundColor: 'var(--ie-color-semantic-brand-primary)',
    color:           'var(--ie-color-semantic-text-on-brand)',
    border:          'none',
  },
  secondary: {
    backgroundColor: 'transparent',
    color:           'var(--ie-color-semantic-brand-primary)',
    border:          '1px solid var(--ie-color-semantic-border-default)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color:           'var(--ie-color-semantic-text-primary)',
    border:          'none',
  },
  danger: {
    backgroundColor: 'var(--ie-color-semantic-status-error-icon)',
    color:           'var(--ie-color-primitive-neutral-0)',
    border:          'none',
  },
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: {
    fontSize:      'var(--ie-typography-font-size-sm)',
    padding:       'var(--ie-spacing-1) var(--ie-spacing-3)',
    borderRadius:  'var(--ie-border-radius-md)',
    minHeight:     '32px',
  },
  md: {
    fontSize:      'var(--ie-typography-font-size-base)',
    padding:       'var(--ie-spacing-2) var(--ie-spacing-4)',
    borderRadius:  'var(--ie-border-radius-md)',
    minHeight:     '40px',
  },
  lg: {
    fontSize:      'var(--ie-typography-font-size-lg)',
    padding:       'var(--ie-spacing-3) var(--ie-spacing-6)',
    borderRadius:  'var(--ie-border-radius-lg)',
    minHeight:     '48px',
  },
};

const baseStyle: CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  gap:            'var(--ie-spacing-2)',
  fontFamily:     'var(--ie-typography-font-family-sans)',
  fontWeight:     'var(--ie-typography-font-weight-medium)' as any,
  lineHeight:     'var(--ie-typography-line-height-none)' as any,
  cursor:         'pointer',
  transition:     `background-color var(--ie-animation-duration-fast) var(--ie-animation-easing-ease-in-out), box-shadow var(--ie-animation-duration-fast) var(--ie-animation-easing-ease-in-out), opacity var(--ie-animation-duration-fast) var(--ie-animation-easing-ease-in-out)`,
  userSelect:     'none',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const mergedStyle: CSSProperties = {
    ...baseStyle,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(disabled || loading ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
    ...style,
  };

  return (
    <button
      style={mergedStyle}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

// Simple loading spinner using token-based animation timing
function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        animation: `spin var(--ie-animation-duration-slowest) linear infinite`,
      }}
    >
      <circle
        cx="8" cy="8" r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="30 10"
      />
    </svg>
  );
}

/* ---- Usage examples ----

import { Button } from './Button';

<Button variant="primary">Save changes</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="danger" size="lg">Delete account</Button>
<Button variant="ghost" loading>Processing...</Button>

*/
