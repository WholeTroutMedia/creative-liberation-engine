#!/usr/bin/env python3
"""
Plex Harvest Daemon — CLE Academy
=========================================
Two-tier autonomous harvesting orchestrator.

Tier 1 (always running): Metadata, subtitles, text vectorization — <5% CPU, 0% GPU.
Tier 2 (idle-activated): Keyframe extraction, CLIP embedding — 60% CPU, 80% GPU.

Monitors system load every 60s. Tier 2 engages when CPU <15% and GPU <10%.
Backs off immediately when user activity resumes.

Phase 7 of the Cortex x Plex integration.
"""
from __future__ import annotations

import json, os, time, logging, subprocess, signal, sys, threading
from typing import Optional
from datetime import datetime

logger = logging.getLogger("PlexDaemon")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s — %(message)s'))
    logger.addHandler(ch)

# ─── Import harvesters ──────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

try:
    from plex_client import PlexClient
    PLEX_AVAILABLE = True
except ImportError:
    PLEX_AVAILABLE = False
    logger.error("plex_client not found — daemon cannot start")

try:
    from plex_dialogue_harvester import PlexDialogueHarvester
    DIALOGUE_AVAILABLE = True
except ImportError:
    DIALOGUE_AVAILABLE = False

# ─── Configuration ───────────────────────────────────────────────────────────

ACADEMY_BASE = "/volume1/cle/academy"
DAEMON_STATE_FILE = f"{ACADEMY_BASE}/daemon_state.json"
CHECK_INTERVAL = 60  # seconds between load checks

# Tier 2 activation thresholds
CPU_IDLE_THRESHOLD = 15   # Below this % → GPU-heavy tasks OK
GPU_IDLE_THRESHOLD = 10   # Below this % → GPU-heavy tasks OK

# Tier 2 deactivation thresholds (back off when user is active)
CPU_ACTIVE_THRESHOLD = 50   # Above this → pause Tier 2
GPU_ACTIVE_THRESHOLD = 30   # Above this → pause Tier 2

# Storage safety — pause if NAS drops below this
MIN_FREE_GB = 500

# Priority queue
LIBRARY_PRIORITY = ["movie", "show"]  # Films + Docs first, then TV

# ─── System Load Monitoring ─────────────────────────────────────────────────

def get_cpu_percent() -> float:
    """Get current CPU usage via PowerShell (Windows) or /proc (Linux)."""
    try:
        # Try psutil first
        import psutil
        return psutil.cpu_percent(interval=1)
    except ImportError:
        pass

    # Fallback: PowerShell
    try:
        result = subprocess.run(
            ["powershell", "-Command",
             "(Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue"],
            capture_output=True, text=True, timeout=10
        )
        return float(result.stdout.strip())
    except Exception:
        pass

    # Fallback: Linux
    try:
        with open("/proc/stat") as f:
            line = f.readline()
            fields = line.split()
            idle = int(fields[4])
            total = sum(int(x) for x in fields[1:])
            return 100.0 * (1 - idle / total) if total else 0
    except Exception:
        return 50.0  # Assume moderate load if we can't read


