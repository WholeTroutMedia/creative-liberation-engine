// ═══════════════════════════════════════════════════════════════
// Sovereign AutoMesh — 3D Vector Wireframe Projection HUD
// True 3D Orbital Navigation, Canvas Projection Engine & Venza Spec Explorer
// ═══════════════════════════════════════════════════════════════

import { fetchLiveTelemetry } from '../lib/api.js';

export class VehicleSchematic {
  constructor(container) {
    this.container = container;
    this.telemetry = null;
    this.isLoading = true;
    this.activeLayer = 'chassis'; // 'chassis' | 'powertrain' | 'electrical' | 'safety'
    
    // Orbital 3D Camera State
    this.yaw = -Math.PI / 4;       // Rotation around Y-axis (Yaw)
    this.pitch = -Math.PI / 6;     // Rotation around X-axis (Pitch)
    this.zoom = 1.3;               // Camera Zoom scale
    this.panX = 0;                 // Screen offset X
    this.panY = 0;                 // Screen offset Y
    
    // Target Easing States (Spring Physics Interpolation)
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.targetZoom = this.zoom;
    this.targetPanX = this.panX;
    this.targetPanY = this.panY;
    
    // Interactive mouse state
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    
    this.selectedHotspot = null;
    this.predictions = null;
    this.vin = 'JTEAAAAH9PJ121928';
    this.searchQuery = '';
    
    // Alarm simulator
    this.isSimulatingLeak = false;
    this.simulatedFLTirePsi = 35.0;
    this.leakIntervalId = null;
    
    this.animationFrameId = null;
    this.animTime = 0;
    this.energyParticles = [];
    
    // Define 3D wireframe nodes of the Toyota Venza relative to center [0,0,0]
    // Axis: X = Width (Left/Right), Y = Height (Up/Down), Z = Length (Front/Back)
    this.vertices = {
      // Chassis & floor pan
      front_bumper_left: { x: -20, y: 15, z: -90 },
      front_bumper_right: { x: 20, y: 15, z: -90 },
      front_bumper_center: { x: 0, y: 12, z: -95 },
      front_axle_left: { x: -23, y: 15, z: -60 },
      front_axle_right: { x: 23, y: 15, z: -60 },
      side_skirt_l1: { x: -23, y: 16, z: -30 },
      side_skirt_r1: { x: 23, y: 16, z: -30 },
      side_skirt_l2: { x: -23, y: 16, z: 30 },
      side_skirt_r2: { x: 23, y: 16, z: 30 },
      rear_axle_left: { x: -23, y: 15, z: 60 },
      rear_axle_right: { x: 23, y: 15, z: 60 },
      rear_bumper_left: { x: -20, y: 15, z: 90 },
      rear_bumper_right: { x: 20, y: 15, z: 90 },
      rear_bumper_center: { x: 0, y: 12, z: 95 },
      
      // Contoured body hood & windshield
      grille_center: { x: 0, y: 4, z: -95 },
      hood_edge_l: { x: -18, y: -2, z: -80 },
      hood_edge_r: { x: 18, y: -2, z: -80 },
      hood_cowl_left: { x: -20, y: -8, z: -45 },
      hood_cowl_right: { x: 20, y: -8, z: -45 },
      windshield_bottom_center: { x: 0, y: -10, z: -48 },
      
      // Pillars and roofline
      windshield_top_left: { x: -17, y: -26, z: -20 },
      windshield_top_right: { x: 17, y: -26, z: -20 },
      roof_front_center: { x: 0, y: -27, z: -20 },
      bpillar_top_left: { x: -17, y: -26, z: 15 },
      bpillar_top_right: { x: 17, y: -26, z: 15 },
      roof_rear_center: { x: 0, y: -25, z: 45 },
      roof_spoiler_left: { x: -15, y: -20, z: 76 },
      roof_spoiler_right: { x: 15, y: -20, z: 76 },
      spoiler_center: { x: 0, y: -21, z: 78 },
      trunk_deck: { x: 0, y: 2, z: 93 },
    };

    // Edge map to trace the sleek geometric wireframe structure of the Venza
    this.edges = [
      // Floor chassis frame outer ring
      { a: 'front_bumper_left', b: 'front_bumper_right' },
      { a: 'front_bumper_left', b: 'front_axle_left' },
      { a: 'front_bumper_right', b: 'front_axle_right' },
      { a: 'front_axle_left', b: 'side_skirt_l1' },
      { a: 'side_skirt_l1', b: 'side_skirt_l2' },
      { a: 'side_skirt_l2', b: 'rear_axle_left' },
      { a: 'front_axle_right', b: 'side_skirt_r1' },
      { a: 'side_skirt_r1', b: 'side_skirt_r2' },
      { a: 'side_skirt_r2', b: 'rear_axle_right' },
      { a: 'rear_axle_left', b: 'rear_bumper_left' },
      { a: 'rear_axle_right', b: 'rear_bumper_right' },
      { a: 'rear_bumper_left', b: 'rear_bumper_right' },
      
      // Nose and hood structure
      { a: 'front_bumper_center', b: 'grille_center' },
      { a: 'front_bumper_left', b: 'hood_edge_l' },
      { a: 'front_bumper_right', b: 'hood_edge_r' },
      { a: 'grille_center', b: 'hood_edge_l' },
      { a: 'grille_center', b: 'hood_edge_r' },
      { a: 'hood_edge_l', b: 'hood_cowl_left' },
      { a: 'hood_edge_r', b: 'hood_cowl_right' },
      { a: 'hood_cowl_left', b: 'windshield_bottom_center' },
      { a: 'hood_cowl_right', b: 'windshield_bottom_center' },
      
      // Windshield & A-pillars
      { a: 'hood_cowl_left', b: 'windshield_top_left' },
      { a: 'hood_cowl_right', b: 'windshield_top_right' },
      { a: 'windshield_bottom_center', b: 'roof_front_center' },
      { a: 'windshield_top_left', b: 'roof_front_center' },
      { a: 'windshield_top_right', b: 'roof_front_center' },
      { a: 'windshield_top_left', b: 'windshield_top_right' },
      
      // Glass arches and roof pillars
      { a: 'windshield_top_left', b: 'bpillar_top_left' },
      { a: 'windshield_top_right', b: 'bpillar_top_right' },
      { a: 'bpillar_top_left', b: 'roof_spoiler_left' },
      { a: 'bpillar_top_right', b: 'roof_spoiler_right' },
      { a: 'roof_front_center', b: 'roof_rear_center' },
      { a: 'roof_rear_center', b: 'spoiler_center' },
      { a: 'bpillar_top_left', b: 'roof_rear_center' },
      { a: 'bpillar_top_right', b: 'roof_rear_center' },
      { a: 'roof_spoiler_left', b: 'spoiler_center' },
      { a: 'roof_spoiler_right', b: 'spoiler_center' },
      
      // Trunk line and fastback rear hatch
      { a: 'spoiler_center', b: 'trunk_deck' },
      { a: 'roof_spoiler_left', b: 'rear_bumper_left' },
      { a: 'roof_spoiler_right', b: 'rear_bumper_right' },
      { a: 'trunk_deck', b: 'rear_bumper_left' },
      { a: 'trunk_deck', b: 'rear_bumper_right' },
    ];

    // Component coordinates mapped in true 3D spatial dimensions
    this.hotspots3D = {
      engine: { title: 'Engine Unit', x: 0, y: 5, z: -60, r: 24, cam: { yaw: -0.3, pitch: -0.4, zoom: 2.1 } },
      hybrid_battery: { title: 'HV Battery Stack', x: 0, y: 12, z: 25, r: 22, cam: { yaw: -0.7, pitch: -0.5, zoom: 2.1 } },
      awd_motor: { title: 'Rear e-AWD Motor', x: 0, y: 12, z: 60, r: 20, cam: { yaw: 2.5, pitch: -0.3, zoom: 2.2 } },
      front_radar: { title: 'TSS Front Radar', x: 0, y: 0, z: -96, r: 18, cam: { yaw: 0.1, pitch: -0.15, zoom: 2.4 } },
      wifi_antenna: { title: 'DCM Wi-Fi Antenna', x: 0, y: -22, z: 76, r: 18, cam: { yaw: 2.8, pitch: -0.6, zoom: 2.3 } },
      tires_fl: { title: 'Tires & TPMS Assembly', x: -25, y: 15, z: -60, r: 16, cam: { yaw: -0.9, pitch: -0.3, zoom: 2.2 } },
      tires_fr: { title: 'Tires & TPMS Assembly', x: 25, y: 15, z: -60, r: 16, cam: { yaw: 0.9, pitch: -0.3, zoom: 2.2 } },
      tires_rl: { title: 'Tires & TPMS Assembly', x: -25, y: 15, z: 60, r: 16, cam: { yaw: -2.3, pitch: -0.3, zoom: 2.2 } },
      tires_rr: { title: 'Tires & TPMS Assembly', x: 25, y: 15, z: 60, r: 16, cam: { yaw: 2.3, pitch: -0.3, zoom: 2.2 } }
    };
  }

