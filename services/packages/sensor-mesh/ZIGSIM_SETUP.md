# ZigSim Pro Setup Guide â€” ANTITRUST Living Sensor Mesh

> **Tier 0 â€” THE MIRROR**: Your face controls the MetaHuman in real-time.  
> ZigSim Pro â†’ ZigSimBridge (Node.js) â†’ SomaticBridge â†’ UE5 MetaHuman

---

## What You Need

- **iPhone** with **ZigSim Pro** installed ([App Store](https://apps.apple.com/app/zigsim-pro/id1127760300))
- Both devices on the same WiFi network
- Node.js 20+ on your Mac/PC running the Creative Liberation Engine

---

## App Configuration

Open **ZigSim Pro** on your iPhone and configure:

### Settings â†’ Basic

| Setting | Value |
|---------|-------|
| Protocol | OSC |
| Port | `5010` |
| IP Address | *(your Mac/PC LAN IP, e.g. `127.0.0.1`)* |
| Message Format | OSC |
| Framerate | `60` |

### Settings â†’ Data â€” Enable These Channels

| Channel | Why |
|---------|-----|
| **AR FACE** | 52 ARKit blendshapes â€” the full face mirror |
| **GYROSCOPE** | Head rotation (pitch, yaw, roll) |
| **ACCELEROMETER** | Motion intensity |
| **ATTITUDE** | Absolute orientation (quaternion) |

> Disable everything else to maximize framerate and minimize latency.

### Settings â†’ AR Face

- **Enable Face Tracking**: ON
- **Send all 52 blendshapes**: ON (default)

---

## Running the Bridge

```bash
# From creative-liberation-engine-v5 root
npx ts-node packages/sensor-mesh/src/ZigSimBridge.ts
```

Or via the package script:

```bash
cd packages/sensor-mesh
npm run mirror
```

**Expected output:**

```
[zigsim-bridge] ðŸ‘ï¸  ZigSim Mirror: listening :5010 â†’ relay :5005
[zigsim-bridge] ðŸ“¡ ZigSim connected from 192.168.2.X
[zigsim-bridge] âœ¨ Frame relayed â€” jaw: 0.23, browInnerUp: 0.12
```

---

## ZigSim Channel â†’ ARKit Blendshape Map

ZigSim Pro sends OSC messages with these addresses:

```
/zigsim/<device-uid>/arface/eyeBlinkLeft      â†’ EyeBlinkLeft
/zigsim/<device-uid>/arface/eyeBlinkRight     â†’ EyeBlinkRight
/zigsim/<device-uid>/arface/jawOpen           â†’ JawOpen
/zigsim/<device-uid>/arface/mouthSmileLeft    â†’ MouthSmileLeft
... (all 52 ARKit blendshapes)

/zigsim/<device-uid>/gyro                     â†’ [x, y, z] radians/s
/zigsim/<device-uid>/accel                    â†’ [x, y, z] m/sÂ²
/zigsim/<device-uid>/attitude                 â†’ [roll, pitch, yaw] radians
```

The `ZigSimBridge` remaps all of these to SomaticBridge format:

```
/sl/rig_param/EyeBlinkLeft 0.73
/sl/rig_param/JawOpen 0.45
...
```

---

## Latency Expectations

| Stage | Latency |
|-------|---------|
| iPhone â†’ Mac/PC (WiFi) | ~1â€“3ms |
| ZigSimBridge processing | <1ms |
| SomaticBridge â†’ UE5 | ~2â€“4ms |
| **Total glass-to-MetaHuman** | **~4â€“8ms** |

This is well within the 16ms frame budget for 60fps MetaHuman animation.

---

## Troubleshooting

**Bridge doesn't receive data:**

- Confirm your Mac/PC IP in ZigSim matches your actual LAN IP: `ipconfig` (Windows) / `ifconfig | grep inet` (Mac)
- Check that port 5010 is not firewalled (`netsh advfirewall firewall show rule name=all` on Windows)
- Try disabling Windows Defender Firewall temporarily to verify

**High latency / frame drops:**

- Reduce ZigSim framerate from 60 â†’ 30 temporarily
- Ensure both devices are on 5GHz WiFi (not 2.4GHz)
- Close other apps on iPhone

**MetaHuman not responding:**

- Confirm SomaticBridge is running: `curl http://localhost:6060/health`
- Confirm UE5 MetaHuman has LiveLink source connected to `localhost:5005`
