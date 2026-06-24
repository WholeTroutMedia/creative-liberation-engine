import asyncio
import logging
import signal
import os

from watchers.notebooklm import NotebookLMWatcher
from watchers.drive import DriveWatcher
from watchers.stitch import StitchWatcher
from watchers.spaitial import SpaitialWatcher

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("CortexOmniWatcher")


def _reap_zombies(signum=None, frame=None):
    """Reap all zombie child processes to prevent accumulation.
    
    Playwright spawns Node.js driver subprocesses. When those exit,
    the kernel keeps them as zombies until the parent calls waitpid().
    This handler ensures we always clean them up.
    """
    while True:
        try:
            pid, status = os.waitpid(-1, os.WNOHANG)
            if pid == 0:
                break
            logger.debug(f"Reaped zombie child PID {pid} (status {status})")
        except ChildProcessError:
            # No more children to reap
            break


async def periodic_reaper(interval=30):
    """Background task that periodically reaps zombie processes.
    
    Belt-and-suspenders: even if SIGCHLD is missed (e.g. during an
    asyncio event loop tick), this sweeps up stragglers every 30s.
    """
    while True:
        _reap_zombies()
        await asyncio.sleep(interval)


async def main():
    logger.info("INIT: CORTEX Omni-Watcher Booting...")
    logger.info("MISSION: Total omni-presence across Google Services for user: jaharoni")
    
    # Install SIGCHLD handler to auto-reap zombie children
    signal.signal(signal.SIGCHLD, _reap_zombies)
    logger.info("Installed SIGCHLD zombie reaper.")
    
    # Initialize all autonomous watchers
    notebook_watcher = NotebookLMWatcher(poll_interval=60)
    drive_watcher = DriveWatcher(poll_interval=120)
    stitch_watcher = StitchWatcher(poll_interval=300)
    spaitial_watcher = SpaitialWatcher(poll_interval=180)
    
    logger.info("Spawning watcher tasks...")
    
    # Run polling loops concurrently, with a periodic zombie reaper
    await asyncio.gather(
        notebook_watcher.start(),
        drive_watcher.start(),
        stitch_watcher.start(),
        spaitial_watcher.start(),
        periodic_reaper(interval=30),
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Omni-Watcher terminated by user.")
