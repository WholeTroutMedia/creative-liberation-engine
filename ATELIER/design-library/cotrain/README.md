# CoTrain.ai Design Archetype
## "Warm Tech Editorial" & Glassmorphic AI Layouts

CoTrain.ai serves as a visual benchmark for high-end SaaS applications, showcasing a hybrid design style that blends premium print journalism typography with interactive glassmorphism and spring-physics animations.

### 1. Typographic Contrast (The 3-Tier System)
*   **Headline/Display**: Modern high-contrast Editorial Serif (*Qurova*, *Playfair Display*). Establishes human quality, prestige, and custom craftsmanship.
*   **Body & Interface**: Neutral geometric Sans-Serif (*Inter*, *Plus Jakarta Sans*). Ensures maximum legibility for logs, search inputs, and job listings.
*   **Metadata, Badges & Timezones**: Technical Monospace (*JetBrains Mono*, *SF Mono*). Denotes data precision, AI calculation, and structure.

### 2. The Glass Card Formula
*   **Background**: Deep Space Charcoal (`rgb(8,10,16)`) or low-opacity midnight purple.
*   **Borders**: Ultra-thin glass line (`border: 1px solid rgba(255, 255, 255, 0.08)`).
*   **Tactile Edge Highlight**: Inner inset shadow (`box-shadow: inset 1px 2px rgba(255, 255, 255, 0.15)`). This simulates a light source reflecting off the top-left edge of the glass card, creating a premium beveled effect.
*   **Outer Blur**: Backdrop-filter blur of `12px` to `16px`.

### 3. Spring Physics & Kinetic Motion
*   **No Linear/Ease Timing**: Standard CSS linear/ease animations are replaced by physical spring simulations.
    *   *Micro Snapping*: High stiffness (`500-600`) and low damping (`29`) for snappy button hover bounds, active selection pops, and toggles.
    *   *Fluid Layout Shifts*: Low stiffness (`92`) and high damping (`60`) to slide panels and push elements during page size changes.
*   **Magic Motion Layout Sharing**: Active state tabs and page transitions share a `layoutId`. Instead of simple fade animations, indicator components morph and slide from card to card.
*   **Instant Interaction**: Tap events fire on touch start (`onTap`) to bypass browser-based click latencies.

### 4. Rich Lottie & Loop Assets
*   **Lottie JSON Animations**: Light-weight SVG runtimes (11 instances) render vector matching patterns and circular loaders directly in the DOM at 60fps.
*   **HTML5 Silent Video Demos**: Auto-playing silent MP4 clips display candidate and dashboard preview workflows, reducing the text weight on the interface.
