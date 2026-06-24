/* ==========================================================================
   LUMINOUS GALLERY — main.js
   Premium interactive logic: Fluid aspect ratio morphs, 3D mousemove tilts,
   dynamic color-reactive variables, canvas drawing engine, & billing modal.
   ========================================================================== */

const printData = {
  serenity: {
    name: "Serenity",
    index: "PROOF_01",
    color: "#c9a84c", // Swiss Gold
    colorBg: "#14120e",
    colorMuted: "#755b00",
    aspect: 0.80,
    size: "32\" × 40\" // MOUNT: ACRYLIC // TIER: ARCHITECT",
    sizeShort: "32\" × 40\" Acrylic Proof",
    coords: "35.015° N, 115.485° W",
    camera: "PHASE ONE IQ4 150MP",
    optics: "RODENSTOCK 80MM f/4.0 HR Digaron-S",
    exposure: "f/8.0 @ 1/4s, ISO 50",
    price: "$1,850 USD",
    description: "A quiet study of light scattering through high-altitude aerosol clouds at twilight. Captured with a medium format digital back and bespoke custom refractive lenses.",
    imageSrc: "/prints/serenity_preview.webp"
  },
  duality: {
    name: "Duality",
    index: "PROOF_02",
    color: "#ffffff", // Swiss White
    colorBg: "#161616",
    colorMuted: "#888888",
    aspect: 1.50,
    size: "36\" × 24\" // MOUNT: BRUSHED ALUMINUM // TIER: EXPERIENCE",
    sizeShort: "36\" × 24\" Aluminum Proof",
    coords: "78.223° N, 15.647° E",
    camera: "HASSELBLAD H6D 100MP",
    optics: "HASSELBLAD HC 35MM f/3.5",
    exposure: "f/11.0 @ 1/125s, ISO 64",
    price: "$2,200 USD",
    description: "A high-contrast exploration of architectural brutalism meeting coastal decay. Two opposing forces frozen in symmetrical tension.",
    imageSrc: "/prints/duality_preview.webp"
  },
  home: {
    name: "No Place Like Home",
    index: "PROOF_03",
    color: "#d0c5b2", // Swiss Sand
    colorBg: "#161412",
    colorMuted: "#99907e",
    aspect: 0.6667,
    size: "30\" × 45\" // MOUNT: MUSEUM COTTON RAG // TIER: EXPERIENCE",
    sizeShort: "30\" × 45\" Cotton Rag Proof",
    coords: "47.802° N, 124.048° W",
    camera: "SONY A7R V 61MP",
    optics: "SONY FE 24MM f/1.4 GM",
    exposure: "f/2.8 @ 30s, ISO 1600",
    price: "$1,600 USD",
    description: "An immersive deep-exposure sequence capturing the bioluminescent root systems in old-growth temperate rainforests.",
    imageSrc: "/prints/no_place_like_home_preview.webp"
  }
};


let activePrintKey = 'serenity';

/* ==========================================================================
   Boot & Event Listeners Initialization
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initSystemClock();
  initPrintSelector();
  init3DMouseTilt();
  initBillingConsole();
  initStudioPortal();
  initOperatorCockpit();
  
  // Initial draw
  setTimeout(() => {
    switchActivePrint('serenity');
  }, 100);
});

/* ==========================================================================
   Real-Time Digital Telemetry Clock
   ========================================================================== */
function initSystemClock() {
  const clockEl = document.getElementById('system-time');
  if (!clockEl) return;
  
  const updateClock = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    clockEl.textContent = `${year}.${month}.${day} // ${hours}:${minutes}:${seconds} EST`;
  };
  
  updateClock();
  setInterval(updateClock, 1000);
}

/* ==========================================================================
   Curator Layout Engine Toggles
   ========================================================================== */
function initLayoutConsole() {
  const btnLayout = document.getElementById('btn-toggle-layout');
  const btnNav = document.getElementById('btn-toggle-nav');
  const btnControls = document.getElementById('btn-toggle-controls');

  if (btnLayout) {
    btnLayout.addEventListener('click', () => {
      if (document.body.classList.contains('layout-curators-lens')) {
        document.body.classList.remove('layout-curators-lens');
        document.body.classList.add('layout-traditional');
        btnLayout.textContent = '[ LAYOUT: TRADITIONAL GRID ]';
      } else {
        document.body.classList.remove('layout-traditional');
        document.body.classList.add('layout-curators-lens');
        btnLayout.textContent = '[ LAYOUT: CURATORS LENS ]';
      }
    });
  }

  if (btnNav) {
    btnNav.addEventListener('click', () => {
      const navModes = ['nav-bottom', 'nav-top', 'nav-left'];
      let currentIdx = navModes.findIndex(mode => document.body.classList.contains(mode));
      
      // Remove current class
      if (currentIdx !== -1) {
        document.body.classList.remove(navModes[currentIdx]);
      }
      
      // Cycle to next class
      const nextIdx = (currentIdx + 1) % navModes.length;
      document.body.classList.add(navModes[nextIdx]);

      // Update button text
      const labels = {
        'nav-bottom': '[ NAV: BOTTOM FLOAT ]',
        'nav-top': '[ NAV: TOP HEADER ]',
        'nav-left': '[ NAV: LEFT SIDEBAR ]'
      };
      btnNav.textContent = labels[navModes[nextIdx]];
    });
  }

  if (btnControls) {
    btnControls.addEventListener('click', () => {
      if (document.body.classList.contains('controls-hud')) {
        document.body.classList.remove('controls-hud');
        btnControls.textContent = '[ PANELS: FULLSCREEN OVERLAYS ]';
      } else {
        document.body.classList.add('controls-hud');
        btnControls.textContent = '[ PANELS: FLOATING HUD ]';
      }
    });
  }
}

/* ==========================================================================
   Curator Lens Grid Construction Lines Position Computation
   ========================================================================== */
function updateGridLines() {
  const container = document.querySelector('.gallery-viewport-container');
  const viewport = document.getElementById('print-viewport');
  const glHt = document.getElementById('grid-line-ht');
  const glHb = document.getElementById('grid-line-hb');
  const glVl = document.getElementById('grid-line-vl');
  const glVr = document.getElementById('grid-line-vr');

  if (!container || !viewport || !glHt || !glHb || !glVl || !glVr) return;

  if (!document.body.classList.contains('layout-curators-lens')) {
    glHt.style.opacity = '0';
    glHb.style.opacity = '0';
    glVl.style.opacity = '0';
    glVr.style.opacity = '0';
    return;
  }

  glHt.style.opacity = '0.15';
  glHb.style.opacity = '0.15';
  glVl.style.opacity = '0.15';
  glVr.style.opacity = '0.15';

  const containerRect = container.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();

  const relativeTop = viewportRect.top - containerRect.top;
  const relativeBottom = viewportRect.bottom - containerRect.top;
  const relativeLeft = viewportRect.left - containerRect.left;
  const relativeRight = viewportRect.right - containerRect.left;

  glHt.style.top = `${relativeTop}px`;
  glHb.style.top = `${relativeBottom}px`;
  glVl.style.left = `${relativeLeft}px`;
  glVr.style.left = `${relativeRight}px`;
}

function animateGridLines() {
  updateGridLines();
  requestAnimationFrame(animateGridLines);
}

/* ==========================================================================
   Fluid Aspect & Metadata Transitions
   ========================================================================== */
function initPrintSelector() {
  const allSelectableItems = [
    ...document.querySelectorAll('#print-selector-list .print-item'),
    ...document.querySelectorAll('#header-print-selector .header-nav-item'),
    ...document.querySelectorAll('#bottom-print-selector .bottom-nav-item')
  ];

  allSelectableItems.forEach(item => {
    item.addEventListener('click', () => {
      const key = item.getAttribute('data-print');
      if (key && key !== activePrintKey) {
        switchActivePrint(key);
      }
    });
  });
}