  async init() {
    this.isLoading = true;
    this.render();
    await Promise.all([
      this.loadTelemetry(),
      this.loadPredictions()
    ]);
    this.isLoading = false;
    
    const fl = this.telemetry?.telemetry?.tire_pressure_psi?.front_left || 35.0;
    this.simulatedFLTirePsi = fl;
    
    this.render();
    this.start3DEngineLoop();
  }

  async loadTelemetry() {
    try {
      this.telemetry = await fetchLiveTelemetry();
    } catch (err) {
      console.error('[AutoMesh VehicleSchematic] Failed to load telemetry:', err);
    }
  }

  async loadPredictions() {
    try {
      const res = await fetch('/api/analytics/predictive-maintenance');
      this.predictions = await res.json();
    } catch (err) {
      console.error('[AutoMesh VehicleSchematic] Failed to load predictions:', err);
    }
  }

  selectLayer(layerId) {
    this.activeLayer = layerId;
    this.selectedHotspot = null;
    this.resetCamera();
  }

  selectHotspot(hotspotId) {
    // Map wheels to a single hotspot catalog key 'tires'
    let targetKey = hotspotId;
    if (hotspotId.startsWith('tires_')) {
      this.selectedHotspot = 'tires';
    } else {
      this.selectedHotspot = hotspotId;
    }
    
    const node = this.hotspots3D[hotspotId];
    if (node && node.cam) {
      this.targetYaw = node.cam.yaw;
      this.targetPitch = node.cam.pitch;
      this.targetZoom = node.cam.zoom;
      this.targetPanX = 0;
      this.targetPanY = 0;
    }
    this.render();
  }

  resetCamera() {
    this.selectedHotspot = null;
    this.targetYaw = -Math.PI / 4;
    this.targetPitch = -Math.PI / 6;
    this.targetZoom = 1.3;
    this.targetPanX = 0;
    this.targetPanY = 0;
    this.render();
  }

  setPerspectivePreset(preset) {
    this.selectedHotspot = null;
    this.targetPanX = 0;
    this.targetPanY = 0;

    if (preset === 'isometric') {
      this.targetYaw = -Math.PI / 4;
      this.targetPitch = -Math.PI / 6;
      this.targetZoom = 1.3;
    } else if (preset === 'topdown') {
      this.targetYaw = 0;
      this.targetPitch = -Math.PI / 2.05; // avoid gimbal lock overlap
      this.targetZoom = 1.6;
    } else if (preset === 'side') {
      this.targetYaw = Math.PI / 2;
      this.targetPitch = 0;
      this.targetZoom = 1.5;
    } else if (preset === 'frontal') {
      this.targetYaw = 0;
      this.targetPitch = -0.05;
      this.targetZoom = 1.8;
    }
    this.render();
  }

  getManualSpecs(hotspotId) {
    const specs = {
      engine: {
        id: 'engine',
        title: "2.5L 4-Cylinder Dynamic Force Engine",
        category: "Powertrain",
        location: "Front Engine Compartment",
        code: "Toyota A25A-FXS",
        fluidType: "Toyota Genuine Motor Oil SAE 0W-16",
        capacity: "4.8 Quarts (4.5 Liters) with filter",
        torque: "Oil drain plug: 30 lbf·ft | Filter housing cap: 18 lbf·ft",
        notes: "Extreme-efficiency Atkinson cycle with 41% thermal efficiency. Multi-hole direct injectors, electric water pump, and variable cooling flow. Drain & flush every 10,000 miles.",
        warnings: "Never overfill oil sump. Tighten drain plug exactly to OEM torque using a calibrated tool to prevent leakage."
      },
      hybrid_battery: {
        id: 'hybrid_battery',
        title: "High-Voltage Lithium-Ion Traction Battery",
        category: "HV System",
        location: "Under Passenger Rear Seats",
        code: "252.0 V Nominal | 70 Cells stacked in series",
        fluidType: "HV Forced Cabin Air Cooling System",
        capacity: "Nominal Capacity: 3.7 Ah | Energy: 0.9 kWh",
        torque: "Cooling Fan Mount Bolt: 74 lbf·in (8.4 N·m)",
        notes: "Primary electrical fuel supply for the dual front/rear AWD motors. The ventilation air intake grate is placed at the right of the rear passenger seats. Keep filters clear of blockages.",
        warnings: "High voltage orange conduits are insulated. Never slice or tamper. Vacuum internal cooling fan duct mesh filters every 15,000 miles."
      },
      tires: {
        id: 'tires',
        title: "Tires & TPMS Assembly",
        category: "Chassis",
        location: "All Four Corners",
        code: "225/55R19 99V (Toyota XLE/Limited spec)",
        fluidType: "Cold Inflation Target: 35.0 PSI Cold",
        capacity: "Lug Pattern: 5x114.3 | Thread: M12 x 1.5",
        torque: "Lug Nut Torque: 76 lbf·ft (103 N·m) dry",
        notes: "Direct TPMS radio transmitters bound internally to wheels. Ensure regular tire rotation every 5,000 miles to equalize AWD tread wear and prevent mechanical differential heat build-up.",
        warnings: "Pressure deltas exceeding ±4 PSI trigger active dash DTC warnings. Low tires raise synthetic rolling drag and drop hybrid metrics."
      },
      front_radar: {
        id: 'front_radar',
        title: "Toyota Safety Sense TSS Millimeter-Wave Radar",
        category: "ADAS Safety",
        location: "Grille Logo Emblem",
        code: "TSS 2.5+ Integrated Controller",
        fluidType: "Solid State Sensor Alignment",
        capacity: "76-77 GHz Millimeter Wave Sweeps",
        torque: "Sensor Bracket Mount: 12 lbf·in",
        notes: "Primary ADAS sensor that monitors obstacles, maps lane markings, and triggers PCS warning alerts. Works closely with camera array.",
        warnings: "Keep front emblem polished and free of mud, snow, or metal foil sheets. Radar recalibration required if bumper is hit or replaced."
      },
      awd_motor: {
        id: 'awd_motor',
        title: "Rear Electric AWD Drive Unit",
        category: "Powertrain",
        location: "Rear Axle Subframe",
        code: "Toyota MGR (Motor Generator Rear)",
        fluidType: "Toyota Genuine ATF WS Fluid",
        capacity: "Rear Drive Lubrication: 1.6 Quarts (1.5 Liters)",
        torque: "Drain Plug: 29 lbf·ft | Fill Plug: 29 lbf·ft",
        notes: "Instant-active rear axle supplying independent rear torque up to 54 HP (40 kW) and 89 lb-ft. Disengages at cruising speeds to optimize fuel consumption.",
        warnings: "Rear WS fluid check is scheduled at 60k intervals. Do not mix standard gear oils into rear differential housing."
      },
      wifi_antenna: {
        id: 'wifi_antenna',
        title: "DCM spoiler Connected Telematics spoiler Module",
        category: "Cabin Connect",
        location: "Roof Spoiler Assembly",
        code: "Data Communication Module (DCM) v4.2",
        fluidType: "Sharkfin Cellular, GPS & Wi-Fi Tri-Band Antenna",
        capacity: "12V Primary Bus backup battery",
        torque: "Mounting Bracket Nut: 7.0 N·m",
        notes: "Autonomous transceiver syncing odometer logs, trip paths, and diagnostic state metrics with localized home Wi-Fi when parked.",
        warnings: "Low Wi-Fi signal status prevents real-time data integration. Keep spoiler panels clear of metal plates."
      }
    };
    return specs[hotspotId] || null;
  }

