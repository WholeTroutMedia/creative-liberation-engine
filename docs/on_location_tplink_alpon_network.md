# On-Location Network Blueprint: TP-Link Roam 7 & Alpon X5

This document outlines the canonical network configuration for the **TP-Link Roam 7 (TL-WR3602BE)** Wi-Fi 7 travel router when deployed on location as the edge gateway for the **Alpon X5 AI** edge compute node.

---

## 🌐 Network Topology Map

```
  [ Cameras / POV Glasses ]  <-- Wi-Fi 7 MLO (10.0.60.0/24) -->  [ TP-Link Roam 7 ]
                                                                       |
  [ Mobile / Controller ]    <-- Wi-Fi 7 MLO (10.0.60.0/24) -->  [   (10.0.60.1)   ]
                                                                       |
  [ Alpon X5 Edge Node ]     <-- 1 Gbps Direct Ethernet ------>  [  (10.0.60.5)    ]
                                                                       |
                                                           [ WireGuard VPN Client ]
                                                                       |
  [ Studio NAS (127.0.0.1) ] <==== Split-Tunnel VPN ======[ Public WAN/Cellular ]
```

---

## 📋 IP Addressing Schema & Interfaces

| Interface | Type | IP Assignment | Role / Description |
| :--- | :--- | :--- | :--- |
| **TP-Link Router LAN** | Gateway | `10.0.60.1` | Local gateway for on-location subnet |
| **Alpon X5 Eth0** | Wired LAN | `10.0.60.5` | Edge compute / media ingestion server (Static DHCP) |
| **Wi-Fi SSID** | Wireless | Dynamic (`10.0.60.10-99`) | `CLE-EDGE-MESH` (WPA3-Personal) |
| **USB 3.0 Port** | Cellular WAN | Dynamic | Reserved for 4G/5G phone tethering or cellular dongle |
| **2.5G WAN Port** | Wired WAN | Dynamic | Primary high-speed backhaul (hotel, studio, fiber) |
| **WireGuard Interface** | Virtual Tunnel| `10.0.254.6` | Tunnel client IP assigned by home studio VPN server |

---

## 🛠️ Step-by-Step Configuration Guide

### Step 1: Local Subnet & DHCP Setup
1. Log into the TP-Link administration console.
2. Navigate to **Advanced > Network > LAN**.
3. Change the IP Address to **`10.0.60.1`** (Subnet Mask: `255.255.255.0`). Save and let the router reboot.
4. Navigate to **DHCP Server** and set the IP Address Pool to `10.0.60.10` - `10.0.60.99`.
5. Under **Address Reservation**, add the Alpon X5's Ethernet MAC address and bind it to **`10.0.60.5`**.

### Step 2: Wi-Fi 7 Wireless Configuration
1. Navigate to **Wireless Settings**.
2. Set SSID to **`CLE-EDGE-MESH`**.
3. Enable **Multi-Link Operation (MLO)**. This allows Wi-Fi 7-compatible devices (drones, modern mobile endpoints, cameras) to connect to both 2.4 GHz and 5 GHz bands simultaneously, maximizing throughput and minimizing transmission latency for raw file uploads.
4. Set Security to **WPA3-Personal** (WPA3-SAE) to ensure maximum wireless transit security.

### Step 3: WireGuard VPN Configuration (Split-Tunneling)
To route logs and proxy files to the Synology NAS while letting heavy internet traffic egress locally, configure **Split-Tunneling**:

1. Generate a WireGuard client configuration profile on the main Synology NAS / Home Studio VPN Server.
2. Under **VPN Client > WireGuard** on the TP-Link router, import the profile.
3. Edit the config file's **Allowed IPs** section:
   ```ini
   # ONLY route the Synology NAS and home studio subnet through the VPN
   AllowedIPs = 192.168.2.0/24, 10.0.20.0/24, 10.0.254.0/24
   ```
4. Verify the tunnel is active and that the Alpon X5 can ping `127.0.0.1`.

### Step 4: Edge Ingest Routing Configuration
1. On the Alpon X5, configure the **`CAMERA_INGEST`** daemon to listen for FTP/SFTP uploads on `10.0.60.5:21` (FTP) or `10.0.60.5:22` (SFTP).
2. Configure on-location cameras/devices to target `10.0.60.5` for immediate local media uploads.
3. Set the Alpon's sync daemon to push proxy outputs through the WireGuard interface to the Synology NAS dropzone (`\\127.0.0.1\docker\genesis-deploy\runtime\ingestion\dropzone`).

---

## 🔋 Power Management in the Field
* The TP-Link Roam 7 Wi-Fi 7 chipset has a higher peak power consumption than older Wi-Fi 6 travel routers.
* **Requirements:** Utilize a **USB-C PD power bank** capable of outputting a constant **30W (15V/2A or 20V/1.5A)**.
* Standard phone chargers or low-output power banks will cause the router to brown out and drop Wi-Fi connections when transferring large video files from cameras.
