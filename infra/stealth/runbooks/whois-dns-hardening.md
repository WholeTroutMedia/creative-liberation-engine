# ═══════════════════════════════════════════════════════════════════════════════

# SOVEREIGN STEALTH RUNBOOK — T-STEALTH-004

# Domain + WHOIS + DNS + Email Hardening

#

# Maintained by: AVERI / VERA

# Article IX: This runbook documents production-grade configs only

# ═══════════════════════════════════════════════════════════════════════════════

## 1 — WHOIS Privacy: Register with Zero Exposure

### Option A: Njalla (Maximum Privacy)

Njalla acts as the **legal owner** of the domain. Your name never appears in WHOIS.
They accept crypto. No real identity required.

1. Go to <https://njal.la>
2. Create account with a ProtonMail address (see §4 below)
3. Register your domain — Njalla appears as owner in WHOIS, not you
4. Njalla allows incoming connections at the DNS level via their panel
5. Payment: use Monero (XMR) or BTC for maximum plausible deniability

**Tradeoff:** Njalla has a smaller registrar footprint. If you need Cloudflare Registrar's
cost-at-wholesale pricing, use Option B.

### Option B: Cloudflare Registrar (Free WHOIS Privacy)

Cloudflare provides WHOIS privacy for free on all domains they manage.

1. Log into Cloudflare → Registrar → Transfer Domain (or register directly)
2. During registration, WHOIS privacy is automatically enabled
3. Your contact info is replaced with Cloudflare's privacy proxy

**Note:** Cloudflare IS the registrar, so they know who you are — but the public doesn't.

---

## 2 — Cloudflare DNS: Orange-Cloud Everything

The **orange cloud** in Cloudflare means Cloudflare proxies the traffic.
Your real IP (NAS IP or Cloud Run IP) is **never exposed in DNS**.

### Required Settings

| Record Type | Example Hostname | Setting | Action |
|-------------|-----------------|---------|--------|
| A | @ (root) | Proxied 🟠 | ✅ Orange cloud |
| A | www | Proxied 🟠 | ✅ Orange cloud |
| A | api | Proxied 🟠 | ✅ Orange cloud |
| A | dispatch | Proxied 🟠 | ✅ Orange cloud |
| CNAME | * (wildcard) | Proxied 🟠 | ✅ Orange cloud |
| MX | @ | DNS only ☁️ | Mail doesn't proxy — see §4 |
| TXT | @ (SPF, DKIM) | DNS only ☁️ | TXT can't proxy |

### Records That MUST Stay DNS-Only (Grey Cloud)

- MX records
- TXT records (SPF, DKIM, DMARC, domain verification)
- SRV records
- CAA records

### Critical: Never Use Grey Cloud on A Records

A grey-cloud A record exposes your real IP to anyone running `dig` or `nslookup`.
Even one unproxied A record breaks all IP masking.

### Audit Script (run periodically)

```bash
# Check for any unproxied A/CNAME records via Cloudflare API
curl -X GET "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?type=A" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  | jq '.result[] | select(.proxied == false) | {name, type, content}'
```

Any results here = IP leak vector. Fix immediately.

---

## 3 — Cloudflare Transform Rules: Strip Origin Headers

Cloudflare lets you modify request/response headers at the edge.
Add these rules in: Cloudflare Dashboard → Rules → Transform Rules → Modify Response Headers

### Headers to REMOVE (set to empty string)

| Header | Why Remove |
|--------|-----------|
| `Server` | Exposes web server type (nginx, Node, etc.) |
| `X-Powered-By` | Exposes framework (Express, Next.js, etc.) |
| `X-AspNet-Version` | Reveals .NET version |
| `X-Amzn-Trace-Id` | AWS trace ID if behind ALB |
| `X-Google-Backends` | GCP backend identity |
| `X-GFE-Request-Trace` | GFE trace ID |
| `Via` | Reveals proxy chain |
| `X-Cache` | Reveals CDN/cache layer |

### Cloudflare Rule (Managed Headers - Recommended)

1. Go to: Cloudflare Dashboard → Your Zone → Rules → Managed rules
2. Enable: **Remove "X-Powered-By" headers**
3. Enable: **Add security headers**
   - This automatically adds: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`

### Custom Transform Rule (for anything Managed Rules miss)

```
Rule name: Strip Infrastructure Headers
When: All incoming requests
Then - Modify Response Header:
  Remove: Server
  Remove: X-Powered-By
  Remove: X-GFE-Request-Trace
  Remove: X-Google-Backends
  Remove: Via
  Set: Server = cle