function switchActivePrint(key) {
  activePrintKey = key;
  const data = printData[key];
  if (!data) return;

  // Sync active classes across all three selectors
  document.querySelectorAll('#print-selector-list .print-item').forEach(el => {
    if (el.getAttribute('data-print') === key) el.classList.add('active');
    else el.classList.remove('active');
  });
  document.querySelectorAll('#header-print-selector .header-nav-item').forEach(el => {
    if (el.getAttribute('data-print') === key) el.classList.add('active');
    else el.classList.remove('active');
  });
  document.querySelectorAll('#bottom-print-selector .bottom-nav-item').forEach(el => {
    if (el.getAttribute('data-print') === key) el.classList.add('active');
    else el.classList.remove('active');
  });

  // 1. Color-Reactive Variable Shifts on Root
  const root = document.documentElement;
  root.style.setProperty('--theme-accent', data.color);
  root.style.setProperty('--theme-accent-bg', data.colorBg);
  root.style.setProperty('--theme-accent-muted', data.colorMuted);

  // 2. Size Scale Indicator Label
  const sizeTag = document.getElementById('size-tag');
  if (sizeTag) {
    sizeTag.textContent = `SIZE: ${data.size}`;
  }

  // 3. Metadata Content Panel & Image transition (fade-out, update, fade-in)
  const metaExhibit = document.getElementById('meta-exhibit');
  const metaCoords = document.getElementById('meta-coords');
  const metaCamera = document.getElementById('meta-camera');
  const metaOptics = document.getElementById('meta-optics');
  const metaExposure = document.getElementById('meta-exposure');
  const metaDescription = document.getElementById('meta-description');
  const metaPrice = document.getElementById('meta-price');
  const artImage = document.getElementById('artwork-image');

  const lensMetaExhibit = document.getElementById('lens-meta-exhibit');
  const lensMetaCamera = document.getElementById('lens-meta-camera');
  const lensMetaSize = document.getElementById('lens-meta-size');
  const lensMetaPrice = document.getElementById('lens-meta-price');
  
  const fadeElements = [
    metaExhibit, metaCoords, metaCamera, metaOptics, metaExposure, metaDescription, metaPrice, artImage,
    lensMetaExhibit, lensMetaCamera, lensMetaSize, lensMetaPrice
  ];
  
  fadeElements.forEach(el => {
    if (el) {
      el.style.transition = 'opacity 0.2s ease-out';
      el.style.opacity = '0';
    }
  });

  setTimeout(() => {
    if (metaExhibit) metaExhibit.textContent = data.index;
    if (metaCoords) metaCoords.textContent = data.coords;
    if (metaCamera) metaCamera.textContent = data.camera;
    if (metaOptics) metaOptics.textContent = data.optics;
    if (metaExposure) metaExposure.textContent = data.exposure;
    if (metaDescription) metaDescription.textContent = data.description;
    if (metaPrice) metaPrice.textContent = data.price;

    if (lensMetaExhibit) lensMetaExhibit.textContent = `EXHIBIT // ${data.index}`;
    if (lensMetaCamera) lensMetaCamera.textContent = `CAM // ${data.camera}`;
    if (lensMetaSize) lensMetaSize.textContent = `SIZE // ${data.sizeShort}`;
    if (lensMetaPrice) lensMetaPrice.textContent = `VALUE // ${data.price}`;
    
    if (artImage && data.imageSrc) {
      artImage.src = data.imageSrc;
      artImage.alt = `Luminous Fine Art Print - ${data.name}`;
      
      // Programmatic Aspect Engine: Fits the frame perfectly around the image's natural dimensions
      const updateAspect = () => {
        const viewport = document.getElementById('print-viewport');
        const naturalWidth = artImage.naturalWidth;
        const naturalHeight = artImage.naturalHeight;
        
        if (viewport && !isNaN(naturalWidth) && !isNaN(naturalHeight)) {
          // Calculate max bounding box based on responsive viewport area (capped at premium max dimensions)
          const maxWidth = Math.min(window.innerWidth * 0.70, 800);
          const maxHeight = Math.min(window.innerHeight * 0.50, 500);
          
          let targetWidth = naturalWidth;
          let targetHeight = naturalHeight;
          const ratio = naturalWidth / naturalHeight;
          
          if (targetWidth > maxWidth) {
            targetWidth = maxWidth;
            targetHeight = targetWidth / ratio;
          }
          if (targetHeight > maxHeight) {
            targetHeight = maxHeight;
            targetWidth = targetHeight * ratio;
          }
          
          // Apply exact pixel values to trigger smooth CSS morphing transitions
          viewport.style.width = `${Math.round(targetWidth)}px`;
          viewport.style.height = `${Math.round(targetHeight)}px`;
        }
      };
      
      if (artImage.complete) {
        updateAspect();
      } else {
        artImage.onload = updateAspect;
      }

      // Add a responsive window resize listener to morph sizes dynamically
      window.removeEventListener('resize', updateAspect);
      window.addEventListener('resize', updateAspect);
    }
    
    fadeElements.forEach(el => {
      if (el) {
        el.style.transition = 'opacity 0.4s ease-in';
        el.style.opacity = '1';
      }
    });
  }, 200);
}

/* ==========================================================================
   Generative Premium Canvas Drawings (Dynamic Masterpieces)
   ========================================================================== */
