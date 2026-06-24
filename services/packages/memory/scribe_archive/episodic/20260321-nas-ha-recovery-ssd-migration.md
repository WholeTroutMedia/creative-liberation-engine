# 2026-03-21 — NAS Docker SSD Migration: Home Assistant Recovery

**Session:** Home Assistant config lost after Synology SSD migration  
**Agents:** ANTIGRAVITY (Antigravity)  
**Duration:** ~6 hours (avoidable — should have been 10 minutes)

## What Happened

SSD migration moved Docker data root from `/volume1/@docker` to `/volume2/@docker`. The old genesis_homeassistant_data Docker volume remained on volume1 but Docker was reconfigured to use volume2 exclusively. HA booted fresh on volume2 with no integrations.

HA config included: Honeywell Lyric T6 Pro thermostat, LG webOS TV OLED77G1PUA, Oasis Mini (custom `oasis_mini` integration), Philips Hue, Sonos, and scenes/automations.

## Root Cause of Recovery Delay

**The data was on volume1 the entire time** at:
```
/volume1/@docker/volumes/genesis_homeassistant_data/_data/.storage/
```

The correct SSH access method that WORKS:
```powershell
ssh -tt nas-admin "echo 'PASSWORD' | sudo -S cat '/volume1/@docker/volumes/genesis_homeassistant_data/_data/.storage/core.config_entries'"
```

The method that FAILS (used for most of the recovery):
```powershell
# Piping scripts via base64 mangles paths containing @docker
$b64 = [Convert]::ToBase64String(...)
ssh nas-admin "echo $b64 | base64 -d > /tmp/script.sh"
ssh -tt nas-admin "... sudo -S sh /tmp/script.sh"
# Paths with @ symbols and nested slashes resolve incorrectly
```

**Key insight:** Single-quoted paths passed directly to `ssh -tt` with `sudo -S` work correctly for NAS paths containing `@docker`. Never use base64-encoded scripts for NAS path access when the path contains `@docker`.

## Correct Recovery Procedure (NAS Docker SSD Migration)

1. **Find volume on old drive:**
```powershell
ssh -tt nas-admin "echo 'PASSWORD' | sudo -S ls '/volume1/@docker/volumes/genesis_homeassistant_data/_data/'"
```

2. **Stop HA:**
```powershell
ssh -tt nas-admin "echo 'PASSWORD' | sudo -S /var/packages/ContainerManager/target/usr/bin/docker stop homeassistant"
```

3. **Copy full .storage from old volume to live HA bind mount:**
```powershell
$cpScript = "#!/bin/sh`ncp -rf '/volume1/@docker/volumes/genesis_homeassistant_data/_data/.storage/.' '/app/cle-core/ha-runtime/.storage/'`necho DONE"
$b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($cpScript.Replace("`r`n","`n")))
ssh nas-admin "echo $b64 | base64 -d > /tmp/cp.sh"
ssh -tt nas-admin "echo 'PASSWORD' | sudo -S sh /tmp/cp.sh"
```

4. **Also copy config files (automations, db, blueprints, secrets):**
```powershell
ssh -tt nas-admin "echo 'PASSWORD' | sudo -S sh -c 'cp -rf /volume1/@docker/volumes/genesis_homeassistant_data/_data/. /app/cle-core/ha-runtime/'"
```

5. **Start HA:**
```powershell
ssh -tt nas-admin "echo 'PASSWORD' | sudo -S /var/packages/ContainerManager/target/usr/bin/docker start homeassistant"
```

## Devices Confirmed in Restored Config

| Device | Entity ID | Integration |
|--------|-----------|-------------|
| Honeywell Lyric T6 Pro | `climate.tstat_47de80_lyric_t6_pro_thermostat` | `honeywell` (pychromcomfort) |
| LG webOS TV OLED77G1PUA | `media_player.lg_webos_tv_oled77g1pua` | `webostv` at 192.168.2.220 |
| Oasis Mini | `media_player.side_table_living_room`, `light.side_table_living_room_led` | `oasis_mini` (custom integration) |
| Philips Hue Bridge | lights at `light.*` | `hue` at 192.168.2.144 |
| Sonos | `media_player.living_room`, `media_player.main_bedroom`, `media_player.optimum_stream` | `sonos` |

## Key Infrastructure Facts

- **NAS HA config path (live):** `/app/cle-core/ha-runtime/`
- **HA container name:** `homeassistant`
- **Docker binary:** `/var/packages/ContainerManager/target/usr/bin/docker`
- **NAS Docker root (post-migration):** `/volume2/@docker`
- **NAS Docker root (pre-migration / old data):** `/volume1/@docker`
- **Philips Hue bridge IP:** `192.168.2.144` (ID: `ecb5fafffeb0ca55`)
- **LG TV IP:** `192.168.2.220` (MAC: `94:9f:3e:08:94:c0`)

## Lesson

**Never spend more than 5 minutes searching brain logs or git history for NAS runtime config.** NAS Docker volumes survive migrations intact on the old volume path. Check `volume1/@docker/volumes/<name>/_data/` first using direct `ssh -tt` with single-quoted paths. The data will be there.