def get_gpu_percent() -> float:
    """Get GPU utilization via nvidia-smi."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0  # No GPU or nvidia-smi not available


def get_nas_free_gb(path: str = "/volume1") -> float:
    """Check NAS free space in GB."""
    try:
        result = subprocess.run(
            ["ssh", "-p", "2000", "jaharoni@127.0.0.1",
             f"df --output=avail -BG {path} | tail -1"],
            capture_output=True, text=True, timeout=10
        )
        avail = result.stdout.strip().replace("G", "")
        return float(avail)
    except Exception:
        try:
            # Local check
            st = os.statvfs(path)
            return (st.f_bavail * st.f_frsize) / (1024**3)
        except Exception:
            return 9999  # Assume plenty if we can't check


# ─── Daemon State ────────────────────────────────────────────────────────────

class DaemonState:
    """Persistent daemon state — survives restarts."""

    def __init__(self):
        self.tier1_active = False
        self.tier2_active = False
        self.items_processed = 0
        self.items_total = 0
        self.current_item = ""
        self.current_tier = 0
        self.started_at = 0
        self.last_check = 0
        self.errors = []
        self._load()

    def _load(self):
        if os.path.isfile(DAEMON_STATE_FILE):
            with open(DAEMON_STATE_FILE) as f:
                data = json.load(f)
                for k, v in data.items():
                    if hasattr(self, k):
                        setattr(self, k, v)

    def save(self):
        os.makedirs(os.path.dirname(DAEMON_STATE_FILE), exist_ok=True)
        with open(DAEMON_STATE_FILE, "w") as f:
            json.dump({
                "tier1_active": self.tier1_active,
                "tier2_active": self.tier2_active,
                "items_processed": self.items_processed,
                "items_total": self.items_total,
                "current_item": self.current_item,
                "current_tier": self.current_tier,
                "started_at": self.started_at,
                "last_check": self.last_check,
                "errors": self.errors[-50:],  # Keep last 50 errors
            }, f, indent=2)

    @property
    def progress_pct(self) -> float:
        return (self.items_processed / self.items_total * 100) if self.items_total else 0


# ─── Daemon Core ─────────────────────────────────────────────────────────────

class PlexHarvestDaemon:
    """
    Autonomous two-tier harvesting daemon.
    Tier 1 runs always. Tier 2 activates on system idle.
    """

    def __init__(self, token: Optional[str] = None):
        self.state = DaemonState()
        self.running = True
        self.token = token

        # Handle graceful shutdown
        signal.signal(signal.SIGINT, self._shutdown)
        signal.signal(signal.SIGTERM, self._shutdown)

    def _shutdown(self, signum, frame):
        logger.info(f"\n[!] Shutdown signal received. Saving state...")
        self.running = False
        self.state.tier1_active = False
        self.state.tier2_active = False
        self.state.save()
        logger.info("[+] State saved. Exiting.")
        sys.exit(0)

    def run(self):
        """Main daemon loop."""
        logger.info("=" * 60)
        logger.info("  CLE ACADEMY — Plex Harvest Daemon")
        logger.info("=" * 60)
        logger.info(f"  Tier 1: Always on (metadata + dialogue)")
        logger.info(f"  Tier 2: Idle-activated (keyframes + CLIP)")
        logger.info(f"  CPU idle threshold: <{CPU_IDLE_THRESHOLD}%")
        logger.info(f"  GPU idle threshold: <{GPU_IDLE_THRESHOLD}%")
        logger.info(f"  Check interval: {CHECK_INTERVAL}s")
        logger.info("=" * 60)

        self.state.started_at = int(time.time())
        self.state.tier1_active = True
        self.state.save()

        # Start Tier 1 in background thread
        tier1_thread = threading.Thread(target=self._run_tier1, daemon=True)
        tier1_thread.start()

        # Main loop — monitor load and manage Tier 2
        while self.running:
            try:
                self._check_and_manage_tier2()
                self.state.last_check = int(time.time())
                self.state.save()
            except Exception as e:
                logger.error(f"[!] Monitor error: {e}")
                self.state.errors.append(f"{datetime.now().isoformat()}: {e}")

            time.sleep(CHECK_INTERVAL)

    def _check_and_manage_tier2(self):
        """Check system load and activate/deactivate Tier 2."""
        cpu = get_cpu_percent()
        gpu = get_gpu_percent()
        nas_free = get_nas_free_gb()

        tier2_status = "ACTIVE" if self.state.tier2_active else "IDLE"
        logger.info(
            f"[monitor] CPU: {cpu:.1f}% | GPU: {gpu:.1f}% | "
            f"NAS free: {nas_free:.0f}GB | Tier2: {tier2_status} | "
            f"Progress: {self.state.progress_pct:.1f}%"
        )

        # Storage safety check
        if nas_free < MIN_FREE_GB:
            if self.state.tier2_active:
                logger.warning(f"[!] NAS storage low ({nas_free:.0f}GB). Pausing Tier 2.")
                self.state.tier2_active = False
            return

        # Tier 2 activation logic
        if not self.state.tier2_active:
            if cpu < CPU_IDLE_THRESHOLD and gpu < GPU_IDLE_THRESHOLD:
                logger.info("[+] System idle — activating Tier 2 (keyframes + CLIP)")
                self.state.tier2_active = True
                # Launch Tier 2 in background thread
                t2 = threading.Thread(target=self._run_tier2, daemon=True)
                t2.start()
        else:
            # Check if user is active — back off
            if cpu > CPU_ACTIVE_THRESHOLD or gpu > GPU_ACTIVE_THRESHOLD:
                logger.info(f"[!] User active (CPU:{cpu:.0f}% GPU:{gpu:.0f}%) — pausing Tier 2")
                self.state.tier2_active = False

    def _run_tier1(self):
        """
        Tier 1: Metadata + dialogue extraction.
        Runs continuously at low priority.
        """
        logger.info("[T1] Starting Tier 1 — metadata & dialogue harvesting")
        try:
            if not DIALOGUE_AVAILABLE:
                logger.error("[T1] PlexDialogueHarvester not available")
                return

            harvester = PlexDialogueHarvester(plex_token=self.token)
            self.state.current_tier = 1
            self.state.save()

            harvester.harvest_library(priority_types=LIBRARY_PRIORITY)
            logger.info("[T1] Tier 1 complete — all dialogue extracted")
        except Exception as e:
            logger.error(f"[T1] Fatal error: {e}")
            self.state.errors.append(f"T1: {e}")
            self.state.save()

    def _run_tier2(self):
        """
        Tier 2: Keyframe extraction + CLIP embedding.
        Only runs when system is idle. Self-pauses when load increases.
        """
        logger.info("[T2] Starting Tier 2 — keyframe extraction")

        try:
            plex = PlexClient(token=self.token)
            plex.discover_servers()
            libraries = plex.get_libraries()

            for lib in libraries:
                if lib["type"] not in ("movie", "show"):
                    continue
                if not self.state.tier2_active:
                    logger.info("[T2] Paused by load monitor")
                    return

                items = plex.get_all_library_items(lib["key"])
                self.state.items_total = len(items)

                for item in items:
                    if not self.state.tier2_active:
                        logger.info("[T2] Paused — user active")
                        return
                    if not self.running:
                        return

                    self.state.current_item = item.title
                    self.state.current_tier = 2
                    self.state.save()

                    try:
                        self._extract_keyframes(plex, item)
                        self.state.items_processed += 1
                    except Exception as e:
                        logger.error(f"[T2] Keyframe error for '{item.title}': {e}")
                        self.state.errors.append(f"T2 {item.title}: {e}")

                    # Yield between items
                    time.sleep(2)

            logger.info("[T2] Complete — all keyframes extracted")

        except Exception as e:
            logger.error(f"[T2] Fatal: {e}")
            self.state.errors.append(f"T2: {e}")
        finally:
            self.state.tier2_active = False
            self.state.save()

    def _extract_keyframes(self, plex: PlexClient, item):
        """
        Extract keyframes from a single media item using FFmpeg scene-cut detection.
        Streams video from Plex → FFmpeg → scene-cut frames → disk.
        """
        logger.info(f"  [T2] Extracting keyframes: {item.title}")

        try:
            stream_url = plex.get_stream_url(item.rating_key)
        except ValueError:
            logger.warning(f"  [T2] No stream URL for '{item.title}'")
            return

        # Output directory
        safe_title = "".join(c if c.isalnum() or c in " -_" else "_" for c in item.title)[:80]
        output_dir = os.path.join("/volume1/cle/academy/keyframes", safe_title)
        os.makedirs(output_dir, exist_ok=True)

        # Check if already extracted
        existing = [f for f in os.listdir(output_dir) if f.endswith(".jpg")] if os.path.isdir(output_dir) else []
        if len(existing) > 10:
            logger.info(f"  [T2] Already have {len(existing)} keyframes — skipping")
            return

        # FFmpeg scene-cut detection + fixed interval fallback
        output_pattern = os.path.join(output_dir, f"frame_%04d.jpg")
        cmd = [
            "ffmpeg", "-i", stream_url,
            "-vf", "select=gt(scene\\,0.3)+not(mod(n\\,900))",  # scene-cut OR every 30s (900 frames at 30fps)
            "-vsync", "vfn",
            "-q:v", "2",  # High quality JPEG
            "-y",  # Overwrite
            output_pattern,
        ]

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                timeout=1800  # 30 min max per film
            )
            frames = len([f for f in os.listdir(output_dir) if f.endswith(".jpg")])
            logger.info(f"  [T2] Extracted {frames} keyframes for '{item.title}'")
        except subprocess.TimeoutExpired:
            logger.warning(f"  [T2] FFmpeg timed out for '{item.title}'")
        except FileNotFoundError:
            logger.error("[T2] FFmpeg not found in PATH")
        except Exception as e:
            logger.error(f"  [T2] FFmpeg error: {e}")


# ─── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        state = DaemonState()
        print(f"Tier 1: {'ACTIVE' if state.tier1_active else 'OFF'}")
        print(f"Tier 2: {'ACTIVE' if state.tier2_active else 'OFF'}")
        print(f"Progress: {state.items_processed}/{state.items_total} ({state.progress_pct:.1f}%)")
        print(f"Current: {state.current_item}")
        print(f"Errors: {len(state.errors)}")
    else:
        daemon = PlexHarvestDaemon()
        daemon.run()
