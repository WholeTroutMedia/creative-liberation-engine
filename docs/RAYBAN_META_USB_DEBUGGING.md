# 🔌 Developer Guide: Direct USB (ADB) & Bluetooth Integration
## Ray-Ban Meta Hardware Debugging & Local Compute Routing

> **Author:** AVERI (ATHENA / VERA / IRIS)  
> **Stance:** INFRASTRUCTURE / DEVOPS | **Priority:** High  
> **Target Document:** [RAYBAN_META_USB_DEBUGGING.md](file:///y:/creative-liberation-engine/docs/RAYBAN_META_USB_DEBUGGING.md)  
> **Strategic Goal:** Maximize physical USB-C and Bluetooth connections to bypass the smartphone mobile relay, achieving direct glasses-to-workstation telemetry and ultra-low-latency media processing.

---

## 1. Direct USB Interface: ADB & AOSP Shell Access

The Ray-Ban Meta glasses run on a customized version of the **Android Open Source Project (AOSP)** operating system, powered by the Qualcomm Snapdragon AR1 Gen 1 platform. 

When you place the glasses in their charging case and connect the case via a USB-C cable directly to your PC or Mac, the device exposes standard **Android Debug Bridge (ADB)** interface commands (provided Developer Mode is enabled in your Meta View app).

```
[ Workstation / PC ] ◄───(USB-C Cable)───► [ Charging Case ] ◄───(Pogo Pins)───► [ Ray-Ban Meta Glasses ]
- ADB shell access                                                                - Custom AOSP Android OS
- Real-time Logcat stream                                                         - Qualcomm Snapdragon AR1
- Blazing-fast Media Extraction (/sdcard/)                                        - Local WebSocket client
```

### A. Core ADB Command Operations

Open a PowerShell terminal on your workstation and verify connection:
```powershell
adb devices
```
*If successful, your smart glasses serial number will list as `device`.*

#### 1. Real-Time Telemetry Tailing (Logcat)
To debug WebRTC handshakes, WebSocket dropouts, or layout rendering speeds inside the glasses' web view, stream the live Android OS diagnostic log:
```powershell
adb logcat *:S CLESpatialOSBridge:D Chromium:I
```
*(Filters logcat to only show CLE spatial logs and Chromium web engine outputs, keeping noise low).*

#### 2. Direct Media Extraction (Bypassing App Wireless Sync)
Instead of waiting for slow Wi-Fi transfers over the Meta View app to extract raw POV video or high-res photos:
```powershell
# Pull all raw media directly to the workstation at full USB-C speeds
adb pull /sdcard/DCIM/Camera/ "d:\Google Antigravity\media_intake\"
```

#### 3. Terminal Shell Access
Gain full control of the underlying Linux environment inside the glasses:
```powershell
adb shell
```
*Once inside the shell, you can monitor running system services, check RAM usage, or inspect stored cookie files for the Web App.*

#### 4. Sideloading Custom Services
Since the glasses run Android, developers can sideload custom background service `.apk` packages directly:
```powershell
adb install -r custom_spatial_sensor_receiver.apk
```

---

## 2. Direct Bluetooth Interface: Acoustic & BLE Telemetry

By pairing the smart glasses directly to your **Workstation PC / NAS host** via Bluetooth (completely bypassing the smartphone relay), you unlock immediate low-latency local execution:

```
[ Ray-Ban Meta Glasses ] ◄───(BLE / Audio Sink)───► [ Workstation Bluetooth Adapter ]
- Dual Acoustic Microphones                         - local Whisper (Acoustic Mesh)
- Touchpad & Frame Sensors                          - BLE GATT Client Node (Node.js)
```

### A. The Direct Acoustic Pipeline (Workstation Whisper Integration)
The glasses contain a high-quality dual-microphone array. When paired via Bluetooth:
1. The glasses register as a standard Bluetooth Audio Input Device on your workstation.
2. We configure our local **Acoustic Mesh** (running local Whisper on the Ryzen/RTX 4090) to listen directly to that audio interface.
3. **Execution:** You speak naturally. The raw audio stream goes *directly* from the glasses over Bluetooth to your 4090, achieving sub-100ms voice command parsing and completely bypassing mobile network latency.

### B. BLE GATT Sniffing (Node.js Telemetry)
We can run a lightweight Node.js script on the workstation (using libraries like `noble`) to connect to the glasses' **Bluetooth Low Energy (BLE) GATT profile**:
* **Gesture Triggers:** Listen for touchpad gestures (swipes, taps) and physical button clicks directly on the workstation.
* **Wear Detection:** Listen for changes in the glasses' proximity sensor (automatically pausing agentic workflows or layout streams the moment you take the glasses off).
* **Battery State:** Pull live battery levels directly into our Prometheus/NEXUS telemetry matrix.

---

> [!TIP]
> **Developer Setup Recommendation:** For optimal development, keep the charging case connected via USB-C to your PC with `adb logcat` running in a terminal pane, while pairing the glasses via Bluetooth to the PC to test hands-free voice commands. This gives you a high-velocity feedback loop.
