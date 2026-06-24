---
name: Luminous Gallery
colors:
  # Base Theme Colors (Obsidian Canvas)
  background: '#030303'
  on-background: '#e5e5e5'
  surface: '#0d0d0d'
  surface-dim: '#030303'
  surface-bright: '#1a1a1a'
  surface-container: '#0e0e0e'
  on-surface: '#e5e5e5'
  on-surface-variant: '#a3a3a3'
  outline: '#262626'
  outline-variant: '#1a1a1a'
  
  # Reactive dynamic accents (represented as tokens that change dynamically in code)
  # But for the design system base, we can define the default/primary as Serenity Amber
  primary: '#ff7a00'          # Serenity Amber
  on-primary: '#030303'
  primary-container: '#3a1e00'
  on-primary-container: '#ffa34d'
  
  # Duality Steel Silver accent
  secondary: '#b3b3b3'        # Duality Silver
  on-secondary: '#030303'
  secondary-container: '#262626'
  on-secondary-container: '#e5e5e5'
  
  # No Place Like Home Forest Green accent
  tertiary: '#2d6a4f'         # Forest Green
  on-tertiary: '#ffffff'
  tertiary-container: '#143424'
  on-tertiary-container: '#74c69d'
  
  # Neutral/Tactile border
  border-muted: '#1f1f1f'
  interactive-accent: '#ff7a00'
  interactive-accent-hover: '#ff9533'
  text-normal: '#e5e5e5'
  text-muted: '#737373'

typography:
  display-lg:
    fontFamily: Cormorant Garamond
    fontSize: 56px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Cormorant Garamond
    fontSize: 36px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Cormorant Garamond
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '300'
    lineHeight: '1.6'
  body-md:
    fontFamily: Outfit
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Space Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.08em
  label-sm:
    fontFamily: Space Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.1em

rounded:
  sm: 0px
  DEFAULT: 0px
  md: 0px
  lg: 0px
  xl: 0px
  full: 9999px

spacing:
  unit: 4px
  gutter: 24px
  margin-edge: 32px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  section-gap: 64px
---

## Brand & Style

The visual identity of Luminous Gallery is rooted in Obsidian Fine-Art Monolithism. The storefront serves as a dark, silent, and highly structured museum gallery for physical museum-grade prints. Rather than drawing attention to itself, the UI wraps around the artwork like a custom gallery frame. 

The core visual mechanic is the Photo-Reactive Energy Bridge:
1. The storefront's background remains a deep, velvet obsidian black (#030303).
2. The interactive accent color, border lines, typography highlights, and ambient glow "bloom" behind the frame shift dynamically to match the color profile and emotional energy of the active print.
3. The spatial frame adapts its physical aspect ratio dynamically to match the natural dimensions of the active image. The image is never cropped, letterboxed, or pillarboxed. The frame fits the image, not the other way around.

## Colors

The design system maintains a base palette of obsidian grays, but transitions dynamically based on the selected print:

*   **[Serenity] Serenity Amber Sunset**: Activated by the horizontal landscape master print. The highlight borders transition to sunset copper-gold (`#ff7a00`), and a large diffused amber radial bloom is projected into the background.
*   **[Duality] Duality Steel Silver**: Activated by the square split master print. The borders shift to a cool, clinical steel-silver (`#b3b3b3`), and a titanium/ice-blue bloom floats in the background.
*   **[Home] No Place Like Home Forest Green**: Activated by the vertical portrait print. Borders transition to a deep, organic forest green (`#2d6a4f`), with an emerald-moss bloom radiating from behind the frame.

## Typography

Typography is a key element of the gallery's editorial look, balancing historical human craftsmanship with modern technical utility:

1.  Display & Headlines (Cormorant Garamond): A premium, high-contrast Serif that projects artistic authenticity, authority, and gallery-grade craftsmanship.
2.  Interface & Body (Outfit): A clean, elegant Sans-Serif with circular geometrics, providing a readable, high-end feel for descriptions and UI labels.
3.  Technical Metadata (Space Mono): Used for coordinates, print dimensions, pricing, and cryptographic NFC tag telemetry. This monospaced font reinforces the technical and sovereign precision of the CLE V6 ecosystem.

## Layout & Spacing

Layout behaves like a modular grid with the active print frame serving as the mathematical anchor:

- Fluid Framing: Bounding containers wrap around the natural aspect ratio of the image. Width and height are computed dynamically to eliminate any letterboxing or black borders within the frame.
- Asymmetric Balance: The layout balances a large, prominent print viewport with a technical metadata panel on one side and a selector list on the other.
- Clean Alignment: A modular 4px unit forms all margins and gaps. Horizontal and vertical hairlines define structural boundaries.

## Elevation & Depth

- Zero Shadows: Shadows are replaced by thin, precise, photo-reactive 1px borders.
- Ambient Bloom: The depth is spatial and atmospheric. Radial gradients of low opacity bloom behind the active frame, creating the illusion that the print itself is projecting light onto the gallery wall.

## Shapes

- Strict Rectilinearity: All corner radii are set to 0px. Buttons, cards, selector blocks, inputs, and image frames have sharp, clean, unyielding edges to maintain a premium architectural feel.

## Components

### Print Frame Viewport
- Recessed black mounting board.
- Natural-dimension frame wrapping.
- Subtle 3D perspective tilt on hover, reactively casting an ambient bloom matching the print's signature color.

### Selector Tabs
- Layout list of prints (01 / Serenity, 02 / Duality, 03 / No Place Like Home) in Space Mono.
- Active item displays the print title in Cormorant Garamond with a solid underline in the reactive accent color.

### Metadata Telemetry Panel
- Monospaced Space Mono readouts showing size, paper type, serial number, and cryptographic NFC verification status.
- Description copy in clean Outfit body text.

### Acquisition / Billing Panel
- A drawer/overlay console with 1px border.
- Solid reactive-accent primary buttons with black uppercase monospace labels.
- Clean text fields with no rounded corners.