function drawArtwork(printKey) {
  const canvas = document.getElementById('artwork-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  const w = rect.width;
  const h = rect.height;
  
  ctx.fillStyle = '#030303';
  ctx.fillRect(0, 0, w, h);
  
  if (printKey === 'serenity') {
    // Twilight Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#090515');   // Pure deep twilight purple
    skyGrad.addColorStop(0.55, '#1e0c24'); // Dusk indigo
    skyGrad.addColorStop(0.85, '#92360f'); // Sunset rust
    skyGrad.addColorStop(1, '#ff6a00');    // Intense warm orange horizon
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);
    
    // Abstract solar disc (setting sun reflection)
    const sunX = w * 0.65;
    const sunY = h * 0.85;
    const sunRadius = Math.min(w, h) * 0.28;
    
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.2, '#ffd480');
    sunGrad.addColorStop(0.6, '#ff6a00');
    sunGrad.addColorStop(1, 'rgba(255, 106, 0, 0)');
    
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // High altitude fine clouds / scattering dust lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(0, h * (0.35 + i * 0.07));
      ctx.bezierCurveTo(
        w * 0.3, h * (0.28 + i * 0.07),
        w * 0.7, h * (0.42 + i * 0.07),
        w, h * (0.32 + i * 0.07)
      );
      ctx.stroke();
    }
    
    // Floating dust sparks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 24; i++) {
      const px = ((Math.sin(i * 7493.12) + 1) / 2) * w;
      const py = ((Math.cos(i * 3829.41) + 1) / 2) * (h * 0.6);
      ctx.beginPath();
      ctx.arc(px, py, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Precise grid alignment crosses (UI overlay element)
    ctx.strokeStyle = 'rgba(255, 106, 0, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.65, 0); ctx.lineTo(w * 0.65, h);
    ctx.moveTo(0, h * 0.85); ctx.lineTo(w, h * 0.85);
    ctx.stroke();

  } else if (printKey === 'duality') {
    const splitX = w / 2;
    
    // Left Zone (Matte Charcoal Brutalism)
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, splitX, h);
    
    // Right Zone (Obsidian void)
    ctx.fillStyle = '#030303';
    ctx.fillRect(splitX, 0, w, h);
    
    // Technical fine matrix lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    for (let x = 0; x < w; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(w, y);
      ctx.stroke();
    }
    
    // Centered concrete obelisk forms (colliding perspective)
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#18181c';
    
    // Solid block 1 (Left perspective)
    ctx.beginPath();
    ctx.moveTo(splitX - 80, h * 0.15);
    ctx.lineTo(splitX, h * 0.25);
    ctx.lineTo(splitX, h * 0.85);
    ctx.lineTo(splitX - 100, h * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Solid block 2 (Right perspective)
    ctx.fillStyle = '#0f0f12';
    ctx.strokeStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.moveTo(splitX, h * 0.25);
    ctx.lineTo(splitX + 80, h * 0.15);
    ctx.lineTo(splitX + 100, h * 0.75);
    ctx.lineTo(splitX, h * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Absolute central high-contrast horizon split vector
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, h);
    ctx.stroke();

    // Symmetrical geometric locator circles
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(splitX, h / 2, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(splitX, h / 2, 120, 0, Math.PI * 2);
    ctx.stroke();

  } else if (printKey === 'home') {
    // Deep moss/emerald environment gradient
    const forestGrad = ctx.createLinearGradient(0, 0, 0, h);
    forestGrad.addColorStop(0, '#010503');
    forestGrad.addColorStop(0.65, '#05180f');
    forestGrad.addColorStop(1, '#0c2619');
    ctx.fillStyle = forestGrad;
    ctx.fillRect(0, 0, w, h);
    
    // Neural-type bioluminescent vector root system
    const nodes = [
      { x: w * 0.25, y: h * 0.15, size: 5, target: 1 },
      { x: w * 0.5,  y: h * 0.35, size: 7, target: 3 },
      { x: w * 0.75, y: h * 0.2,  size: 5, target: 4 },
      { x: w * 0.35, y: h * 0.7,  size: 8, target: 5 },
      { x: w * 0.65, y: h * 0.58, size: 7, target: 5 },
      { x: w * 0.8,  y: h * 0.85, size: 6, target: -1 }
    ];

    // Drawing bioluminescent network lines
    ctx.strokeStyle = 'rgba(45, 106, 79, 0.35)';
    ctx.lineWidth = 1;
    
    // Draw flowing organic curves for roots
    ctx.beginPath();
    ctx.moveTo(w * 0.45, 0);
    ctx.quadraticCurveTo(w * 0.3, h * 0.2, nodes[1].x, nodes[1].y);
    ctx.quadraticCurveTo(w * 0.6, h * 0.5, nodes[4].x, nodes[4].y);
    ctx.lineTo(nodes[5].x, nodes[5].y);
    
    ctx.moveTo(w * 0.55, 0);
    ctx.quadraticCurveTo(w * 0.7, h * 0.15, nodes[2].x, nodes[2].y);
    ctx.quadraticCurveTo(w * 0.5, h * 0.4, nodes[3].x, nodes[3].y);
    ctx.stroke();

    ctx.moveTo(nodes[0].x, nodes[0].y);
    ctx.lineTo(nodes[1].x, nodes[1].y);
    ctx.stroke();

    // Spores drawing and glowing centers
    nodes.forEach(node => {
      // Ambient radial bioluminescence (stacked concentric circles)
      ctx.fillStyle = 'rgba(77, 182, 126, 0.1)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size * 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(45, 106, 79, 0.4)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size * 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Glowing organic specs drifting
    ctx.fillStyle = 'rgba(77, 182, 126, 0.4)';
    for (let i = 0; i < 20; i++) {
      const px = ((Math.sin(i * 9283.43) + 1) / 2) * w;
      const py = ((Math.cos(i * 8492.12) + 1) / 2) * h;
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ==========================================================================
   Subtle 3D Perspective Tilt on Hover
   ========================================================================== */
function init3DMouseTilt() {
  const container = document.querySelector('.gallery-viewport-container');
  const wrapper = document.getElementById('viewport-3d');
  const viewport = document.getElementById('print-viewport');
  
  if (!container || !wrapper || !viewport) return;
  
  container.addEventListener('mousemove', (e) => {
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left; // Mouse X within wrapper bounds
    const y = e.clientY - rect.top;  // Mouse Y within wrapper bounds
    
    // Normalize coordinates (-0.5 to 0.5)
    const xPct = (x / rect.width) - 0.5;
    const yPct = (y / rect.height) - 0.5;
    
    // Maximum tilt angles (10 degrees maximum tilt for high-end restraint)
    const rotateY = xPct * 12;  
    const rotateX = -yPct * 12; 
    
    // Apply 3D matrix matrix rotation
    viewport.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });
  
  container.addEventListener('mouseleave', () => {
    // Re-enable smooth transition logic and reset orientation
    viewport.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), aspect-ratio 0.6s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.6s';
    viewport.style.transform = 'rotateX(0deg) rotateY(0deg)';
  });

  container.addEventListener('mouseenter', () => {
    // Temporarily turn off rotation transitions during mouse move to lock 60fps tracking
    viewport.style.transition = 'aspect-ratio 0.6s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.6s';
  });
}

/* ==========================================================================
   Secure Acquisition Billing Console Overlays
   ========================================================================== */
function initBillingConsole() {
  const openBtn = document.getElementById('open-billing-btn');
  const closeBtn = document.getElementById('close-billing-btn');
  const modal = document.getElementById('billing-modal');
  
  const invoicePrintName = document.getElementById('invoice-print-name');
  const invoicePrintSize = document.getElementById('invoice-print-size');
  const invoicePrice = document.getElementById('invoice-price');
  const billingTitle = document.getElementById('billing-title');

  const acquisitionForm = document.getElementById('acquisition-form');
  const submitBtn = document.getElementById('submit-acquisition-btn');
  const successState = document.getElementById('success-state');
  const successCloseBtn = document.getElementById('success-close-btn');
  const successContractId = document.getElementById('success-contract-id');

  if (!openBtn || !closeBtn || !modal) return;

  // Open billing overlay and populate context data
  openBtn.addEventListener('click', () => {
    const data = printData[activePrintKey];
    if (!data) return;

    billingTitle.textContent = `Acquire: ${data.name}`;
    invoicePrintName.textContent = data.name;
    invoicePrintSize.textContent = data.sizeShort;
    invoicePrice.textContent = data.price;
    
    // Reset form states
    acquisitionForm.reset();
    successState.classList.remove('active');
    submitBtn.textContent = "EXECUTE ACQUISITION CONTRACT";
    submitBtn.disabled = false;

    // Show modal
    modal.classList.add('active');
  });

  // Close billing overlay
  const closeModal = () => {
    modal.classList.remove('active');
  };
  
  closeBtn.addEventListener('click', closeModal);
  
  // Close on clicking outside the container boundary
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Credit Card spacing utility
  const ccInput = document.querySelector('.cc-num');
  if (ccInput) {
    ccInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
      let matches = val.match(/\d{4,16}/g);
      let match = (matches && matches[0]) || '';
      let parts = [];

      for (let i = 0, len = match.length; i < len; i += 4) {
        parts.push(match.substring(i, i + 4));
      }

      if (parts.length > 0) {
        e.target.value = parts.join(' • ');
      } else {
        e.target.value = val;
      }
    });
  }

  // Handle transaction processing simulation
  if (acquisitionForm) {
    acquisitionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      submitBtn.disabled = true;
      submitBtn.textContent = "CONNECTING SECURE SYSTEM CONTRACT...";

      setTimeout(() => {
        submitBtn.textContent = "AUTHORIZING TRANSFER CRYPTO EXCHANGE...";
        
        setTimeout(() => {
          // Generate unique contract order ID
          const contractNum = Math.floor(100000 + Math.random() * 900000);
          if (successContractId) {
            successContractId.textContent = `LUM-${contractNum}-V6`;
          }

          // Toggle success screen with transition
          successState.classList.add('active');
        }, 1500);

      }, 1200);
    });
  }

  // Close on success done
  if (successCloseBtn) {
    successCloseBtn.addEventListener('click', closeModal);
  }
}

/* ==========================================================================
   Aftershoot Studio Portal — Interactive AI Culling & Retouch Pipeline
   ========================================================================== */
