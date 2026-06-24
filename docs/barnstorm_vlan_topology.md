# Sovereign Compute Farm: VLAN Topology & Architecture

## Objective
To establish a strict network topology for The Barnstorm's Sovereign Compute Farm that guarantees absolute client data sanctity while safely enabling shared compute pooling for the studio's internal operations.

## Core Tenets
1. **Air-Gapped by Design**: Client compute nodes cannot communicate with each other.
2. **Zero-Trust Access**: External connections must be authenticated via reverse proxy and strict firewall rules.
3. **Data Sanctity**: Client data must never touch studio infrastructure, and studio data must never touch client infrastructure.
4. **Compute Pooling**: Idle compute cycles can be securely routed to studio tasks without compromising the data layer.

## VLAN Topology Map

### Management VLAN (VLAN 10)
- **Subnet**: `10.0.10.0/24`
- **Purpose**: Infrastructure management, UniFi Controller, Out-of-Band (OOB) access.
- **Access**: Strictly restricted to Barnstorm IT Admins. No internet exposure.

### Barnstorm Studio VLAN (VLAN 20)
- **Subnet**: `10.0.20.0/24`
- **Purpose**: Internal studio operations, Creative Liberation Engine NAS (`127.0.0.1`), office workstations.
- **Access**: Full internet access, restricted inter-VLAN routing (can access Client Nodes on specific inference ports only).

### Client Node Isolation VLANs (VLAN 100 - 199)
- **Subnets**: `10.0.10X.0/24` (One dedicated VLAN per client).
- **Purpose**: Total isolation for each client's M-Series Pro Mac Mini node.
- **Access Policies**:
  - **Egress**: Restricted internet access (only allowed to pull specific Docker images/updates via proxy).
  - **Ingress**: External access mapped via Cloudflare Tunnels directly to the specific node's local inference API.
  - **Inter-VLAN**: Strictly denied. VLAN 101 cannot see VLAN 102.
  - **Data Layer**: Local SSD only. No SMB/NFS access to the Barnstorm NAS.

### Compute Pooling Sub-Net (VLAN 50)
- **Subnet**: `10.0.50.0/24`
- **Purpose**: A secure, read-only bridge network used for the Barnstorm Studio to distribute anonymous compute tasks (e.g., rendering, batch processing) to idle Client Nodes.
- **Mechanism**: Nodes expose a restricted worker API on this VLAN. Studio tasks are pushed here. The node processes the task and returns the result, never gaining access to the Studio VLAN.

## Infrastructure Stack (Company in a Box)
Each client receives the following stack within their isolated VLAN:
- **Hardware**: M-Series Pro Mac Mini
- **Network Interface**: Tagged dynamically to their designated VLAN via the managed switch port.
- **Ingress**: Cloudflared daemon running locally to expose their sovereign UI/API to the client's custom domain securely.
- **Inference**: Ollama / MLX bound only to `localhost` and the Cloudflare Tunnel interface, preventing unauthorized local network scraping.

## Firewall Rules Summary
1. `ALLOW` Admin VPN -> VLAN 10 (Management)
2. `DROP` VLAN 100-199 -> ALL (Isolate clients from everything)
3. `ALLOW` VLAN 100-199 -> Gateway (Port 80/443 for updates/tunnels only)
4. `ALLOW` VLAN 20 -> VLAN 50 (Studio can push tasks to Pooling Net)
5. `ALLOW` VLAN 50 -> VLAN 100-199 (Port 5050 only - Worker Task API)
6. `DROP` ALL -> ALL (Default Deny)