```

---

## 4 — Email: ProtonMail + Custom Domain

Never use a public mailbox (Gmail, Yahoo) for your domain. It deanonymizes you.

### Setup

1. **Create ProtonMail account:** <https://proton.me>
   - Use a pseudonymous username, not your real name
   - Enable 2FA immediately

2. **Add custom domain in ProtonMail:**
   - Account Settings → Custom Domains → Add Domain
   - Follow their DNS verification steps

3. **Add DNS records (these must be grey-cloud / DNS only):**

```
# MX Records (priority order)
MX  @   10  mail.protonmail.ch
MX  @   20  mailsec.protonmail.ch

# SPF (prevents spam spoofing)
TXT @   "v=spf1 include:_spf.protonmail.ch mx ~all"

# DKIM (cryptographic signing — ProtonMail generates these)
TXT protonmail._domainkey   [value from ProtonMail dashboard]

# DMARC (email authentication policy)
TXT _dmarc   "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"
```

1. **Verify all MX/TXT records remain grey-cloud** — do not orange-cloud email records.

2. **Use catch-all address:** In ProtonMail, enable catch-all so any `@yourdomain.com`
   email reaches your inbox. Great for compartmentalization.

---

## 5 — Zero-Trust Network: Additional Hardening

### NAS DNS

Point all NAS DNS queries to Cloudflare:

- Primary DNS: `1.1.1.1`
- Secondary DNS: `1.0.0.1`
- Enable DNS-over-HTTPS: `https://cloudflare-dns.com/dns-query`

This prevents DNS leaks from the NAS resolving hostnames through your ISP.

### Cloudflare Tunnel vs. Manual Port Forwarding

| Method | Your IP Exposed? | Requires Open Ports? | CGNAT Compatible? |
|--------|-----------------|---------------------|------------------|
| Cloudflare Tunnel | ❌ Never | ❌ No | ✅ Yes |
| Port Forwarding | ✅ Yes (in DNS) | ✅ Yes | ❌ Sometimes |
| Reverse Proxy only | ✅ Yes (in DNS) | ✅ Yes | ❌ No |

**Always use Cloudflare Tunnel** for NAS services. Never open port 80/443 on your router.

### Cloud Run Header Stripping

Apply `infra/stealth/gcp/header-sanitizer.ts` as Express middleware in every Cloud Run service:

```typescript
import { headerSanitizer } from '../infra/stealth/gcp/header-sanitizer.js';
// In your Express app setup:
app.use(headerSanitizer({ verbose: false }));
```

### Cloud Armor Policy (GCP Console)

1. GCP → Network Security → Cloud Armor → Create Policy
2. Policy type: Security policy
3. Default rule: Allow
4. Add rule: Remove response headers matching `server`, `x-goog-*`, `x-gfe-*`
5. Attach policy to all Cloud Run Load Balancers

---

## 6 — IP Diversity Matrix

| Node | Location | IP Type | Use Case | Cost |
|------|----------|---------|---------|------|
| C0 | Local | Residential (changes) | Dev/testing only | $0 |
| C1 | NAS | Same as C0 behind tunnel | Always-on research, masked by CF | $0 |
| C2 | Cloud Run | Static datacenter (via NAT) | API calls, geo-specific research | $8-13/mo |
| C3 | VPS Pool | Datacenter (rotation) | Diverse IP pool | $15/mo |
| Residential | Brightdata/Smartproxy | Residential | Sensitive scraping | $5-15/GB |

**Routing logic:**

- Default COMET research → C1 (NAS, behind Cloudflare Tunnel)
- Geo-specific requests → C2 (Cloud Run + Cloud NAT)
- Anti-bot-heavy targets → Residential proxy on-demand
- Never route internal API calls through residential proxies

---

## 7 — Stealth Verification Checklist

Run these checks after setup to confirm zero exposure:

```bash
# 1. Confirm your domain IP in DNS is Cloudflare's, not yours
dig +short yourdomain.com
# Expected: Cloudflare IP ranges (104.x.x.x, 172.67.x.x, etc.)

# 2. Check for any unproxied records
# (Use the API audit script from §2)

# 3. Verify Server header is stripped
curl -I https://yourdomain.com | grep -i server
# Expected: server: cle (or no server header)

# 4. Verify X-Powered-By is gone
curl -I https://yourdomain.com | grep -i x-powered
# Expected: (empty)

# 5. Check WHOIS shows Cloudflare/Njalla, not your info
whois yourdomain.com | grep -i "registrant\|admin\|tech"

# 6. Verify email MX points to ProtonMail
dig MX yourdomain.com
# Expected: mail.protonmail.ch, mailsec.protonmail.ch

# 7. Test SPF/DKIM/DMARC
# Use: https://mxtoolbox.com/EmailHeaders.aspx
```

All checks passing = **Sovereign Stealth Stack — ACTIVE** ✅