function initStudioPortal() {
  const toggleStudioBtn = document.getElementById('toggle-studio-btn');
  const studioGrid = document.getElementById('studio-grid');
  const galleryGrid = document.querySelector('.gallery-grid');
  
  if (!toggleStudioBtn || !studioGrid) return;
  
  let studioActive = false;
  
  // 1. Core Portal View Toggle
  toggleStudioBtn.addEventListener('click', () => {
    studioActive = !studioActive;
    if (studioActive) {
      toggleStudioBtn.textContent = '[CLIENT GALLERY]';
      galleryGrid.style.display = 'none';
      studioGrid.style.display = 'grid';
      applyFilters(); // Apply current adjustments to loupe image
    } else {
      toggleStudioBtn.textContent = '[STUDIO // CULL & RETOUCH]';
      galleryGrid.style.display = 'grid';
      studioGrid.style.display = 'none';
    }
  });

  // 2. AI Ingestion Drag-and-Drop / Click simulation
  const ingestZone = document.getElementById('ingest-zone');
  const cullStatus = document.getElementById('cull-status-val');
  const heroCount = document.getElementById('hero-count-val');
  const dupCount = document.getElementById('dup-count-val');
  const blurCount = document.getElementById('blur-count-val');
  
  if (ingestZone) {
    ingestZone.addEventListener('click', () => {
      cullStatus.textContent = 'SCANNING DIRECTORY...';
      cullStatus.style.color = '#FF7A00';
      
      setTimeout(() => {
        cullStatus.textContent = 'RUNNING COGNITIVE CULL...';
        
        setTimeout(() => {
          cullStatus.textContent = 'CULL COMPLETED';
          cullStatus.style.color = '#2D6A4F';
          heroCount.textContent = '2 / 3';
          dupCount.textContent = '0 / 3';
          blurCount.textContent = '1 / 3';
        }, 1500);
      }, 1200);
    });
  }

  // 3. Culling Tolerance Sliders
  const sliderSharpness = document.getElementById('slider-sharpness');
  const valSharpness = document.getElementById('val-sharpness');
  if (sliderSharpness && valSharpness) {
    sliderSharpness.addEventListener('input', (e) => {
      valSharpness.textContent = `${e.target.value}%`;
    });
  }

  const sliderEyes = document.getElementById('slider-eyes');
  const valEyes = document.getElementById('val-eyes');
  if (sliderEyes && valEyes) {
    sliderEyes.addEventListener('input', (e) => {
      valEyes.textContent = `${e.target.value}%`;
    });
  }

  const sliderSimilarity = document.getElementById('slider-similarity');
  const valSimilarity = document.getElementById('val-similarity');
  if (sliderSimilarity && valSimilarity) {
    sliderSimilarity.addEventListener('input', (e) => {
      const labels = ['LOW', 'MEDIUM', 'HIGH'];
      valSimilarity.textContent = labels[e.target.value - 1];
    });
  }

  // Manual Trigger Auto-cull
  const executeCullBtn = document.getElementById('execute-cull-btn');
  if (executeCullBtn) {
    executeCullBtn.addEventListener('click', () => {
      cullStatus.textContent = 'CULLING ACTIVE...';
      cullStatus.style.color = '#FF7A00';
      
      setTimeout(() => {
        cullStatus.textContent = 'SUCCESS (AUTO-CULL)';
        cullStatus.style.color = '#2D6A4F';
        heroCount.textContent = '2 / 3';
        dupCount.textContent = '0 / 3';
        blurCount.textContent = '1 / 3';
      }, 800);
    });
  }

  // 4. Culling Cards Matrix Selection
  const cullCards = document.querySelectorAll('.cull-card');
  const loupeImage = document.getElementById('loupe-image');
  const loupeSpecs = document.getElementById('loupe-specs');
  let activeCullKey = 'peak';

  cullCards.forEach(card => {
    card.addEventListener('click', () => {
      cullCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      activeCullKey = card.getAttribute('data-cull-key');
      
      const previewImg = card.querySelector('.cull-img');
      if (loupeImage && previewImg) {
        loupeImage.src = previewImg.src;
      }
      
      const sharpness = card.getAttribute('data-sharpness');
      const eyes = card.getAttribute('data-eyes');
      const group = card.getAttribute('data-group');
      if (loupeSpecs) {
        loupeSpecs.textContent = `FOCUS POINT // SHARPNESS: ${sharpness} // EYES: ${eyes} // GROUP: ${group}`;
      }
      
      // Prefill Publish fields based on image selected
      const pubTitleInput = document.getElementById('pub-title');
      const pubPriceInput = document.getElementById('pub-price');
      const pubCoordsInput = document.getElementById('pub-coords');
      
      if (activeCullKey === 'peak') {
        if (pubTitleInput) pubTitleInput.value = 'No Place Like Home';
        if (pubPriceInput) pubPriceInput.value = '1600';
        if (pubCoordsInput) pubCoordsInput.value = '40.7306° N, 73.9352° W';
      } else if (activeCullKey === 'brutalist') {
        if (pubTitleInput) pubTitleInput.value = 'Duality';
        if (pubPriceInput) pubPriceInput.value = '2200';
        if (pubCoordsInput) pubCoordsInput.value = '40.7580° N, 73.9855° W';
      } else if (activeCullKey === 'dunes') {
        if (pubTitleInput) pubTitleInput.value = 'Serenity';
        if (pubPriceInput) pubPriceInput.value = '1850';
        if (pubCoordsInput) pubCoordsInput.value = '35.015° N, 115.485° W';
      }

      applyFilters(); // Maintain adjustment profiles on focus change
    });
  });

  // 5. Culling Keyboard Hotkeys binding (Pick [P] // Reject [X] // Rating 1-5 Stars)
  document.addEventListener('keydown', (e) => {
    if (!studioActive) return;
    
    const activeCard = document.querySelector('.cull-card.active');
    if (!activeCard) return;
    
    const pickBtn = activeCard.querySelector('.pick-btn');
    const rejectBtn = activeCard.querySelector('.reject-btn');
    const badge = activeCard.querySelector('.cull-card-badge');
    
    if (e.key.toLowerCase() === 'p') {
      // Pick active image
      if (pickBtn && rejectBtn) {
        pickBtn.classList.add('active');
        rejectBtn.classList.remove('active');
      }
      if (badge) {
        badge.textContent = 'HERO TARGET';
        badge.className = 'cull-card-badge tracking-mono text-success';
      }
    } else if (e.key.toLowerCase() === 'x') {
      // Reject active image
      if (pickBtn && rejectBtn) {
        pickBtn.classList.remove('active');
        rejectBtn.classList.add('active');
      }
      if (badge) {
        badge.textContent = 'REJECTED';
        badge.className = 'cull-card-badge tracking-mono text-danger';
      }
    } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
      // Rating stars
      const starRating = activeCard.querySelector('.cull-stars');
      if (starRating) {
        const rating = Number(e.key);
        let starsStr = '';
        for (let i = 1; i <= 5; i++) {
          starsStr += i <= rating ? '★' : '☆';
        }
        starRating.textContent = starsStr;
      }
    }
  });

  // 6. AI Retouching Profile Selector
  const profiles = document.querySelectorAll('.profile-card');
  let selectedProfile = 'amber';
  
  profiles.forEach(prof => {
    prof.addEventListener('click', () => {
      profiles.forEach(p => p.classList.remove('active'));
      prof.classList.add('active');
      selectedProfile = prof.getAttribute('data-profile');
      applyFilters();
    });
  });

  // Retouch sliders adjustment
  const sliderExposure = document.getElementById('slider-exposure');
  const valExposure = document.getElementById('val-exposure');
  if (sliderExposure && valExposure) {
    sliderExposure.addEventListener('input', (e) => {
      valExposure.textContent = `${e.target.value >= 0 ? '+' : ''}${(e.target.value / 100).toFixed(2)} EV`;
      applyFilters();
    });
  }

  const sliderContrast = document.getElementById('slider-contrast');
  const valContrast = document.getElementById('val-contrast');
  if (sliderContrast && valContrast) {
    sliderContrast.addEventListener('input', (e) => {
      valContrast.textContent = `${e.target.value}%`;
      applyFilters();
    });
  }

  const sliderColorTemp = document.getElementById('slider-color-temp');
  const valColorTemp = document.getElementById('val-color-temp');
  if (sliderColorTemp && valColorTemp) {
    sliderColorTemp.addEventListener('input', (e) => {
      valColorTemp.textContent = `${e.target.value}K`;
      applyFilters();
    });
  }

  // Active filter render pipeline
  function applyFilters() {
    if (!loupeImage) return;

    let sepia = 0, saturate = 100, contrast = 100, hueRotate = 0;
    
    // Profile Preset Base Settings
    if (selectedProfile === 'amber') {
      sepia = 30;
      saturate = 140;
      hueRotate = 15;
    } else if (selectedProfile === 'mono') {
      sepia = 0;
      saturate = 0;
      contrast = 150;
    } else if (selectedProfile === 'forest') {
      sepia = 10;
      saturate = 160;
      hueRotate = 80;
    }

    // Dynamic Sliders Offset
    const exposureVal = (100 + Number(sliderExposure ? sliderExposure.value : 0) / 2).toFixed(0);
    const contrastVal = sliderContrast ? sliderContrast.value : 100;
    
    const filterString = `sepia(${sepia}%) saturate(${saturate}%) contrast(${contrastVal}%) brightness(${exposureVal}%) hue-rotate(${hueRotate}deg)`;
    
    // Apply styling to central loupe preview image
    loupeImage.style.filter = filterString;
    
    // Apply dynamic retouch preview thumbnail to the active culling card
    const activeCard = document.querySelector(`.cull-card[data-cull-key="${activeCullKey}"]`);
    if (activeCard) {
      const activeThumbnail = activeCard.querySelector('.cull-img');
      if (activeThumbnail) {
        activeThumbnail.style.filter = filterString;
      }
    }
  }

  // 7. Dynamic Direct Publisher logic
  const publishBtn = document.getElementById('publish-to-gallery-btn');
  const pubTitleInput = document.getElementById('pub-title');
  const pubPriceInput = document.getElementById('pub-price');
  const pubCoordsInput = document.getElementById('pub-coords');

  if (publishBtn) {
    publishBtn.addEventListener('click', () => {
      const title = pubTitleInput ? pubTitleInput.value : 'Ethereal Print';
      const priceVal = pubPriceInput ? pubPriceInput.value : '1800';
      const coords = pubCoordsInput ? pubCoordsInput.value : '35.0° N, 115.0° W';

      publishBtn.disabled = true;
      publishBtn.textContent = 'COMPILING METADATA...';

      setTimeout(() => {
        publishBtn.textContent = 'VERIFYING SYSTEM CRYPTO STATE...';

        setTimeout(() => {
          publishBtn.textContent = 'REGISTERING STRIPE WEBHOOK...';

          setTimeout(() => {
            publishBtn.disabled = false;
            publishBtn.textContent = 'PUBLISH TO LUMINOUS GALLERY';

            // Injection key
            const cullKey = `cull_${activeCullKey}`;

            // Map color profile details for theme consistency
            let color = '#FF7A00', colorBg = '#1B0F03', colorMuted = '#8F4900';
            if (selectedProfile === 'mono') {
              color = '#E0E0E0'; colorBg = '#141414'; colorMuted = '#666666';
            } else if (selectedProfile === 'forest') {
              color = '#2D6A4F'; colorBg = '#061A10'; colorMuted = '#1B4332';
            }

            const activeCard = document.querySelector('.cull-card.active');
            const aspect = activeCard ? Number(activeCard.getAttribute('data-aspect')) : 1.5;

            // 1. Add print to canonical state registry object
            printData[cullKey] = {
              name: title,
              index: `EXHIBIT_0${Object.keys(printData).length + 1}`,
              color: color,
              colorBg: colorBg,
              colorMuted: colorMuted,
              aspect: aspect,
              size: `36" × 24" // MOUNT: ACRYLIC`,
              sizeShort: `36" × 24" Acrylic Mount`,
              coords: coords,
              camera: `PHASE ONE IQ4 150MP`,
              optics: `BESPOKE WIDE f/2.8`,
              exposure: `f/8.0 @ 1/60s, ISO 100`,
              price: `$${Number(priceVal).toLocaleString()} USD`,
              description: `A custom fine-art print culled and post-processed autonomously by AI culling model and published directly to sovereign gallery storefront.`,
              imageSrc: activeCullKey === 'peak' ? '/prints/no_place_like_home_preview.webp' : (activeCullKey === 'brutalist' ? '/prints/duality_preview.webp' : '/prints/serenity_preview.webp')
            };

            // 2. Append new dynamic navigation element to UI sidebar list
            const selectorList = document.getElementById('print-selector-list');
            if (selectorList) {
              const li = document.createElement('li');
              li.className = 'print-item';
              li.setAttribute('data-print', cullKey);
              li.style.setProperty('--item-accent', color);
              
              li.innerHTML = `
                <button class="print-select-btn">
                  <span class="print-index tracking-mono">EXHIBIT_0${Object.keys(printData).length}</span>
                  <span class="print-name">${title}</span>
                </button>
              `;

              selectorList.appendChild(li);

              li.addEventListener('click', () => {
                switchActivePrint(cullKey);
              });
            }

            // Append new dynamic navigation element to top header nav
            const headerNav = document.getElementById('header-print-selector');
            if (headerNav) {
              const li = document.createElement('li');
              li.className = 'header-nav-item';
              li.setAttribute('data-print', cullKey);
              li.textContent = title;
              headerNav.appendChild(li);
              
              li.addEventListener('click', () => {
                switchActivePrint(cullKey);
              });
            }

            // Append new dynamic navigation element to bottom nav
            const bottomNav = document.getElementById('bottom-print-selector');
            if (bottomNav) {
              const li = document.createElement('li');
              li.className = 'bottom-nav-item';
              li.setAttribute('data-print', cullKey);
              li.textContent = `0${Object.keys(printData).length} // ${title.toUpperCase()}`;
              bottomNav.appendChild(li);
              
              li.addEventListener('click', () => {
                switchActivePrint(cullKey);
              });
            }

            // 4. Toggle view back to client gallery storefront
            studioActive = false;
            toggleStudioBtn.textContent = '[STUDIO // CULL & RETOUCH]';
            galleryGrid.style.display = 'grid';
            studioGrid.style.display = 'none';

            // 5. Select and switch to new print automatically
            const allItems = document.querySelectorAll('#print-selector-list .print-item');
            allItems.forEach(el => el.classList.remove('active'));
            
            const lastItem = allItems[allItems.length - 1];
            if (lastItem) {
              lastItem.classList.add('active');
            }
            switchActivePrint(cullKey);

            // 6. Automatically trigger secure billing modal for verification!
            setTimeout(() => {
              const openBillingBtn = document.getElementById('open-billing-btn');
              if (openBillingBtn) {
                openBillingBtn.click();
              }
            }, 800);

          }, 1000);
        }, 1000);
      }, 1000);
    });
  }
}