  getAllComponentSpecs() {
    return [
      this.getManualSpecs('engine'),
      this.getManualSpecs('hybrid_battery'),
      this.getManualSpecs('tires'),
      this.getManualSpecs('front_radar'),
      this.getManualSpecs('awd_motor'),
      this.getManualSpecs('wifi_antenna')
    ];
  }

  toggleTirePressureLeakSim() {
    if (this.isSimulatingLeak) {
      this.isSimulatingLeak = false;
      clearInterval(this.leakIntervalId);
      this.simulatedFLTirePsi = 35.0;
      this.render();
      this.triggerToast("Simulation Stopped", "Tire pressure restored to nominal 35.0 PSI.", "success");
    } else {
      this.isSimulatingLeak = true;
      this.selectLayer('chassis');
      this.selectHotspot('tires_fl');
      this.triggerToast("Slow Leak Initiated", "Simulating severe front-left wheel puncture. Cameras tracking.", "danger");
      
      this.leakIntervalId = setInterval(() => {
        if (this.simulatedFLTirePsi > 23.5) {
          this.simulatedFLTirePsi -= 0.5;
          if (this.telemetry && this.telemetry.telemetry) {
            if (!this.telemetry.telemetry.tire_pressure_psi) this.telemetry.telemetry.tire_pressure_psi = {};
            this.telemetry.telemetry.tire_pressure_psi.front_left = parseFloat(this.simulatedFLTirePsi.toFixed(1));
          }
          window.dispatchEvent(new CustomEvent('automesh-data-updated'));
          this.render();
        } else {
          clearInterval(this.leakIntervalId);
        }
      }, 700);
    }
  }

