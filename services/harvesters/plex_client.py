#!/usr/bin/env python3
"""
Plex Client — CLE Academy API Layer
==========================================
Sovereign Plex Media Server integration for the Creative Liberation Engine.
Handles auth, library discovery, metadata, subtitles, stream URLs.
Phase 1 of the Cortex x Plex integration.
"""
from __future__ import annotations

import json, os, time, logging, ssl, urllib.request, urllib.error

# Plex servers use self-signed certs — skip verification
_PLEX_SSL_CTX = ssl.create_default_context()
_PLEX_SSL_CTX.check_hostname = False
_PLEX_SSL_CTX.verify_mode = ssl.CERT_NONE
from dataclasses import dataclass, field, asdict
from typing import Optional

PLEX_API_URL = "https://plex.tv/api/v2"
PLEX_AUTH_URL = f"{PLEX_API_URL}/users/signin"
PLEX_RESOURCES_URL = f"{PLEX_API_URL}/resources"
PLEX_CLIENT_ID = "cle-engine-academy"
PLEX_PRODUCT = "CLE Academy"
PLEX_VERSION = "1.0.0"
ACADEMY_BASE = "/volume1/cle/academy"

logger = logging.getLogger("PlexClient")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s — %(message)s'))
    logger.addHandler(ch)

@dataclass
class PlexServer:
    name: str
    client_id: str
    access_token: str
    connections: list = field(default_factory=list)
    owned: bool = False
    @property
    def best_uri(self) -> Optional[str]:
        """Pick the best reachable URI.
        Priority for shared (remote) servers:
          1. External non-relay (public IP, direct)
          2. Relay (Plex relay proxy, always reachable)
          3. Local LAN IPs (only reachable on same network)
        """
        def _rank(c):
            is_local = c.get("local", False)
            is_relay = c.get("relay", False)
            if not is_local and not is_relay:
                return 0  # External direct — best
            if is_relay:
                return 1  # Relay — fallback, always works
            return 2  # Local — only same LAN
        for conn in sorted(self.connections, key=_rank):
            if uri := conn.get('uri', ''):
                return uri
        return None

@dataclass
class PlexMediaItem:
    rating_key: str
    title: str
    year: Optional[int] = None
    summary: str = ""
    content_rating: str = ""
    duration_ms: int = 0
    studio: str = ""
    genre: str = ""
    director: str = ""
    media_type: str = ""
    thumb_url: str = ""
    added_at: int = 0
    library_section: str = ""
    has_subtitles: bool = False
    subtitle_streams: list = field(default_factory=list)
    @property
    def duration_minutes(self) -> float:
        return self.duration_ms / 60000 if self.duration_ms else 0
    def to_dict(self) -> dict:
        return asdict(self)