/* ==========================================================================
   Operator Cockpit Core Engine Logic
   ========================================================================== */
/* ==========================================================================
   Operator Cockpit Core Engine Logic
   ========================================================================== */
function initOperatorCockpit() {
  const toggleCockpitBtn = document.getElementById('toggle-cockpit-btn');
  const toggleStudioBtn = document.getElementById('toggle-studio-btn');
  const cockpitGrid = document.getElementById('cockpit-grid');
  const studioGrid = document.getElementById('studio-grid');
  const galleryGrid = document.querySelector('.gallery-grid');

  if (!toggleCockpitBtn || !cockpitGrid) return;

  let cockpitActive = false;

  // 1. Unified Navigation Toggles
  toggleCockpitBtn.addEventListener('click', () => {
    cockpitActive = !cockpitActive;
    if (cockpitActive) {
      toggleCockpitBtn.textContent = '[CLIENT GALLERY]';
      toggleCockpitBtn.style.color = 'var(--theme-accent)';
      toggleCockpitBtn.style.borderColor = 'var(--theme-accent)';
      
      // Reset studio portal state
      if (toggleStudioBtn) toggleStudioBtn.textContent = '[STUDIO // CULL & RETOUCH]';
      
      galleryGrid.style.display = 'none';
      studioGrid.style.display = 'none';
      cockpitGrid.style.display = 'grid';
    } else {
      toggleCockpitBtn.textContent = '[OP_COCKPIT // V6_CORE]';
      toggleCockpitBtn.style.color = '';
      toggleCockpitBtn.style.borderColor = 'transparent';
      
      galleryGrid.style.display = 'grid';
      cockpitGrid.style.display = 'none';
    }
  });

  if (toggleStudioBtn) {
    toggleStudioBtn.addEventListener('click', () => {
      if (cockpitActive) {
        cockpitActive = false;
        toggleCockpitBtn.textContent = '[OP_COCKPIT // V6_CORE]';
        toggleCockpitBtn.style.color = '';
        toggleCockpitBtn.style.borderColor = 'transparent';
        cockpitGrid.style.display = 'none';
      }
    });
  }

  // 2. Tab Navigation Routing Engine
  const tabBtns = document.querySelectorAll('.cockpit-tab-btn');
  const tabPanes = document.querySelectorAll('.cockpit-tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.style.borderColor = '#222';
        b.style.color = '#888';
      });
      tabPanes.forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });

      // Activate clicked
      btn.classList.add('active');
      btn.style.borderColor = 'var(--theme-accent)';
      btn.style.color = 'var(--theme-accent)';
      
      const tabTarget = btn.getAttribute('data-tab');
      const pane = document.getElementById(`pane-${tabTarget}`);
      if (pane) {
        pane.classList.add('active');
        pane.style.display = tabTarget === 'cognitive' || tabTarget === 'security' || tabTarget === 'tokenomics' || tabTarget === 'atlas' ? 'grid' : 'block';
      }
    });
  });

  /* ==========================================================================
     A. COGNITIVE CORE PANEL (IE-IDX-0368, 0351, 0359, 0372, 0367, 0366, 0355)
     ========================================================================== */
  const triggerCotBtn = document.getElementById('trigger-cot-btn');
  const cotTraceLogs = document.getElementById('cot-trace-logs');
  const triggerStroopBtn = document.getElementById('trigger-stroop-test-btn');
  const stroopGraphViewer = document.getElementById('stroop-graph-viewer');
  
  const ragQueryInput = document.getElementById('rag-query-input');
  const executeRagQueryBtn = document.getElementById('execute-rag-query-btn');
  const ragResultsLogs = document.getElementById('rag-results-logs');

  let cotStep = 0;
  const cotReasoningSteps = [
    `[GRPO_VAL] Re-evaluating rubric rewards... SFT correctness threshold: 99.1%`,
    `[COGNITIVE_RESOLVE] Context window populated with 4 distinct code snippets`,
    `[JUDGE_ATTEST] Token match: keeper/design-tokens verified successfully`,
    `[EMBED] Matching query string against memory spine vectors... Chunk match confidence: 0.94`,
    `[EXECUTION] Staged output verified. Paragon alignment complete.`
  ];

  if (triggerCotBtn) {
    triggerCotBtn.addEventListener('click', () => {
      if (cotStep < cotReasoningSteps.length) {
        cotTraceLogs.innerHTML += `<br>${cotReasoningSteps[cotStep]}`;
        cotStep++;
      } else {
        cotTraceLogs.innerHTML += `<br>[INFO] Final cognitive state reached. Re-initializing reasoning flow.`;
        cotStep = 0;
      }
      cotTraceLogs.scrollTop = cotTraceLogs.scrollHeight;
    });
  }

  if (triggerStroopBtn) {
    triggerStroopBtn.addEventListener('click', () => {
      triggerStroopBtn.disabled = true;
      stroopGraphViewer.innerHTML += `<br>[STROOP] Simulating cognitive attention test...`;
      stroopGraphViewer.scrollTop = stroopGraphViewer.scrollHeight;

      setTimeout(() => {
        stroopGraphViewer.innerHTML += `<br>[STROOP] Resolving competing attributes: "COLOR: GREEN" vs "TEXT: RED"`;
        
        setTimeout(() => {
          stroopGraphViewer.innerHTML += `<br><span style="color: #00ff66;">[CAM_SUCCESS] Executive Control Agent resolved conflict in 14ms via CAM priority override rules.</span>`;
          stroopGraphViewer.scrollTop = stroopGraphViewer.scrollHeight;
          triggerStroopBtn.disabled = false;
        }, 600);
      }, 800);
    });
  }

  if (executeRagQueryBtn) {
    executeRagQueryBtn.addEventListener('click', () => {
      const q = ragQueryInput ? ragQueryInput.value : '';
      if (!q) return;

      executeRagQueryBtn.disabled = true;
      ragResultsLogs.innerHTML = `[OMNI_DISPATCHER] Querying heterogeneous sources: PostgreSQL, SQLite, CLE Graph, Code ASTs...`;

      setTimeout(() => {
        ragResultsLogs.innerHTML = `[RAG_RESULT] Found 2 context chunks:
1. "design-tokens: var(--theme-accent) maps to serenity #FF7A00" (Source: KEEPER)
2. "docker-compose: nginx gateway mapped on ssl port 5051" (Source: INFRASTRUCTURE)`;
        executeRagQueryBtn.disabled = false;
      }, 1000);
    });
  }

  /* ==========================================================================
     B. SECURITY GRID PANEL (IE-IDX-0352, 0360, 0353)
     ========================================================================== */
  const securityPromptInput = document.getElementById('security-prompt-input');
  const validatePromptBtn = document.getElementById('validate-prompt-btn');
  const guardrailTrustScore = document.getElementById('guardrail-trust-score');
  const guardrailScanStatus = document.getElementById('guardrail-scan-status');
  const remediationLogs = document.getElementById('remediation-logs');

  const toggleFirewallBtn = document.getElementById('toggle-firewall-btn');
  const firewallStatusBadge = document.getElementById('firewall-status-badge');
  const firewallTrafficLogs = document.getElementById('firewall-traffic-logs');

  let firewallActive = true;

  if (validatePromptBtn) {
    validatePromptBtn.addEventListener('click', () => {
      const promptVal = securityPromptInput ? securityPromptInput.value.toLowerCase() : '';
      if (!promptVal) return;

      validatePromptBtn.disabled = true;
      guardrailScanStatus.textContent = 'RUNNING ADAPTIVE SCAN...';
      guardrailScanStatus.style.color = 'var(--theme-accent)';

      setTimeout(() => {
        // Detect injection keywords
        const isInjected = promptVal.includes('ignore') || promptVal.includes('override') || promptVal.includes('system') || promptVal.includes('delete') || promptVal.includes('hijack');
        
        if (isInjected) {
          guardrailTrustScore.textContent = '12%';
          guardrailTrustScore.style.color = '#ff3366';
          guardrailScanStatus.textContent = 'ALERT: INJECTION THREAT DETECTED';
          guardrailScanStatus.style.color = '#ff3366';
          
          remediationLogs.innerHTML += `<br><span style="color: #ff3366;">[ALERT] Blocked malicious input sequence. Input quarantined.</span>`;
        } else {
          guardrailTrustScore.textContent = '98%';
          guardrailTrustScore.style.color = '#00ff66';
          guardrailScanStatus.textContent = 'VERIFIED SECURE';
          guardrailScanStatus.style.color = '#00ff66';

          remediationLogs.innerHTML += `<br>[REMEDIATE] Input verified against IE-SOS validation rubrics.`;
        }
        remediationLogs.scrollTop = remediationLogs.scrollHeight;
        validatePromptBtn.disabled = false;
      }, 1000);
    });
  }

  if (toggleFirewallBtn) {
    toggleFirewallBtn.addEventListener('click', () => {
      firewallActive = !firewallActive;
      if (firewallActive) {
        firewallStatusBadge.textContent = 'SHIELD ACTIVE';
        firewallStatusBadge.className = 'text-success tracking-mono';
        firewallStatusBadge.style.color = '';
        firewallTrafficLogs.innerHTML += `<br>[A2DG] Adaptive firewall shields re-engaged on port 5050/5051.`;
      } else {
        firewallStatusBadge.textContent = 'SHIELD BYPASS';
        firewallStatusBadge.className = 'tracking-mono';
        firewallStatusBadge.style.color = '#ff3366';
        firewallTrafficLogs.innerHTML += `<br><span style="color: #ff3366;">[WARNING] Port 5051 firewall disabled. Unencrypted endpoints exposed.</span>`;
      }
      firewallTrafficLogs.scrollTop = firewallTrafficLogs.scrollHeight;
    });
  }

  // Periodic network packet sniffer simulator
  setInterval(() => {
    if (!cockpitActive || !firewallActive || !firewallTrafficLogs) return;
    const packetEvents = [
      `[A2DG_MONITOR] Checked API header handshake: Port 5050 (MCP JSON-RPC)`,
      `[A2DG_MONITOR] client iphone15-promax: Verified certificate expiration (340 days remaining)`,
      `[A2DG_MONITOR] Attestation status checked: Parity verified`,
      `[A2DG_MONITOR] Blocked port scan from unauthorized external host IP 192.168.2.99`
    ];
    const randEvent = packetEvents[Math.floor(Math.random() * packetEvents.length)];
    const timeStr = new Date().toLocaleTimeString();
    firewallTrafficLogs.innerHTML += `<br>[${timeStr}] ${randEvent}`;
    firewallTrafficLogs.scrollTop = firewallTrafficLogs.scrollHeight;
  }, 8000);

  /* ==========================================================================
     C. TOKENOMICS & MODEL RUNTIMES (IE-IDX-0348, 0346, 0349, 0347, 0357, 0358, 0370, 0374, 0364, 0373)
     ========================================================================== */
  const optimizeCostBtn = document.getElementById('optimize-cost-btn');
  const tokenomicsBill = document.getElementById('tokenomics-bill');
  const tokenomicsSaved = document.getElementById('tokenomics-saved');

  const modelGallerySelect = document.getElementById('model-gallery-select');
  const registerModelBtn = document.getElementById('register-model-btn');
  const testMcpBtn = document.getElementById('test-mcp-btn');
  const modelRuntimeLogs = document.getElementById('model-runtime-logs');

  const runMellum2Btn = document.getElementById('run-mellum2-btn');
  const checkPqcBtn = document.getElementById('check-pqc-encryption-btn');
  const synthesisEngineLogs = document.getElementById('synthesis-engine-logs');

  // ESP32 Flasher references mapped inside this pane
  const firmwareSelect = document.getElementById('firmware-select');
  const connectSerialBtn = document.getElementById('connect-serial-btn');
  const flashDeviceBtn = document.getElementById('flash-device-btn');
  const deviceStateEl = document.getElementById('flasher-device-state');
  const progressBar = document.getElementById('flasher-progress-bar');
  const terminalLogs = document.getElementById('flasher-terminal-logs');

  let serialPortConnected = false;

  if (connectSerialBtn) {
    connectSerialBtn.addEventListener('click', async () => {
      if (serialPortConnected) {
        serialPortConnected = false;
        connectSerialBtn.textContent = 'CONNECT PORT';
        if (flashDeviceBtn) flashDeviceBtn.disabled = true;
        if (deviceStateEl) {
          deviceStateEl.textContent = 'NOT CONNECTED';
          deviceStateEl.style.color = '#ff3366';
        }
        if (terminalLogs) {
          terminalLogs.innerHTML += `<br>[SYSTEM] Web Serial disconnected.`;
          terminalLogs.scrollTop = terminalLogs.scrollHeight;
        }
        return;
      }

      if (terminalLogs) {
        terminalLogs.innerHTML += `<br>[SYSTEM] Scanning for physical COM devices...`;
      }
      
      if (navigator.serial) {
        try {
          if (terminalLogs) terminalLogs.innerHTML += `<br>[SYSTEM] Requesting Serial port access...`;
          await navigator.serial.requestPort();
        } catch (err) {
          if (terminalLogs) terminalLogs.innerHTML += `<br>[WARNING] Hardware Serial picker cancelled: ${err.message}`;
        }
      } else {
        if (terminalLogs) terminalLogs.innerHTML += `<br>[INFO] Web Serial API fallback active. COM3 simulation boot...`;
      }

      setTimeout(() => {
        serialPortConnected = true;
        connectSerialBtn.textContent = 'DISCONNECT';
        if (flashDeviceBtn) flashDeviceBtn.disabled = false;
        if (deviceStateEl) {
          deviceStateEl.textContent = 'CONNECTED (ESP32-S3 V6)';
          deviceStateEl.style.color = '#2D6A4F';
        }
        if (terminalLogs) {
          terminalLogs.innerHTML += `<br><span style="color: #00ff66;">[SUCCESS] ESP32 device established on COM3 (Baud Rate: 921600). CPU: Xtensa Dual-Core. Ready to flash.</span>`;
          terminalLogs.scrollTop = terminalLogs.scrollHeight;
        }
      }, 600);
    });
  }

  if (flashDeviceBtn) {
    flashDeviceBtn.addEventListener('click', () => {
      const selectedFirmware = firmwareSelect ? firmwareSelect.value : 'firmware';
      flashDeviceBtn.disabled = true;
      connectSerialBtn.disabled = true;
      
      if (terminalLogs) {
        terminalLogs.innerHTML = `--- Flashing active: ${selectedFirmware}.bin ---`;
        terminalLogs.innerHTML += `<br>[ESPTOOL] Connecting to Target ESP32 chip...`;
        terminalLogs.innerHTML += `<br>[ESPTOOL] Chip revision: ESP32-S3 (v0.2)`;
        terminalLogs.innerHTML += `<br>[ESPTOOL] Mac: 7c:df:a1:0b:3e:90`;
      }

      let progress = 0;
      if (progressBar) progressBar.style.width = '0%';

      const flashInterval = setInterval(() => {
        progress += 20;
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (terminalLogs) {
          terminalLogs.innerHTML += `<br>[FLASH] Writing sector at 0x000${(progress * 4096).toString(16).toUpperCase()}... (${progress}%)`;
          terminalLogs.scrollTop = terminalLogs.scrollHeight;
        }

        if (progress >= 100) {
          clearInterval(flashInterval);
          setTimeout(() => {
            if (terminalLogs) {
              terminalLogs.innerHTML += `<br>[VERIFY] Running cryptographically signed SHA-256 hash checks...`;
              
              setTimeout(() => {
                terminalLogs.innerHTML += `<br><span style="color: #00ff66;">[VERIFY] Integrity check passed. Firmware signature is valid (VERA Certified).</span>`;
                terminalLogs.innerHTML += `<br>[BOOT] Hard resetting via RTS pin...`;
                terminalLogs.innerHTML += `<br>[BOOT] ESP32 boot successful. Spatial mesh active on Port 5051.`;
                terminalLogs.scrollTop = terminalLogs.scrollHeight;
              }, 600);
            }
            flashDeviceBtn.disabled = false;
            connectSerialBtn.disabled = false;
          }, 400);
        }
      }, 250);
    });
  }

  if (optimizeCostBtn) {
    optimizeCostBtn.addEventListener('click', () => {
      optimizeCostBtn.disabled = true;
      optimizeCostBtn.textContent = 'RUNNING COST BENCHMARKS...';

      setTimeout(() => {
        tokenomicsBill.textContent = '$962.15 (EST)';
        tokenomicsSaved.textContent = '$755.07 (44.0%)';
        
        optimizeCostBtn.disabled = false;
        optimizeCostBtn.textContent = 'EXECUTE AUTONOMOUS OPTIMIZER';
        
        mtlsLogs.innerHTML += `<br>[TOKENOMICS] Optimized agent model routing configuration. Diverting simple lookups from GPT-5 to local ONNX cache.`;
        mtlsLogs.scrollTop = mtlsLogs.scrollHeight;
      }, 1000);
    });
  }

  if (registerModelBtn) {
    registerModelBtn.addEventListener('click', () => {
      const mod = modelGallerySelect.value;
      modelRuntimeLogs.innerHTML += `<br>[REGISTRY] Registering model parameters on local execution cluster: ${mod}...`;
      
      setTimeout(() => {
        modelRuntimeLogs.innerHTML += `<br><span style="color: #00ff66;">[SUCCESS] Model registered. Verified ONNX tensor shapes. Model Fabric ready.</span>`;
        modelRuntimeLogs.scrollTop = modelRuntimeLogs.scrollHeight;
      }, 800);
    });
  }

  if (testMcpBtn) {
    testMcpBtn.addEventListener('click', () => {
      modelRuntimeLogs.innerHTML += `<br>[MCP] Testing native context files bridge...`;
      
      setTimeout(() => {
        modelRuntimeLogs.innerHTML += `<br><span style="color: #00ff66;">[SUCCESS] MCP verification success. Found 3 connected local tools. Zero dependencies.</span>`;
        modelRuntimeLogs.scrollTop = modelRuntimeLogs.scrollHeight;
      }, 600);
    });
  }

  if (runMellum2Btn) {
    runMellum2Btn.addEventListener('click', () => {
      runMellum2Btn.disabled = true;
      synthesisEngineLogs.innerHTML = `[MELLUM2] Instantiating Mellum2 local code model execution...`;

      setTimeout(() => {
        synthesisEngineLogs.innerHTML = `[MELLUM2] Completed benchmark:
   ↳ Synthesis speed: 124 tokens/sec
   ↳ Context tokens consumed: 12k
   ↳ Compilation correctness check: 100% PASS`;
        runMellum2Btn.disabled = false;
      }, 1000);
    });
  }

  if (checkPqcBtn) {
    checkPqcBtn.addEventListener('click', () => {
      checkPqcBtn.disabled = true;
      synthesisEngineLogs.innerHTML += `<br>[PQ3] Verifying Post-Quantum Cryptography keys & formal correctness...`;

      setTimeout(() => {
        synthesisEngineLogs.innerHTML += `<br><span style="color: #00ff66;">[PQ3] PQ3 Keys Verified. Formal proof check passed. Security posture SECURE.</span>`;
        synthesisEngineLogs.scrollTop = synthesisEngineLogs.scrollHeight;
        checkPqcBtn.disabled = false;
      }, 800);
    });
  }

  /* ==========================================================================
     D. ATLAS & DESIGN PANEL (IE-IDX-0371, 0354, 0361, 0363, 0362, 0356, 0369, 0375)
     ========================================================================== */
  const generateDiagramBtn = document.getElementById('generate-diagram-btn');
  const systemDesignGraph = document.getElementById('system-design-graph');
  const atlasCoordinatesTag = document.getElementById('atlas-coordinates-tag');
  
  const sliderCreativeVariance = document.getElementById('slider-creative-variance');
  const valCreativeVariance = document.getElementById('val-creative-variance');
  const sliderVibeMatch = document.getElementById('slider-vibe-match');
  const valVibeMatch = document.getElementById('val-vibe-match');
  const previewBtnNodeV6 = document.getElementById('preview-button-node-v6');

  if (generateDiagramBtn) {
    generateDiagramBtn.addEventListener('click', () => {
      generateDiagramBtn.disabled = true;
      systemDesignGraph.innerHTML = `[SYSTEM_DESIGN] Parsing system nodes...`;

      setTimeout(() => {
        systemDesignGraph.innerHTML = `--- CLE V6 Generative System Architecture ---
[USER] ──(HTTPS)──&gt; [Luminous Gallery Storefront: Port 80]
[OP] ──(Web Serial)──&gt; [COM3 Flasher Node]
[OP_ATTEST] ──(mTLS CERT)──&gt; [Nginx Security Shield: Port 5051]
[AGENT_FABRIC] ──(ONNX API)──&gt; [Local Model Registry: Gemma-4-12B]
[RECONCILER] ──(sync-session.ps1)──&gt; [Synology Storage Vault]`;
        generateDiagramBtn.disabled = false;
      }, 1000);
    });
  }

  // Bind coordinate switching to print selector click
  const printItems = document.querySelectorAll('#print-selector-list .print-item');
  printItems.forEach(item => {
    item.addEventListener('click', () => {
      const key = item.getAttribute('data-print');
      const data = printData[key];
      if (data && atlasCoordinatesTag) {
        atlasCoordinatesTag.textContent = data.coords;
      }
    });
  });

  if (sliderCreativeVariance && valCreativeVariance) {
    sliderCreativeVariance.addEventListener('input', (e) => {
      const val = e.target.value;
      valCreativeVariance.textContent = `${val}%`;
      
      // Affect visual variance offset of button design
      if (previewBtnNodeV6) {
        previewBtnNodeV6.style.letterSpacing = `${val / 10}px`;
      }
    });
  }

  if (sliderVibeMatch && valVibeMatch) {
    sliderVibeMatch.addEventListener('input', (e) => {
      const val = e.target.value;
      const labels = ['LOW', 'MEDIUM', 'HIGH'];
      valVibeMatch.textContent = labels[val - 1];

      if (previewBtnNodeV6) {
        if (val === '1') {
          previewBtnNodeV6.style.fontStyle = 'italic';
          previewBtnNodeV6.style.fontWeight = 'lighter';
        } else if (val === '2') {
          previewBtnNodeV6.style.fontStyle = 'normal';
          previewBtnNodeV6.style.fontWeight = 'normal';
        } else {
          previewBtnNodeV6.style.fontStyle = 'normal';
          previewBtnNodeV6.style.fontWeight = 'bold';
        }
      }
    });
  }

  /* ==========================================================================
     IAM, Handshake, Reconciler, Reconcile Docker from Cockpit sidebars
     ========================================================================== */
  const clientIdentitySelect = document.getElementById('client-identity-select');
  const triggerMtlsBtn = document.getElementById('trigger-mtls-shake-btn');
  const mtlsLogs = document.getElementById('mtls-attestations-logs');
  
  const permKeeperCache = document.getElementById('perm-keeper-cache');
  const permBoltCache = document.getElementById('perm-bolt-cache');
  const permKeeperCert = document.getElementById('perm-keeper-cert');
  const permBoltCert = document.getElementById('perm-bolt-cert');
  const permKeeperFigma = document.getElementById('perm-keeper-figma');
  const permBoltFigma = document.getElementById('perm-bolt-figma');
  const permKeeperExec = document.getElementById('perm-keeper-exec');
  const permBoltExec = document.getElementById('perm-bolt-exec');

  function logPermissionChange(agent, permName, value) {
    if (mtlsLogs) {
      mtlsLogs.innerHTML += `<br>[IAM] ABAC Policy changed: ${agent} ${permName} is now ${value ? '<span style="color: #00ff66;">ALLOWED</span>' : '<span style="color: #ff3366;">DENIED</span>'}`;
      mtlsLogs.scrollTop = mtlsLogs.scrollHeight;
    }
  }

  [permKeeperCache, permBoltCache, permKeeperCert, permBoltCert, permKeeperFigma, permBoltFigma, permKeeperExec, permBoltExec].forEach(checkbox => {
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        const idParts = checkbox.id.split('-');
        const agent = idParts[1].toUpperCase();
        const perm = idParts[2].toUpperCase();
        logPermissionChange(agent, perm, checkbox.checked);
      });
    }
  });

  if (triggerMtlsBtn) {
    triggerMtlsBtn.addEventListener('click', () => {
      const selectedClient = clientIdentitySelect ? clientIdentitySelect.value : 'iphone15';
      triggerMtlsBtn.disabled = true;
      
      if (mtlsLogs) mtlsLogs.innerHTML += `<br>[GATEWAY] Requesting mTLS client certificate validation...`;
      
      setTimeout(() => {
        if (selectedClient === 'unauthorized-client') {
          if (mtlsLogs) mtlsLogs.innerHTML += `<br><span style="color: #ff3366;">[ALERT] 403 FORBIDDEN. Client certificate signature verification failed! IP block triggered on port 5051. No access granted.</span>`;
        } else {
          const certName = selectedClient === 'iphone15' ? 'iphone15-promax.p12' : 'iphone17-promax.p12';
          if (mtlsLogs) mtlsLogs.innerHTML += `<br>[GATEWAY] Handshaking via pinned key: ${certName}`;
          
          setTimeout(() => {
            if (mtlsLogs) mtlsLogs.innerHTML += `<br><span style="color: #00ff66;">[SUCCESS] client verification success. CN=jaharoni-mobile, Issuer=Genesis Root CA. Granting MCP authorization token.</span>`;
          }, 600);
        }
        if (mtlsLogs) mtlsLogs.scrollTop = mtlsLogs.scrollHeight;
        triggerMtlsBtn.disabled = false;
      }, 800);
    });
  }

  const triggerSyncBtn = document.getElementById('trigger-sync-btn');
  const reconcileDockerBtn = document.getElementById('reconcile-docker-btn');
  const selfHealingLogs = document.getElementById('self-healing-logs');
  
  const dockerStatus = document.getElementById('docker-status');
  const dbStatus = document.getElementById('db-status');
  const syncStatus = document.getElementById('sync-status');
  const sseStatus = document.getElementById('sse-status');

  if (triggerSyncBtn) {
    triggerSyncBtn.addEventListener('click', () => {
      triggerSyncBtn.disabled = true;
      triggerSyncBtn.textContent = 'RUNNING sync-session.ps1...';
      if (selfHealingLogs) {
        selfHealingLogs.innerHTML += `<br>[PS1] Executing scripts/sync-session.ps1 -ConversationId "333dc776-8ca3-43dd-88f7-49e269187fca" -WorkspaceRoot "y:\\creative-liberation-engine"`;
        selfHealingLogs.scrollTop = selfHealingLogs.scrollHeight;
      }

      setTimeout(() => {
        if (selfHealingLogs) selfHealingLogs.innerHTML += `<br>[PS1] Extracted workspace roots. Extracted globalState configs successfully.`;
        
        setTimeout(() => {
          if (selfHealingLogs) {
            selfHealingLogs.innerHTML += `<br><span style="color: #00ff66;">[PS1] Sync completed. Session snapshots securely uploaded to NAS /runtime/session/antigravity-state.json</span>`;
            selfHealingLogs.scrollTop = selfHealingLogs.scrollHeight;
          }
          triggerSyncBtn.disabled = false;
          triggerSyncBtn.textContent = 'EXECUTE SESSION SYNC';
          
          if (syncStatus) {
            syncStatus.textContent = 'STABLE // RESYNCED';
            syncStatus.className = 'telemetry-val text-success';
          }
        }, 1000);

      }, 800);
    });
  }

  if (reconcileDockerBtn) {
    reconcileDockerBtn.addEventListener('click', () => {
      reconcileDockerBtn.disabled = true;
      reconcileDockerBtn.textContent = 'RECONCILING...';
      if (selfHealingLogs) {
        selfHealingLogs.innerHTML += `<br>[MONITOR] Beginning platform deep health check...`;
      }
      
      setTimeout(() => {
        if (selfHealingLogs) {
          selfHealingLogs.innerHTML += `<br>[HEALTH] SQLite drive response time: 0.9ms (OK)`;
          selfHealingLogs.innerHTML += `<br>[HEALTH] Nginx ssl_client_verify rule configuration (OK)`;
          selfHealingLogs.innerHTML += `<br>[HEALTH] MCP Dispatch SSE server live on port 5050 (OK)`;
        }
        
        setTimeout(() => {
          if (selfHealingLogs) {
            selfHealingLogs.innerHTML += `<br><span style="color: #00ff66;">[HEALTH] System in absolute parity. Zero warnings staged. Self-healing state secure.</span>`;
            selfHealingLogs.scrollTop = selfHealingLogs.scrollHeight;
          }
          reconcileDockerBtn.disabled = false;
          reconcileDockerBtn.textContent = 'RECONCILE PLATFORM STATE';
          
          if (dockerStatus) dockerStatus.className = 'telemetry-val text-success';
          if (dbStatus) dbStatus.className = 'telemetry-val text-success';
          if (sseStatus) sseStatus.className = 'telemetry-val text-success';
        }, 1000);

      }, 800);
    });
  }
}