  triggerToast(title, msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'qb-toast anim-fade';
    toast.style.borderColor = type === 'danger' ? 'rgba(220,38,38,0.4)' : 'rgba(59, 130, 246, 0.4)';
    toast.innerHTML = `
      <strong style="color: ${type === 'danger' ? '#EF4444' : '#3B82F6'}">${title}</strong>
      <span style="font-size: 0.725rem; color: #E5E7EB; line-height: 1.3; display: block; margin-top: 4px;">${msg}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  start3DEngineLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const canvas = this.container.querySelector('.schematic-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    this.energyParticles = [];
    this.animTime = 0;

    // Projection mathematics projection engine
    const project3D = (x, y, z, width, height) => {
      // 1. Rotate Y-axis (Yaw)
      let x1 = x * Math.cos(this.yaw) - z * Math.sin(this.yaw);
      let z1 = x * Math.sin(this.yaw) + z * Math.cos(this.yaw);

      // 2. Rotate X-axis (Pitch)
      let y2 = y * Math.cos(this.pitch) - z1 * Math.sin(this.pitch);
      let z2 = y * Math.sin(this.pitch) + z1 * Math.cos(this.pitch);

      // 3. Perspective Projection
      const fov = 350;
      const cameraDistance = 250;
      const perspectiveScale = fov / (cameraDistance + z2);

      // 4. Center and Scale
      const screenX = (width / 2) + x1 * perspectiveScale * this.zoom + this.panX;
      const screenY = (height / 2) + y2 * perspectiveScale * this.zoom + this.panY;

      return { x: screenX, y: screenY, depth: z2, scale: perspectiveScale * this.zoom };
    };

    const draw = () => {
      if (!this.container.isConnected || !this.container.querySelector('.schematic-canvas')) {
        cancelAnimationFrame(this.animationFrameId);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * window.devicePixelRatio || canvas.height !== rect.height * window.devicePixelRatio) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }

      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Easing camera variables (lerp)
      this.yaw += (this.targetYaw - this.yaw) * 0.08;
      this.pitch += (this.targetPitch - this.pitch) * 0.08;
      this.zoom += (this.targetZoom - this.zoom) * 0.08;
      this.panX += (this.targetPanX - this.panX) * 0.08;
      this.panY += (this.targetPanY - this.panY) * 0.08;

      ctx.clearRect(0, 0, width, height);
      this.animTime += 0.05;

      // Project all vertices
      const pNodes = {};
      for (const [key, node] of Object.entries(this.vertices)) {
        pNodes[key] = project3D(node.x, node.y, node.z, width, height);
      }

      // Draw Holographic background scanning lines
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.04)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // ── Draw 3D Venza Chassis Wireframe ──────────────────────────
      ctx.lineWidth = 1.0;
      this.edges.forEach(edge => {
        const p1 = pNodes[edge.a];
        const p2 = pNodes[edge.b];
        
        if (p1 && p2) {
          // Draw with dynamic glowing opacity depending on active layer
          let strokeStyle = 'rgba(59, 130, 246, 0.12)';
          if (this.activeLayer === 'chassis') {
            strokeStyle = 'rgba(59, 130, 246, 0.45)';
          }
          ctx.strokeStyle = strokeStyle;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });

      // ── Draw Subsystems Geometry in 3D ──────────────────────────
      
      // 1. ENGINE BLOCK (Powertrain Highlight)
      const engCenter = project3D(0, 5, -60, width, height);
      if (engCenter) {
        const size = 18 * engCenter.scale;
        const opacity = this.activeLayer === 'powertrain' ? 0.85 : 0.15;
        
        ctx.fillStyle = `rgba(249, 115, 22, ${opacity * 0.08})`;
        ctx.strokeStyle = `rgba(249, 115, 22, ${opacity})`;
        ctx.lineWidth = 1.2;
        
        // Draw 3D engine box grid
        ctx.strokeRect(engCenter.x - size/2, engCenter.y - size/3, size, size*0.7);
        ctx.fillRect(engCenter.x - size/2, engCenter.y - size/3, size, size*0.7);
        
        if (this.activeLayer === 'powertrain') {
          // Pulse center combustion fire core
          ctx.beginPath();
          ctx.arc(engCenter.x, engCenter.y, (8 + Math.sin(this.animTime * 4.0) * 3) * engCenter.scale, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
          ctx.fill();
        }
      }

      // 2. REAR AWD MOTOR (Powertrain/Electrical Highlight)
      const motCenter = project3D(0, 12, 60, width, height);
      if (motCenter) {
        const size = 12 * motCenter.scale;
        const opacity = this.activeLayer === 'powertrain' ? 0.8 : 0.15;
        
        ctx.strokeStyle = `rgba(249, 115, 22, ${opacity})`;
        ctx.fillStyle = `rgba(249, 115, 22, ${opacity * 0.05})`;
        ctx.lineWidth = 1.0;
        
        // Draw 3D motor cylinder outline
        ctx.beginPath();
        ctx.arc(motCenter.x, motCenter.y, size/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // 3. HV BATTERY CELL STACK (Electrical Highlight)
      const battCenter = project3D(0, 12, 25, width, height);
      if (battCenter) {
        const wSize = 25 * battCenter.scale;
        const hSize = 10 * battCenter.scale;
        const opacity = this.activeLayer === 'electrical' ? 0.9 : 0.12;
        
        ctx.fillStyle = `rgba(59, 130, 246, ${opacity * 0.08})`;
        ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
        ctx.lineWidth = 1.2;
        
        ctx.strokeRect(battCenter.x - wSize/2, battCenter.y - hSize/2, wSize, hSize);
        ctx.fillRect(battCenter.x - wSize/2, battCenter.y - hSize/2, wSize, hSize);
        
        if (this.activeLayer === 'electrical') {
          // Draw individual battery grid cells
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
          const cellW = wSize / 4;
          for (let i = 1; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(battCenter.x - wSize/2 + cellW*i, battCenter.y - hSize/2);
            ctx.lineTo(battCenter.x - wSize/2 + cellW*i, battCenter.y + hSize/2);
            ctx.stroke();
          }
        }
      }

      // 4. CONNECTED DCM ANTENNA (Cabin spoiler connection)
      const antCenter = project3D(0, -22, 76, width, height);
      if (antCenter) {
        const size = 6 * antCenter.scale;
        const opacity = this.activeLayer === 'electrical' ? 0.8 : 0.15;
        
        ctx.fillStyle = `rgba(59, 130, 246, ${opacity * 0.9})`;
        ctx.strokeStyle = `rgba(59, 130, 246, ${opacity * 0.4})`;
        
        ctx.beginPath();
        ctx.moveTo(antCenter.x, antCenter.y - size);
        ctx.lineTo(antCenter.x - size/2, antCenter.y + size/2);
        ctx.lineTo(antCenter.x + size/2, antCenter.y + size/2);
        ctx.closePath();
        ctx.fill();
        
        if (this.activeLayer === 'electrical') {
          // Draw signal waves
          ctx.strokeStyle = `rgba(59, 130, 246, ${0.4 + Math.sin(this.animTime * 2) * 0.3})`;
          ctx.beginPath();
          ctx.arc(antCenter.x, antCenter.y, (8 + (this.animTime * 8) % 15) * antCenter.scale, -Math.PI/1.5, -Math.PI/3);
          ctx.stroke();
        }
      }

      // 5. TSS RADAR 3D CONE SENSORS (Safety Highlight)
      const radCenter = project3D(0, 0, -96, width, height);
      if (radCenter) {
        const opacity = this.activeLayer === 'safety' ? 0.95 : 0.1;
        ctx.fillStyle = `rgba(16, 185, 129, ${opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(radCenter.x, radCenter.y, 4 * radCenter.scale, 0, Math.PI * 2);
        ctx.fill();
        
        if (this.activeLayer === 'safety') {
          // Sweep 3D safety radar frustum cone in front of bumper
          const coneLength = 100;
          const sweepAngle = Math.sin(this.animTime * 1.5) * 0.4;
          
          // Project cone end vertices in 3D
          const coneEndLeft = project3D(-35 + sweepAngle * 40, 10, -96 - coneLength, width, height);
          const coneEndRight = project3D(35 + sweepAngle * 40, 10, -96 - coneLength, width, height);
          const coneEndTop = project3D(sweepAngle * 40, -25, -96 - coneLength, width, height);
          
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(radCenter.x, radCenter.y);
          ctx.lineTo(coneEndLeft.x, coneEndLeft.y);
          ctx.lineTo(coneEndTop.x, coneEndTop.y);
          ctx.lineTo(coneEndRight.x, coneEndRight.y);
          ctx.closePath();
          
          const coneGrad = ctx.createLinearGradient(radCenter.x, radCenter.y, coneEndTop.x, coneEndTop.y);
          coneGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
          coneGrad.addColorStop(0.7, 'rgba(16, 185, 129, 0.08)');
          coneGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
          ctx.fillStyle = coneGrad;
          ctx.fill();
          
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(coneEndLeft.x, coneEndLeft.y);
          ctx.lineTo(coneEndRight.x, coneEndRight.y);
          ctx.stroke();
          ctx.restore();
          
          // Display tactical projected target locks in safety field
          const target3D = { x: 12 + Math.sin(this.animTime * 0.3) * 15, y: 15, z: -170 };
          const pTarget = project3D(target3D.x, target3D.y, target3D.z, width, height);
          
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
          ctx.strokeRect(pTarget.x - 7, pTarget.y - 7, 14, 14);
          ctx.fillStyle = '#10B981';
          ctx.font = '7px JetBrains Mono';
          ctx.fillText('OBSTACLE: CAR_42', pTarget.x + 10, pTarget.y - 3);
          ctx.fillText('DIST: 74 FT', pTarget.x + 10, pTarget.y + 4);
        }
      }

      // 6. WHEELS & TPMS TIRES (Chassis Highlight)
      const wheels3D = {
        fl: { x: -25, y: 15, z: -60, isFL: true },
        fr: { x: 25, y: 15, z: -60, isFL: false },
        rl: { x: -25, y: 15, z: 60, isFL: false },
        rr: { x: 25, y: 15, z: 60, isFL: false }
      };

      for (const [key, w] of Object.entries(wheels3D)) {
        const pWheel = project3D(w.x, w.y, w.z, width, height);
        if (pWheel) {
          const wRad = 15 * pWheel.scale;
          const isFL = w.isFL;
          const isLow = isFL && this.simulatedFLTirePsi < 30.0;
          const isActive = this.activeLayer === 'chassis';

          ctx.lineWidth = 1.0;
          if (isLow) {
            // Intense flashing danger alarm wheel halo
            const isFlash = Math.floor(this.animTime * 3) % 2 === 0;
            ctx.strokeStyle = isFlash ? '#EF4444' : 'rgba(239, 68, 68, 0.2)';
            ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
            
            ctx.beginPath();
            ctx.arc(pWheel.x, pWheel.y, wRad + 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = '#EF4444';
            ctx.font = 'bold 8px JetBrains Mono';
            ctx.fillText(`${this.simulatedFLTirePsi} PSI`, pWheel.x - 14, pWheel.y - wRad - 4);
          } else {
            // Standard rotating active telemetry wheel halo
            ctx.strokeStyle = isActive ? 'rgba(59, 130, 246, 0.75)' : 'rgba(59, 130, 246, 0.12)';
            ctx.beginPath();
            ctx.arc(pWheel.x, pWheel.y, wRad, 0, Math.PI * 2);
            ctx.stroke();

            if (isActive) {
              // Draw rotating wheel spokes
              ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
              const rot = this.animTime * 1.5;
              for (let i = 0; i < 4; i++) {
                const angle = rot + (i * Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(pWheel.x, pWheel.y);
                ctx.lineTo(pWheel.x + Math.cos(angle) * wRad, pWheel.y + Math.sin(angle) * wRad);
                ctx.stroke();
              }
            }
          }
        }
      }

      // ── Draw Kinetic energy flows between hybrid blocks (Powertrain) ────────────────
      if (this.activeLayer === 'powertrain') {
        const engNode = project3D(0, 5, -60, width, height);
        const motNode = project3D(0, 12, 60, width, height);
        
        if (engNode && motNode) {
          // Spawn energy particles
          if (Math.random() < 0.15) {
            this.energyParticles.push({
              t: 0,
              speed: 0.006 + Math.random() * 0.005,
              size: 1.5 + Math.random() * 1.5
            });
          }
          
          for (let i = this.energyParticles.length - 1; i >= 0; i--) {
            const ep = this.energyParticles[i];
            ep.t += ep.speed;
            if (ep.t >= 1) {
              this.energyParticles.splice(i, 1);
              continue;
            }
            
            // Interpolate screen path between engine and motor
            const x = engNode.x + (motNode.x - engNode.x) * ep.t;
            const y = engNode.y + (motNode.y - engNode.y) * ep.t + Math.sin(ep.t * Math.PI) * (20 * engNode.scale);
            
            ctx.beginPath();
            ctx.arc(x, y, ep.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(249, 115, 22, ${1.0 - ep.t})`;
            ctx.fill();
          }
        }
      }

      // ── Draw active overlay coordinates for hotspots ────────────────────────
      for (const [key, node] of Object.entries(this.hotspots3D)) {
        // Only draw relevant hotspots for the active layer to clean up HUD
        let shouldRender = false;
        if (key === 'engine' && this.activeLayer === 'powertrain') shouldRender = true;
        if (key === 'awd_motor' && this.activeLayer === 'powertrain') shouldRender = true;
        if (key === 'hybrid_battery' && this.activeLayer === 'electrical') shouldRender = true;
        if (key === 'wifi_antenna' && this.activeLayer === 'electrical') shouldRender = true;
        if (key === 'front_radar' && this.activeLayer === 'safety') shouldRender = true;
        if (key.startsWith('tires_') && this.activeLayer === 'chassis') shouldRender = true;

        if (shouldRender) {
          const pHot = project3D(node.x, node.y, node.z, width, height);
          if (pHot) {
            const ringRadius = node.r * pHot.scale;
            const isSelected = this.selectedHotspot === key || (key.startsWith('tires_') && this.selectedHotspot === 'tires');

            // Draw pulsing radar rings on hotspots
            ctx.strokeStyle = isSelected 
              ? 'rgba(245, 158, 11, 0.8)' 
              : key === 'tires_fl' && this.simulatedFLTirePsi < 30.0
                ? 'rgba(239, 68, 68, 0.8)'
                : 'rgba(59, 130, 246, 0.5)';
                
            ctx.lineWidth = isSelected ? 1.5 : 1.0;
            ctx.beginPath();
            ctx.arc(pHot.x, pHot.y, ringRadius + Math.sin(this.animTime * 3) * 3, 0, Math.PI * 2);
            ctx.stroke();

            // Tiny target crosshairs ticks
            ctx.strokeStyle = isSelected ? '#F59E0B' : 'rgba(59, 130, 246, 0.3)';
            ctx.beginPath();
            ctx.moveTo(pHot.x - ringRadius - 6, pHot.y); ctx.lineTo(pHot.x - ringRadius - 2, pHot.y);
            ctx.moveTo(pHot.x + ringRadius + 2, pHot.y); ctx.lineTo(pHot.x + ringRadius + 6, pHot.y);
            ctx.moveTo(pHot.x, pHot.y - ringRadius - 6); ctx.lineTo(pHot.x, pHot.y - ringRadius - 2);
            ctx.moveTo(pHot.x, pHot.y + ringRadius + 2); ctx.lineTo(pHot.x, pHot.y + ringRadius + 6);
            ctx.stroke();
          }
        }
      }

      this.animationFrameId = requestAnimationFrame(draw);
    };

    draw();
  }

  render() {
    if (this.isLoading) {
      this.container.innerHTML = `
        <div class="card" style="height: 520px; display: flex; align-items: center; justify-content: center; background: #020305;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-4);">
            <div class="spinner" style="width: 24px; height: 24px; border-width: 3px; border-top-color: #3B82F6;"></div>
            <span class="text-mono text-xs" style="color: #9CA3AF;">CALIBRATING PROCEDURAL 3D WIREFRAME ENGINE...</span>
          </div>
        </div>
      `;
      return;
    }

    const t = this.telemetry?.telemetry || {};
    const vehicleInfo = this.telemetry?.vehicle || { model: 'Venza', model_year: '2023', color: 'Wind Chill Pearl' };
    const diagnostics = this.telemetry?.diagnostics || { malfunctions: [], maintenance_required: false };

    const fl = this.isSimulatingLeak ? parseFloat(this.simulatedFLTirePsi.toFixed(1)) : (t.tire_pressure_psi?.front_left || 35.0);
    const fr = t.tire_pressure_psi?.front_right || 37.0;
    const rl = t.tire_pressure_psi?.rear_left || 36.0;
    const rr = t.tire_pressure_psi?.rear_right || 36.0;
    const statusText = this.isSimulatingLeak ? 'PRESSURE LOSS INJECTED' : (vehicleInfo.status || 'PARKED');
    const lastUpdate = new Date().toLocaleTimeString();

    const isTireAlert = fl < 30 || fr < 30 || rl < 30 || rr < 30 || fl > 38 || fr > 38 || rl > 38 || rr > 38;
    const isOilAlert = this.predictions?.oil_life?.remaining_percent < 20;
    const activeAlertsCount = (isTireAlert ? 1 : 0) + (isOilAlert ? 1 : 0) + (diagnostics.maintenance_required ? 1 : 0);

    const allSpecs = this.getAllComponentSpecs();
    const filteredSpecs = allSpecs.filter(s => 
      s.title.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
      s.category.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      s.notes.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(this.searchQuery.toLowerCase())
    );

    this.container.innerHTML = `
      <style>
        .hud-3d-canvas-container {
          position: relative;
          background: radial-gradient(circle at center, #0B0E14 0%, #020305 100%);
          border: 1px solid rgba(59, 130, 246, 0.15);
          overflow: hidden;
          border-radius: var(--radius-lg);
          user-select: none;
          min-height: 420px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          box-shadow: inset 0 0 50px rgba(0,0,0,0.9);
        }
        .hud-3d-canvas-container:active {
          cursor: grabbing;
        }
        .hud-3d-grid-mask {
          position: absolute;
          inset: 0;
          background-size: 30px 30px;
          background-image: 
            linear-gradient(to right, rgba(59, 130, 246, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(59, 130, 246, 0.02) 1px, transparent 1px);
          pointer-events: none;
          z-index: 1;
        }
        .hud-crt-scanlines {
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
          background-size: 100% 4px, 6px 100%;
          pointer-events: none;
          z-index: 5;
          opacity: 0.6;
        }
        .schematic-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 10;
        }
        .m-spec-item {
          border-left: 2px solid transparent;
          background: rgba(255,255,255,0.01);
          transition: all 0.2s ease;
        }
        .m-spec-item:hover {
          background: rgba(255,255,255,0.03);
          border-left-color: rgba(59, 130, 246, 0.5);
          padding-left: 14px;
        }
        .m-spec-item.active {
          background: rgba(59, 130, 246, 0.05);
          border-left-color: #3B82F6;
          padding-left: 14px;
        }
        .preset-btn {
          border-radius: var(--radius-sm);
          border: 1px solid rgba(255,255,255,0.08);
          color: #9CA3AF;
          font-family: var(--font-mono);
          font-size: 0.65rem;
          padding: 3px 6px;
          background: rgba(255,255,255,0.02);
          transition: all 0.15s ease;
        }
        .preset-btn:hover {
          background: rgba(59, 130, 246, 0.15);
          color: #ffffff;
          border-color: #3B82F6;
        }
      </style>

      <div style="display: grid; grid-template-columns: 1fr 360px; gap: var(--space-6);" class="anim-fade">
        
        <!-- Left Column: The Procedural 3D Vector Viewport -->
        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; background: #010204; border-color: rgba(59,130,246,0.15);">
          
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: var(--space-3); background: rgba(59,130,246,0.01);">
            <div>
              <h3 style="color: #ffffff; display: flex; align-items: center; gap: 8px;">
                <span class="indicator-dot" style="background: #3B82F6; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px #3B82F6;"></span>
                Autonomous 3D Vector Telematics HUD
              </h3>
              <p class="text-xs text-secondary" style="margin-top: 2px; color: #9CA3AF;">Drag grid to orbit 360°. Scroll to pan zoom level. Snap camera using presets below.</p>
            </div>
            
            <div style="display: flex; gap: var(--space-2);">
              <button class="btn btn-ghost btn-xs sim-leak-btn" style="color: ${this.isSimulatingLeak ? '#EF4444' : '#E5E7EB'}; border-color: ${this.isSimulatingLeak ? '#EF4444' : 'rgba(255,255,255,0.15)'}; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
                🚨 ${this.isSimulatingLeak ? 'STOP SIMULATION' : 'SIMULATE LEAK'}
              </button>
              
              ${this.selectedHotspot || this.zoom !== 1.3 ? `
                <button class="btn btn-ghost btn-xs reset-camera-btn" style="color: #ffffff; border-color: rgba(255,255,255,0.15); display: inline-flex; align-items: center; gap: 4px;">
                  ← Center Viewport
                </button>
              ` : `
                <span class="badge" style="font-family: var(--font-mono); font-size: 0.65rem; color: #10B981; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25);">3D VECTOR GRID ACTIVE</span>
              `}
            </div>
          </div>

          <!-- Structural Layer Toggles (Filters) -->
          <div style="padding: var(--space-3) var(--space-4); display: flex; gap: var(--space-2); border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.01); justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: var(--space-2);">
              <button class="layer-tab ${this.activeLayer === 'chassis' ? 'active' : ''}" data-layer="chassis" style="border-radius: var(--radius); border-color: rgba(255,255,255,0.1);">
                🚘 Chassis Structure
              </button>
              <button class="layer-tab ${this.activeLayer === 'powertrain' ? 'active' : ''}" data-layer="powertrain" style="border-radius: var(--radius); border-color: rgba(255,255,255,0.1);">
                ⚙️ Powertrain e-AWD
              </button>
              <button class="layer-tab ${this.activeLayer === 'electrical' ? 'active' : ''}" data-layer="electrical" style="border-radius: var(--radius); border-color: rgba(255,255,255,0.1);">
                ⚡ Electrical Hybrid
              </button>
              <button class="layer-tab ${this.activeLayer === 'safety' ? 'active' : ''}" data-layer="safety" style="border-radius: var(--radius); border-color: rgba(255,255,255,0.1);">
                🛡️ Safety ADAS Cone
              </button>
            </div>

            <!-- Orbit Camera Angle Snaps -->
            <div style="display: flex; gap: 4px; align-items: center;">
              <span class="text-xs text-secondary" style="font-family: var(--font-mono); font-size: 0.6rem; color: #6B7280; margin-right: 4px;">CAM SNAPS:</span>
              <button class="preset-btn" data-preset="isometric">ISO</button>
              <button class="preset-btn" data-preset="topdown">TOP</button>
              <button class="preset-btn" data-preset="side">SIDE</button>
              <button class="preset-btn" data-preset="frontal">FRONT</button>
            </div>
          </div>

          <!-- HTML5 Canvas 3D Projections Grid -->
          <div class="hud-3d-canvas-container" style="flex-grow: 1;">
            <div class="hud-3d-grid-mask"></div>
            <div class="hud-crt-scanlines"></div>
            
            <canvas class="schematic-canvas"></canvas>

            <!-- Holographic Coordinate Details -->
            <div style="position: absolute; top: var(--space-4); left: var(--space-4); font-family: var(--font-mono); font-size: 0.65rem; color: #3B82F6; pointer-events: none; z-index: 20;">
              <div>CAMERA_YAW: ${(this.yaw * 180 / Math.PI).toFixed(0)}°</div>
              <div>CAMERA_PITCH: ${(this.pitch * 180 / Math.PI).toFixed(0)}°</div>
              <div>ZOOM_LEVEL: ${this.zoom.toFixed(2)}x</div>
              <div style="margin-top: 4px; color: ${isTireAlert ? '#EF4444' : '#10B981'}">
                DIAG_STATE: ${isTireAlert ? 'ALARM ACTIVE [DTC]' : 'NOMINAL [SECURE]'}
              </div>
            </div>

            <!-- Visual Alert Counters -->
            ${activeAlertsCount > 0 ? `
              <div style="position: absolute; bottom: var(--space-4); left: var(--space-4); display: flex; align-items: center; gap: var(--space-2); background: rgba(220,38,38,0.2); border: 1px solid rgba(220,38,38,0.4); padding: 4px var(--space-3); border-radius: var(--radius); z-index: 20; font-family: var(--font-mono); pointer-events: none;">
                <span class="indicator-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444; box-shadow: 0 0 8px #EF4444;"></span>
                <span style="font-size: 0.65rem; font-weight: 700; color: #FCA5A5;">${activeAlertsCount} VEHICLE VECTOR BREAKS</span>
              </div>
            ` : ''}
          </div>

          <!-- Bottom detailed metadata panel -->
          <div style="border-top: 1px solid rgba(255,255,255,0.05); padding: var(--space-4); display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); background: rgba(59,130,246,0.01);" class="text-sm">
            <div>
              <span class="text-tertiary uppercase text-xs" style="letter-spacing: 0.05em; font-weight: 600; color: #9CA3AF;">VEHICLE BODY STYLE</span>
              <div style="font-weight: 500; color: #ffffff; margin-top: 2px;">
                ${vehicleInfo.color} ${vehicleInfo.model} Limited 3D Wireframe
              </div>
              <div class="text-xs" style="color: #9CA3AF;">Odometer: ${t.odometer || '48,587.0'} mi | VIN: ${this.vin}</div>
            </div>
            <div style="text-align: right;">
              <span class="text-tertiary uppercase text-xs" style="letter-spacing: 0.05em; font-weight: 600; color: #9CA3AF;">3D ENGINE STREAM</span>
              <div style="font-weight: 600; color: ${this.isSimulatingLeak ? '#EF4444' : '#10B981'}; margin-top: 2px; text-transform: uppercase;">
                ${statusText}
              </div>
              <div class="text-xs" style="color: #9CA3AF;">Telemetry Sync: ${lastUpdate}</div>
            </div>
          </div>
        </div>

        <!-- Right Column: Manual Specs Explorer & Alarm Inspector -->
        <div class="card" style="background: #08090E; border-color: rgba(59,130,246,0.15); display: flex; flex-direction: column;">
          
          <div class="card-header" style="border-bottom: 1px dashed rgba(59,130,246,0.15); padding: var(--space-4) var(--space-5); background: rgba(59,130,246,0.01);">
            <h3 style="color: #ffffff;">Venza Manual Console</h3>
          </div>

          <!-- Specs Explorer Content -->
          <div style="flex-grow: 1; padding: var(--space-4); display: flex; flex-direction: column; justify-content: space-between; overflow-y: auto;">
            
            <div style="display: flex; flex-direction: column; gap: var(--space-4);">
              
              <!-- Search Box -->
              <div style="position: relative;">
                <input type="text" class="form-input manual-search-input" placeholder="Search manual specs (e.g. oil, PSI)..." value="${this.searchQuery}" style="background: rgba(255,255,255,0.03); color: #ffffff; border-color: rgba(59,130,246,0.15); padding-left: 28px; font-size: 0.8rem; height: 32px;" />
                <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 0.75rem; opacity: 0.5;">🔍</span>
                ${this.searchQuery ? `<span class="clear-search-btn" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: 0.75rem; opacity: 0.7;">✕</span>` : ''}
              </div>

              <!-- Compact Directory List -->
              ${!this.selectedHotspot ? `
                <div style="display: flex; flex-direction: column; gap: var(--space-2);">
                  <span class="text-tertiary uppercase text-xs" style="font-weight: 600; font-size: 0.6rem; letter-spacing: 0.05em; color: #9CA3AF;">3D Component Catalog (${filteredSpecs.length})</span>
                  
                  <div style="display: flex; flex-direction: column; gap: var(--space-1); max-height: 240px; overflow-y: auto; padding-right: 4px;">
                    ${filteredSpecs.map(s => `
                      <div class="m-spec-item" data-item="${s.id}" style="padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); cursor: pointer; border: 1px solid rgba(255,255,255,0.03);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                          <strong style="font-size: 0.75rem; color: #ffffff;">${s.title}</strong>
                          <span class="badge" style="font-size: 0.55rem; padding: 1px 4px; background: rgba(59, 130, 246, 0.1); color: #3B82F6;">${s.category}</span>
                        </div>
                        <p class="text-xs text-secondary" style="margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; color: #9CA3AF;">${s.code} | ${s.location}</p>
                      </div>
                    `).join('')}
                    ${filteredSpecs.length === 0 ? `
                      <div class="text-xs text-center text-tertiary" style="padding: var(--space-6) 0;">No matching components found.</div>
                    ` : ''}
                  </div>
                </div>
              ` : ''}

              <!-- Spec Details Panel -->
              ${this.selectedHotspot ? (() => {
                const spec = this.getManualSpecs(this.selectedHotspot);
                return `
                  <div class="anim-fade" style="display: flex; flex-direction: column; gap: var(--space-3);">
                    <div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: var(--space-2);">
                      <div>
                        <span class="badge" style="font-size: 0.55rem; text-transform: uppercase; background: rgba(59, 130, 246, 0.1); color: #3B82F6;">Venza Service Database</span>
                        <h4 style="font-size: 1.05rem; font-weight: 700; color: #ffffff; margin-top: 4px;">${spec.title}</h4>
                        <div class="text-xs text-secondary" style="margin-top: 2px; color: #9CA3AF;">Location: <strong>${spec.location}</strong></div>
                      </div>
                      <button class="btn btn-ghost btn-xs close-spec-btn" style="padding: 2px 6px; font-size: 0.65rem; border-color: rgba(255,255,255,0.1); color: #ffffff;">✕</button>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: var(--space-2);">
                      <div style="background: rgba(255,255,255,0.02); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.05);">
                        <div class="text-xs text-tertiary uppercase" style="font-weight: 600; font-size: 0.55rem; color: #9CA3AF;">OEM Code / Part Reference</div>
                        <div class="text-xs text-mono text-primary" style="font-weight: 600; margin-top: 2px; color: #ffffff;">${spec.code}</div>
                      </div>

                      <div style="background: rgba(255,255,255,0.02); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.05);">
                        <div class="text-xs text-tertiary uppercase" style="font-weight: 600; font-size: 0.55rem; color: #9CA3AF;">Fluid Capacity Specs</div>
                        <div class="text-xs text-primary" style="font-weight: 500; margin-top: 2px; color: #ffffff;">${spec.fluidType} | ${spec.capacity}</div>
                      </div>

                      <div style="background: rgba(255,255,255,0.02); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.05);">
                        <div class="text-xs text-tertiary uppercase" style="font-weight: 600; font-size: 0.55rem; color: #9CA3AF;">Dry Tightening Torque</div>
                        <div class="text-xs text-mono text-primary" style="font-weight: 600; margin-top: 2px; color: #3B82F6;">${spec.torque}</div>
                      </div>
                    </div>

                    <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: var(--space-2);">
                      <div class="text-xs text-secondary" style="font-size: 0.65rem; line-height: 1.4; color: #9CA3AF;">
                        <strong style="color: #ffffff;">Field Service Tip:</strong> ${spec.notes}
                      </div>
                    </div>
                  </div>
                `;
              })() : `
                <!-- Empty State -->
                <div style="text-align: center; color: var(--text-tertiary); padding: var(--space-8) var(--space-4); border: 1px dashed rgba(59, 130, 246, 0.15); border-radius: var(--radius-lg); margin-top: var(--space-2);">
                  <div style="font-size: 1.5rem; opacity: 0.5;">🔬</div>
                  <h4 style="font-size: 0.85rem; font-weight: 600; color: #ffffff; margin-top: var(--space-2);">3D Skeleton Index Reader</h4>
                  <p class="text-xs text-secondary" style="line-height: 1.4; color: #9CA3AF; margin-top: 4px; max-width: 220px; margin-left: auto; margin-right: auto;">Drag to rotate the Venza in 3D, and click any glowing coordinate reticle to inspect specifications.</p>
                </div>
              `}

            </div>

            <!-- Active Troubleshooting -->
            <div style="margin-top: var(--space-6);">
              ${activeAlertsCount > 0 ? `
                <div style="background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.3); padding: var(--space-3); border-radius: var(--radius); display: flex; flex-direction: column; gap: var(--space-2);">
                  <span style="font-size: 0.7rem; font-weight: 700; color: #EF4444; letter-spacing: 0.05em; text-transform: uppercase;">VEHICLE ANOMALY WARNINGS</span>
                  <ul style="margin: 0; padding-left: var(--space-4); font-size: 0.65rem; color: #FCA5A5; display: flex; flex-direction: column; gap: 4px; line-height: 1.35;">
                    ${fl < 30 ? `<li><strong>Wheel pressure alarm:</strong> FL tire reads critical pressure delta at ${fl} PSI (target 35 PSI). High risk of audit flags, tire heating.</li>` : ''}
                    ${isOilAlert ? `<li><strong>Oil Life Warn:</strong> Synthetic motor oil remaining shelf index at ${this.predictions?.oil_life?.remaining_percent}% (threshold 20%). Change required.</li>` : ''}
                    ${diagnostics.maintenance_required ? `<li><strong>DTC malfunction active:</strong> Dash MIL light is triggered. Scan diagnostics log.</li>` : ''}
                  </ul>
                </div>
              ` : `
                <div style="background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.25); padding: var(--space-3); border-radius: var(--radius); display: flex; align-items: center; gap: var(--space-2);">
                  <span style="width: 6px; height: 6px; border-radius: 50%; background: #10B981;"></span>
                  <span style="font-size: 0.65rem; font-weight: 600; color: #10B981; font-family: var(--font-mono); letter-spacing: 0.02em;">ALL VEHICLE HARDWARE SYSTEMS PASS DIALOG</span>
                </div>
              `}
            </div>

          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const parent = this.container;
    
    // 1. Layer Tabs
    parent.querySelectorAll('.layer-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.getAttribute('data-layer');
        this.selectLayer(layer);
      });
    });

    // 2. Camera perspective preset buttons
    parent.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        this.setPerspectivePreset(preset);
      });
    });

    // 3. Sim leak trigger
    const simBtn = parent.querySelector('.sim-leak-btn');
    if (simBtn) {
      simBtn.addEventListener('click', () => this.toggleTirePressureLeakSim());
    }

    // 4. Center Viewport camera
    const resetBtn = parent.querySelector('.reset-camera-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetCamera());
    }

    // 5. Close specific manual sheet button
    const closeSpecBtn = parent.querySelector('.close-spec-btn');
    if (closeSpecBtn) {
      closeSpecBtn.addEventListener('click', () => this.resetCamera());
    }

    // 6. Manual catalog directory items
    parent.querySelectorAll('.m-spec-item').forEach(item => {
      item.addEventListener('click', () => {
        const componentId = item.getAttribute('data-item');
        
        // Auto-select correct layers
        const spec = this.getManualSpecs(componentId);
        if (spec) {
          if (spec.category === 'Powertrain') this.activeLayer = 'powertrain';
          else if (spec.category === 'HV System' || spec.category === 'Cabin Connect') this.activeLayer = 'electrical';
          else if (spec.category === 'Chassis') this.activeLayer = 'chassis';
          else if (spec.category === 'ADAS Safety') this.activeLayer = 'safety';
        }
        
        // Map tires specifically in 3D hotspots
        if (componentId === 'tires') {
          this.selectHotspot('tires_fl');
        } else {
          this.selectHotspot(componentId);
        }
      });
    });

    // 7. Manual Search Index
    const searchInput = parent.querySelector('.manual-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
        
        // Restore focus
        const activeSearch = this.container.querySelector('.manual-search-input');
        if (activeSearch) {
          activeSearch.focus();
          activeSearch.setSelectionRange(activeSearch.value.length, activeSearch.value.length);
        }
      });
    }

