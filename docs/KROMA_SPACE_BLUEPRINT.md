> WARNING DEPRECATED - Consolidated into NEXUS. See docs/NEXUS.md

# KROMA.space: Product Specification & Architecture Blueprint

## 1. Executive Summary
**Project Name:** KROMA.space
**Vision:** An "operating system for digital art." KROMA transforms static 2D portfolios and images into living, breathing, audio-reactive spatial environments.
**Core Value Proposition:** By combining DOM-bypassing fluid physics with an entirely bespoke, legally safe audio generator, KROMA provides artists and agencies with an unparalleled, interactive web experience where users physically and musically interact with the art.

## 2. Core Concepts & User Journeys

### A. The Last Supper Proof of Concept (MVP)
* **Concept:** An interactive visualization of Da Vinci’s *The Last Supper* based on Giovanni Maria Pala’s "hidden music" theory (matching bread and hands to musical notes).
* **The Experience:** Transforms a static academic idea into a visceral, spatial, and auditory journey.
* **Mechanics:** Uses the underlying principles of tools like Pretext—bypassing the DOM, immediate-mode rendering, and hardware acceleration—to turn visual data (particles, light rays) into a living, hyper-reactive mathematical simulation. The music drives the navigation and layout of the experience.

### B. Generative Audio-Visual Engine (The Core Tech)
* **Concept:** A generative physics engine for audio-visual art.
* **Mechanism:** Users input personal images and prompt an animated art piece driven by a song or musical idea.
* **Audio Data:** The internal AI stack is strictly trained on open-source or open-license classical music, creating a "walled garden" approach.
* **Defensibility:** This legally safe audio generation sidesteps the massive copyright hurdles faced by standard AI music generators (e.g., Suno, Udio).

### C. Spatial Portfolio Platform (The SaaS Product)
* **Concept:** Expanding the tool into a platform for designers, artists, and agencies to host their portfolios.
* **Next-Level Features:** Portfolios cease to be 2D scrolling pages; they become compute-driven, procedural spatial environments that dynamically react to audio and user interactions.

## 3. Technology Stack

### Frontend Architecture
* **Core Libraries:** Three.js, WebGL, WebGPU, and the Web Audio API.
* **Rendering & Physics:** Immediate-mode rendering, Kinematic Spring Physics, Signed Distance Fields (SDFs), and fluid simulations to create tactile, living experiences.
* **Layout/Compute:** Utilizing paradigms derived from fast layout libraries (like Pretext) for DOM-bypassing, zero-latency constraint solving, and WebGPU Compute Shaders to process visual data at high animation speeds.

### Backend Architecture
* **Core Framework:** Python / FastAPI.
* **Functionality:** Handles local LLM/AI model inference and data retrieval for the generative audio components.

## 4. Infrastructure & Self-Hosting (The "Local Data Center")
To transition from a local project to a self-hosted SaaS business, the underlying hardware must act as a localized cloud provider.

### Hardware Specifications
* **Compute Node:** Ugreen 6011 pro server node.
* **GPU:** Connected Nvidia RTX 3080 (serves as the primary compute engine for WebGPU processing and AI inference, with plans to upgrade later).
* **Storage (Total ~134TB):**
  * Custom NAS with ~100TB of storage.
  * Secondary NAS with 34TB of free storage.

### Network & Infrastructure Preparedness
* **Resource Protection:** Because the backend relies on a single consumer GPU, a **Redis/Celery queue** implemented in Python is absolutely critical. This protects the RTX 3080's VRAM from being overloaded and crashing when multiple concurrent users interact with the app.
* **Security & Routing:** Cloudflare Tunnels must be configured on the Ugreen server to safely expose the localized cloud provider to the public web without compromising the home network's security.
* **Cost Strategy:** This architecture bypasses thousands of dollars in monthly AWS GPU costs, making beta testing highly cost-effective.
