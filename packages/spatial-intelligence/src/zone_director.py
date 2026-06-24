"""
zone_director.py
Helix B: The Spatial Intelligence Zone Director

This module consumes raw spatial presence streams (e.g., from ESP32 Bluetooth Proxies or Unifi)
and maps them against the logical zones of the physical environment (Living Room, Kitchen, Office).

It determines room occupancy, triggers lighting/av scenes, and manages the spatial state.
"""

import time
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass, field

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("ZoneDirector")


@dataclass
class EntityState:
    entity_id: str
    current_zone: Optional[str] = None
    last_seen: float = 0.0
    confidence: float = 0.0


@dataclass
class SpatialZone:
    zone_id: str
    name: str
    entities_present: set = field(default_factory=set)


class ZoneDirector:
    def __init__(self):
        self.zones: Dict[str, SpatialZone] = {
            "living_room": SpatialZone("living_room", "Living Room"),
            "office": SpatialZone("office", "Artist's Office"),
            "kitchen": SpatialZone("kitchen", "Kitchen"),
            "exterior": SpatialZone("exterior", "Exterior"),
        }
        self.entities: Dict[str, EntityState] = {}
        logger.info("Zone Director initialized with %d zones.", len(self.zones))

    def process_telemetry(self, telemetry: Dict[str, Any]):
        """
        Process incoming raw telemetry from the Spatial Mesh.
        Expected format: {"entity_id": "mac-address", "node_id": "esp32-living-room", "rssi": -65}
        """
        entity_id = telemetry.get("entity_id")
        node_id = telemetry.get("node_id")
        rssi = telemetry.get("rssi", -100)

        if not entity_id or not node_id:
            logger.debug("Dropped malformed telemetry payload")
            return

        # Simple mapping: node_id prefix to zone_id
        target_zone = None
        for zid in self.zones.keys():
            if zid in node_id:
                target_zone = zid
                break

        if not target_zone:
            target_zone = "exterior"  # Fallback

        if entity_id not in self.entities:
            self.entities[entity_id] = EntityState(entity_id=entity_id)

        state = self.entities[entity_id]
        state.last_seen = time.time()

        # Determine if the signal is strong enough to consider "present" in the zone
        if rssi > -80:
            self._transition_entity(state, target_zone)

    def _transition_entity(self, state: EntityState, new_zone: str):
        if state.current_zone == new_zone:
            return  # No change

        old_zone = state.current_zone

        if old_zone and old_zone in self.zones:
            self.zones[old_zone].entities_present.discard(state.entity_id)
            logger.info("Entity %s exited %s", state.entity_id, old_zone)

        state.current_zone = new_zone
        self.zones[new_zone].entities_present.add(state.entity_id)
        logger.info("Entity %s entered %s", state.entity_id, new_zone)

        # Trigger reactive pipelines (e.g. lighting, AV)
        self._dispatch_zone_event(state.entity_id, old_zone, new_zone)

    def _dispatch_zone_event(self, entity_id: str, from_zone: Optional[str], to_zone: str):
        # In production this would publish to Redis Pub/Sub or gRPC
        logger.info(
            "DISPATCH: presence_changed | entity=%s | from=%s | to=%s",
            entity_id,
            from_zone,
            to_zone,
        )

    def cleanup_stale_entities(self, timeout_sec: float = 60.0):
        now = time.time()
        stale = []
        for eid, state in self.entities.items():
            if now - state.last_seen > timeout_sec:
                stale.append(eid)

        for eid in stale:
            state = self.entities[eid]
            old_zone = state.current_zone
            if old_zone and old_zone in self.zones:
                self.zones[old_zone].entities_present.discard(eid)
            del self.entities[eid]
            logger.info("Entity %s timed out. Removed from spatial tracking.", eid)


if __name__ == "__main__":
    director = ZoneDirector()
    director.process_telemetry(
        {"entity_id": "iphone-justin", "node_id": "esp32-office", "rssi": -60}
    )