    const clearSearch = parent.querySelector('.clear-search-btn');
    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        this.searchQuery = '';
        this.render();
      });
    }

    // 8. Orbital drag, pan & scroll-to-zoom controls directly on canvas
    const canvas = parent.querySelector('.schematic-canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;

        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        // Shift angles by scale
        this.targetYaw += deltaX * 0.007;
        this.targetPitch += deltaY * 0.007;

        // Prevent gimbal lock on Pitch
        this.targetPitch = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, this.targetPitch));
      });

      window.addEventListener('mouseup', () => {
        if (this.isDragging) {
          this.isDragging = false;
        }
      });

      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const deltaZoom = -e.deltaY * 0.001;
        this.targetZoom += deltaZoom;
        this.targetZoom = Math.max(0.4, Math.min(3.5, this.targetZoom));
      }, { passive: false });

      // Click to select 3D hotspots
      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const width = canvas.width / window.devicePixelRatio;
        const height = canvas.height / window.devicePixelRatio;

        // Projection check to locate which hotspot center the user clicked
        let clickedKey = null;
        let minDistance = 20; // click radius tolerance

        for (const [key, node] of Object.entries(this.hotspots3D)) {
          // Filter checks
          let layerMatch = false;
          if (key === 'engine' && this.activeLayer === 'powertrain') layerMatch = true;
          if (key === 'awd_motor' && this.activeLayer === 'powertrain') layerMatch = true;
          if (key === 'hybrid_battery' && this.activeLayer === 'electrical') layerMatch = true;
          if (key === 'wifi_antenna' && this.activeLayer === 'electrical') layerMatch = true;
          if (key === 'front_radar' && this.activeLayer === 'safety') layerMatch = true;
          if (key.startsWith('tires_') && this.activeLayer === 'chassis') layerMatch = true;

          if (layerMatch) {
            // Apply projection formula to 3D node
            let x1 = node.x * Math.cos(this.yaw) - node.z * Math.sin(this.yaw);
            let z1 = node.x * Math.sin(this.yaw) + node.z * Math.cos(this.yaw);
            let y2 = node.y * Math.cos(this.pitch) - z1 * Math.sin(this.pitch);
            let z2 = node.y * Math.sin(this.pitch) + z1 * Math.cos(this.pitch);

            const fov = 350;
            const cameraDistance = 250;
            const pScale = fov / (cameraDistance + z2);

            const screenX = (width / 2) + x1 * pScale * this.zoom + this.panX;
            const screenY = (height / 2) + y2 * pScale * this.zoom + this.panY;

            const dist = Math.hypot(clickX - screenX, clickY - screenY);
            if (dist < minDistance) {
              minDistance = dist;
              clickedKey = key;
            }
          }
        }

        if (clickedKey) {
          this.selectHotspot(clickedKey);
        }
      });
    }
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.leakIntervalId) {
      clearInterval(this.leakIntervalId);
    }
  }
}