def _load_env(key: str) -> Optional[str]:
    """Load a value from .env or environment."""
    for env_path in ["/app/creative-liberation-engine/.env",
                     os.path.join(os.path.dirname(__file__), "..", "..", ".env")]:
        env_path = os.path.normpath(env_path)
        if os.path.isfile(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.strip().startswith(f"{key}="):
                        val = line.strip().split("=", 1)[1].strip()
                        if val: return val
    return os.getenv(key)

def _load_env_token() -> Optional[str]:
    return _load_env("PLEX_TOKEN")

def authenticate_with_credentials(username: str, password: str) -> str:
    """One-time auth to get X-Plex-Token from Plex credentials."""
    payload = json.dumps({"login": username, "password": password}).encode()
    headers = {"Content-Type": "application/json", "Accept": "application/json",
               "X-Plex-Client-Identifier": PLEX_CLIENT_ID, "X-Plex-Product": PLEX_PRODUCT}
    req = urllib.request.Request(PLEX_AUTH_URL, data=payload, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            token = data.get("authToken", "")
            if token:
                logger.info("[+] Plex auth successful — token obtained")
                return token
            raise RuntimeError(f"No authToken: {data}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Auth failed ({e.code}): {e.read().decode('utf-8', errors='replace')}")

class PlexClient:
    """Sovereign Plex API client for the CLE Academy."""

    def __init__(self, token: Optional[str] = None):
        self.token = token or _load_env_token()
        if not self.token:
            raise RuntimeError("No PLEX_TOKEN. Run auth first, then add PLEX_TOKEN to .env")
        self.servers: list[PlexServer] = []
        self.active_server: Optional[PlexServer] = None
        self._headers = {"Accept": "application/json", "X-Plex-Token": self.token,
                         "X-Plex-Client-Identifier": PLEX_CLIENT_ID, "X-Plex-Product": PLEX_PRODUCT}
        # Auto-connect from env if server URL/token are preconfigured
        self._env_server_token = _load_env("PLEX_SERVER_TOKEN")
        self._env_server_uri = _load_env("PLEX_SERVER_URL")
        self._env_machine_id = _load_env("PLEX_SERVER_ID")
        logger.info("[+] PlexClient initialized")

    def _api_get(self, url: str, timeout: int = 30) -> dict:
        req = urllib.request.Request(url, headers=self._headers)
        with urllib.request.urlopen(req, timeout=timeout, context=_PLEX_SSL_CTX) as resp:
            return json.loads(resp.read())

    def _server_get(self, path: str, timeout: int = 30) -> dict:
        if not self.active_server:
            raise RuntimeError("No active server. Call discover_servers() first.")
        url = f"{self.active_server.best_uri}{path}"
        headers = {**self._headers}
        if self.active_server.access_token:
            headers["X-Plex-Token"] = self.active_server.access_token
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout, context=_PLEX_SSL_CTX) as resp:
            return json.loads(resp.read())

    def discover_servers(self) -> list[PlexServer]:
        logger.info("[*] Discovering Plex servers...")
        # Try env-configured direct connection first
        if self._env_server_uri and self._env_server_token:
            logger.info("[+] Using pre-configured server connection")
            srv = PlexServer(
                name="SPAD-PLEX",
                client_id=self._env_machine_id or "preconfigured",
                access_token=self._env_server_token,
                connections=[{"uri": self._env_server_uri, "local": False, "relay": False}],
                owned=False
            )
            self.servers = [srv]
            self.active_server = srv
            logger.info(f"[+] Direct connect: {srv.name} @ {self._env_server_uri}")
            return self.servers

        # Fallback: resource discovery via plex.tv API
        data = self._api_get(f"{PLEX_RESOURCES_URL}?includeHttps=1&includeRelay=1")
        self.servers = []
        for r in (data if isinstance(data, list) else []):
            if "server" not in r.get("provides", ""): continue
            srv = PlexServer(name=r.get("name",""), client_id=r.get("clientIdentifier",""),
                           access_token=r.get("accessToken", self.token),
                           connections=r.get("connections",[]), owned=r.get("owned", False))
            self.servers.append(srv)
            logger.info(f"  [+] {srv.name} ({'owned' if srv.owned else 'shared'}) — {len(srv.connections)} conns")
        if self.servers:
            self.active_server = self.servers[0]
            logger.info(f"[+] Active: {self.active_server.name}")
        return self.servers

    def get_libraries(self) -> list[dict]:
        data = self._server_get("/library/sections")
        libs = []
        for s in data.get("MediaContainer",{}).get("Directory",[]):
            libs.append({"key": s.get("key",""), "title": s.get("title",""),
                        "type": s.get("type",""), "count": s.get("count",0)})
            logger.info(f"  [+] {s.get('title')} ({s.get('type')}) — {s.get('count',0)} items")
        return libs

    def get_library_items(self, section_key: str, start: int = 0, size: int = 100) -> list[PlexMediaItem]:
        data = self._server_get(f"/library/sections/{section_key}/all?X-Plex-Container-Start={start}&X-Plex-Container-Size={size}")
        return [self._parse_meta(m, section_key) for m in data.get("MediaContainer",{}).get("Metadata",[])]

    def get_all_library_items(self, section_key: str) -> list[PlexMediaItem]:
        all_items, offset = [], 0
        while True:
            batch = self.get_library_items(section_key, start=offset)
            if not batch: break
            all_items.extend(batch)
            offset += len(batch)
            if len(batch) < 100: break
            time.sleep(0.5)
        logger.info(f"[+] Total in section {section_key}: {len(all_items)}")
        return all_items

    def get_subtitles(self, rating_key: str) -> list[dict]:
        data = self._server_get(f"/library/metadata/{rating_key}")
        subs = []
        for m in data.get("MediaContainer",{}).get("Metadata",[]):
            for media in m.get("Media",[]):
                for part in media.get("Part",[]):
                    for s in part.get("Stream",[]):
                        if s.get("streamType") == 3:
                            subs.append({"id": s.get("id",""), "language": s.get("language",""),
                                        "codec": s.get("codec",""), "key": s.get("key",""),
                                        "selected": s.get("selected", False)})
        return subs

    def download_subtitle(self, rating_key: str, sub_key: str, out_dir: str = None) -> str:
        out_dir = out_dir or f"{ACADEMY_BASE}/dialogue"
        url = f"{self.active_server.best_uri}{sub_key}"
        headers = {**self._headers}
        if self.active_server.access_token:
            headers["X-Plex-Token"] = self.active_server.access_token
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=60) as resp:
            content = resp.read()
        ext = "ass" if ".ass" in sub_key else "vtt" if ".vtt" in sub_key else "srt"
        filepath = os.path.join(out_dir, f"{rating_key}_subtitle.{ext}")
        os.makedirs(out_dir, exist_ok=True)
        with open(filepath, "wb") as f: f.write(content)
        logger.info(f"  [+] Subtitle: {filepath} ({len(content)}B)")
        return filepath

    def get_stream_url(self, rating_key: str) -> str:
        data = self._server_get(f"/library/metadata/{rating_key}")
        for m in data.get("MediaContainer",{}).get("Metadata",[]):
            for media in m.get("Media",[]):
                for part in media.get("Part",[]):
                    if key := part.get("key",""):
                        token = self.active_server.access_token if self.active_server else self.token
                        return f"{self.active_server.best_uri}{key}?X-Plex-Token={token}"
        raise ValueError(f"No stream URL for {rating_key}")

    def export_catalog(self, output_path: str = None) -> str:
        output_path = output_path or f"{ACADEMY_BASE}/catalog/catalog.json"
        logger.info("[*] Exporting catalog...")
        catalog = {"server": self.active_server.name if self.active_server else "",
                   "exported_at": int(time.time()), "libraries": []}
        for lib in self.get_libraries():
            lib_data = {**lib, "items": []}
            if lib["type"] in ("movie", "show"):
                items = self.get_all_library_items(lib["key"])
                lib_data["items"] = [i.to_dict() for i in items]
            catalog["libraries"].append(lib_data)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w") as f: json.dump(catalog, f, indent=2)
        total = sum(len(l["items"]) for l in catalog["libraries"])
        logger.info(f"[+] Catalog: {total} items → {output_path}")
        return output_path

    def _parse_meta(self, m: dict, section: str = "") -> PlexMediaItem:
        dirs = ", ".join(d.get("tag","") for d in m.get("Director",[])) if m.get("Director") else ""
        genres = ", ".join(g.get("tag","") for g in m.get("Genre",[])) if m.get("Genre") else ""
        has_subs, sub_s = False, []
        for media in m.get("Media",[]):
            for part in media.get("Part",[]):
                for s in part.get("Stream",[]):
                    if s.get("streamType") == 3:
                        has_subs = True
                        sub_s.append({"language": s.get("language",""), "codec": s.get("codec","")})
        return PlexMediaItem(rating_key=str(m.get("ratingKey","")), title=m.get("title",""),
            year=m.get("year"), summary=m.get("summary",""), content_rating=m.get("contentRating",""),
            duration_ms=m.get("duration",0), studio=m.get("studio",""), genre=genres, director=dirs,
            media_type=m.get("type",""), thumb_url=m.get("thumb",""), added_at=m.get("addedAt",0),
            library_section=section, has_subtitles=has_subs, subtitle_streams=sub_s)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "auth":
        if len(sys.argv) < 4: print("Usage: plex_client.py auth <user> <pass>"); sys.exit(1)
        token = authenticate_with_credentials(sys.argv[2], sys.argv[3])
        print(f"\nPLEX_TOKEN={token}\n→ Add to /app/creative-liberation-engine/.env")
    else:
        client = PlexClient()
        servers = client.discover_servers()
        if servers:
            libs = client.get_libraries()
            for l in libs: print(f"  • {l['title']} ({l['type']}) — {l['count']} items")
            client.export_catalog()
