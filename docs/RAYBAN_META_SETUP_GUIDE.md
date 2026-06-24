# 🕶️ Setup Guide: Connecting Ray-Ban Meta Smart Glasses
## Creative Liberation Engine V6 Spatial Activation Checklist

> **Author:** AVERI (ATHENA / VERA / IRIS)  
> **Stance:** INFRASTRUCTURE / DEVOPS | **Priority:** Critical  
> **Target Document:** [RAYBAN_META_SETUP_GUIDE.md](file:///y:/creative-liberation-engine/docs/RAYBAN_META_SETUP_GUIDE.md)  
> **Objective:** Walk through the exact hardware, software, and network routing configurations required to connect a physical pair of Ray-Ban Meta Smart Glasses to the live CLE Spatial OS Bridge.

---

## Phase 1: Hardware & Device Registration

### Step 1: Activate Wearables Developer Mode
Before the glasses can load custom third-party URLs or communicate with local WebSocket ports, you must unlock developer privileges inside Meta's ecosystem:
1. Ensure the glasses are turned on, paired, and actively connected to your smartphone via the **Meta View** app.
2. Open the **Meta View** app on your phone.
3. Tap **Settings** (gear icon in the bottom right corner).
4. Select your active **Smart Glasses** device.
5. Scroll down to the bottom and locate the **App Version** (or About) field.
6. **Tap the App Version number 7 to 10 times in rapid succession.**
7. A toast notification will appear saying *"Developer Mode Enabled"*.
8. Navigate back to Settings—you will now see a new menu item titled **Developer Options** or **Wearables Developer Options**.

### Step 2: Register on the Meta Wearables Portal
1. On your desktop or phone browser, navigate to the [Meta Wearables Developer Center](https://wearables.developer.meta.com/).
2. Log in using the **exact same Meta / Facebook account** that is registered to your Meta View smartphone app.
3. Accept the Wearables Developer Agreement. This registers your account as a developer, unlocking the device's capability to load the custom URLs configured in Phase 3.

---

## Phase 2: Secure Network Tunneling (HTTPS / WSS)

> [!IMPORTANT]
> **Strict HTTPS Enforcement:** The Ray-Ban Meta glasses security firmware **strictly rejects** unencrypted local connections (`http://` or `ws://`). The glasses will only communicate with secure SSL endpoints (`https://` and `wss://`).

To route the glasses securely to the local CLE Spatial OS server running on **port 5106**, we must wrap it in a secure SSL tunnel.

### Option A: Standard local ngrok Tunnel (Fastest for testing)
If ngrok is installed on your workstation, run this single PowerShell command to expose the local port securely:
```powershell
ngrok http 5106
```
ngrok will output a secure URL. Copy the `https://...` address. 
* *Example:* `https://a1b2-cd34.ngrok-free.app`
* *Corresponding WebSocket:* `wss://a1b2-cd34.ngrok-free.app/spatial/ws`

### Option B: Local SSL Proxy (Self-Signed CA)
If you want to keep all traffic completely off the public internet within the local VLAN mesh:
1. Generate a local SSL certificate using `mkcert` matching your NAS domain name.
2. Configure a local Nginx secure reverse-proxy mapping port `443` to local `5106`, serving the generated cert.

---

## Phase 3: Web App Registration & Handshake

### Step 1: Register the CLE Thin-Client URL
1. Open the **Meta View** app on your phone.
2. Enter **Developer Options** under settings.
3. Locate the field titled **Development Web App URL**.
4. Enter the secure HTTPS URL pointing to the CLE Spatial OS Bridge Server (Option A or B from Phase 2).
5. Tap **Save & Sync**. The Meta View app will push the URL configuration to the glasses over the local Bluetooth/Wi-Fi connection.

### Step 2: Establish the Live Handshake
1. Put the glasses on.
2. Launch the Development Web App using the designated Meta wearable gesture (default: tap-and-hold the frame side touchpad, or swipe, or say *"Hey Meta, open Development App"*).
3. The glasses will immediately query the secure WebSocket gateway at `wss://<your-tunnel-url>/spatial/ws`.
4. The CLE server will register the new device under ID `GLASSES` and instantly push the **neon-green IDLE layout** to the in-lens display.
5. You are now live. Speak any command (*"CLE, index visual"* or double-tap the frame) to trigger real-time sovereign pipelines.
