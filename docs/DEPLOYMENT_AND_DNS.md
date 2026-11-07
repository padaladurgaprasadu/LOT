# Production Deployment & Domain Configuration Guide

This document provides complete, production-grade instructions for deploying the **LOT Sovereign Multi-Agent Operating System (LOT-OS)** to the custom apex domain **`lot-ai.in`** on Vercel, as well as standalone containerized environments leveraging Next.js `output: 'standalone'`.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Vercel Global Edge Network Deployment](#2-vercel-global-edge-network-deployment)
3. [Exact DNS Record Mapping for `lot-ai.in`](#3-exact-dns-record-mapping-for-lot-aiin)
4. [Registrar-Specific Configuration Guides](#4-registrar-specific-configuration-guides)
5. [SSL/TLS Automated Let's Encrypt Certification & Lifecycle](#5-ssltls-automated-lets-encrypt-certification--lifecycle)
6. [Standalone Container & Docker Deployment (`.next/standalone`)](#6-standalone-container--docker-deployment-nextstandalone)
7. [Systemd Service for Self-Hosted Bare Metal / VPS](#7-systemd-service-for-self-hosted-bare-metal--vps)
8. [DNS Propagation & Production Verification Checklist](#8-dns-propagation--production-verification-checklist)

---

## 1. Architecture Overview

LOT-OS is built on Next.js 14 (App Router) with dual deployment targets:
- **Primary Serverless Target (Vercel Edge & Serverless Functions)**: Dynamic streaming endpoints (`/api/lot-os`, `/api/web-grounding`, `/api/autonomous-agent`) execute as serverless micro-runtimes across Vercel's global edge network.
- **Secondary Self-Hosted Container Target (Docker / Standalone)**: Built via `output: 'standalone'` in `next.config.mjs`, producing a lean Node.js server in `.next/standalone` without requiring the bulky `node_modules` directory in production.

```
                    [ End-User Browser ]
                             │
                      HTTPS / Port 443
                             ▼
                 [ Anycast Edge DNS ]
           ┌─────────────────┴─────────────────┐
           │                                   │
      A Record: @                        CNAME: www
     76.76.21.21                    cname.vercel-dns.com
           │                                   │
           └─────────────────┬─────────────────┘
                             ▼
              [ Vercel Global Edge Network ]
                 - Automatic SSL/TLS (Let's Encrypt)
                 - HSTS (max-age=63072000)
                 - CSP Sandpack Preview Framing
                             │
           ┌─────────────────┴─────────────────┐
           ▼                                   ▼
    [ Static Assets / CDN ]            [ Serverless Node.js 20.x ]
     - Next.js Client Bundles           - /api/lot-os (AI SDK failover)
     - WASM / Web Workers               - /api/web-grounding
     - KaTeX / Mermaid / CSS            - /api/autonomous-agent
```

---

## 2. Vercel Global Edge Network Deployment

### Step 1: Link Repository to Vercel
1. Log into your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** → **"Project"**.
3. Import the Git repository (GitHub / GitLab / Bitbucket) hosting LOT-OS.

### Step 2: Configure Build & Output Settings
Configure the following settings in the **Build and Output Settings** pane:

| Setting | Value | Rationale |
| :--- | :--- | :--- |
| **Framework Preset** | `Next.js` | Auto-detects Next.js 14 App Router |
| **Root Directory** | `./` | Root of the repository containing `next.config.mjs` |
| **Build Command** | `npm run build` | Compiles Next.js app with standalone output |
| **Output Directory** | `.next` (default) | Next.js output directory |
| **Install Command** | `npm install --legacy-peer-deps` | Required for peer dependency alignment (`.npmrc` configured) |
| **Node.js Version** | `20.x` (LTS) | Recommended runtime for Node HTTP agents & cryptography |

> **Note on `.npmrc`**: LOT-OS includes `legacy-peer-deps=true` in `.npmrc`. If custom build scripts are used, ensure `--legacy-peer-deps` is passed to prevent peer-dependency conflicts with `@tscircuit` packages.

### Step 3: Configure Production Environment Variables
In Vercel **Settings → Environment Variables**, add the environment keys required for production. Select **Production**, **Preview**, and **Development** targets:

1. `GROQ_API_KEY` (Free rotation Tier 1)
2. `OPENROUTER_API_KEY` (Free rotation Tier 2)
3. `GEMINI_API_KEY` (Free rotation Tier 3)
4. `NVIDIA_API_KEY` (NVIDIA NIM Tier 4 & FLUX image engine)
5. `NEXT_PUBLIC_SUPABASE_URL` (Supabase pgvector cloud URL)
6. `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase anonymous public token)
7. `SUPABASE_SERVICE_ROLE_KEY` (Supabase server-side administrative token)
8. `JINA_API_KEY` (Optional live grounding token)
9. `JWT_SECRET` (Cryptographic signing secret: min 32 chars)
10. `ENCRYPTION_SECRET` (AES-256 session encryption key: min 32 chars)
11. `NEXT_PUBLIC_APP_URL` (`https://lot-ai.in`)

*(Refer to `.env.local.example` for comprehensive documentation and dashboard URLs).*

---

## 3. Exact DNS Record Mapping for `lot-ai.in`

To map the custom apex domain **`lot-ai.in`** and its `www` subdomain to Vercel, configure the following DNS records with your DNS provider / registrar:

| Record Type | Host / Name | Target / Value | TTL | Priority | Description / Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | `@` (apex) | `76.76.21.21` | `3600` (or Auto) | — | Apex domain routing to Vercel Anycast edge network |
| **CNAME** | `www` | `cname.vercel-dns.com` | `3600` (or Auto) | — | Subdomain routing with automatic redirection |

### Canonical Redirect Strategy
Inside Vercel **Settings → Domains**:
1. Add `lot-ai.in`.
2. Add `www.lot-ai.in`.
3. Vercel will prompt: *"Redirect www.lot-ai.in to lot-ai.in?"*
4. Select **Redirect to lot-ai.in (Recommended)** with HTTP Status **308 Permanent Redirect**.
   - This ensures SEO link equity is consolidated on `https://lot-ai.in`.

---

## 4. Registrar-Specific Configuration Guides

### GoDaddy
1. Log into GoDaddy → **Domain Control Center** → select `lot-ai.in`.
2. Navigate to **Manage DNS**.
3. Under **DNS Records**:
   - Locate the existing **A** record for `@`. Click **Edit** and set Value to `76.76.21.21`, TTL to `1 Hour` (or `600 seconds`).
   - Locate the existing **CNAME** record for `www`. Click **Edit** and set Value to `cname.vercel-dns.com`, TTL to `1 Hour`.
4. Save both records. Remove any conflicting parked page A records.

### Namecheap
1. Log into Namecheap → **Domain List** → click **Manage** next to `lot-ai.in`.
2. Select the **Advanced DNS** tab.
3. Under **Host Records**:
   - Add new record: Type = `A Record`, Host = `@`, Value = `76.76.21.21`, TTL = `Automatic`.
   - Add new record: Type = `CNAME Record`, Host = `www`, Value = `cname.vercel-dns.com`, TTL = `Automatic`.
4. Delete default URL Redirect or Parking records.

### Cloudflare (DNS Only Recommended)
1. In Cloudflare Dashboard, select `lot-ai.in` → **DNS** → **Records**.
2. Add records:
   - Type = `A`, Name = `@`, IPv4 address = `76.76.21.21`, Proxy status = **DNS only (Grey Cloud)**.
   - Type = `CNAME`, Name = `www`, Target = `cname.vercel-dns.com`, Proxy status = **DNS only (Grey Cloud)**.
3. *Why DNS Only?* Vercel manages global edge caching, SSL/TLS certificates, and DDoS mitigation natively. Setting Cloudflare to "Proxied" (Orange Cloud) can cause SSL handshake loops (Error 525/526) unless Cloudflare SSL is set strictly to "Full (Strict)". Setting to "DNS Only" guarantees clean Let's Encrypt validation.

### Google Domains / Squarespace Domains
1. Navigate to DNS Settings for `lot-ai.in`.
2. Under **Custom Records**:
   - Host name: `@` | Type: `A` | TTL: `3600` | Data: `76.76.21.21`
   - Host name: `www` | Type: `CNAME` | TTL: `3600` | Data: `cname.vercel-dns.com.`
3. Save changes.

---

## 5. SSL/TLS Automated Let's Encrypt Certification & Lifecycle

### Automated ACME Provisioning
Once the DNS A and CNAME records propagate:
1. Vercel's edge infrastructure detects the DNS resolution pointing to `76.76.21.21`.
2. Vercel automatically requests an SSL/TLS X.509 certificate from **Let's Encrypt** (or DigiCert) via the automated ACME protocol (HTTP-01 or DNS-01 challenge).
3. The certificate covers both `lot-ai.in` and `*.lot-ai.in` / `www.lot-ai.in`.

### 90-Day Renewal Lifecycle
- **Validity Window**: Standard Let's Encrypt certificates are valid for 90 days.
- **Zero-Downtime Automated Renewal**: Vercel automatically initiates renewal 30 days prior to certificate expiration (at day 60). No manual intervention, private key rotation, or domain re-verification is required.
- **Failover CA**: If Let's Encrypt experiences rate limits or CA outages, Vercel automatically falls back to ZeroSSL or DigiCert CA roots.

### Production Security Headers
Configured in `next.config.mjs`, all requests to `lot-ai.in` enforce:
- **HSTS**: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (enforces HTTPS for 2 years).
- **MIME Sniffing Prevention**: `X-Content-Type-Options: nosniff`.
- **Referrer Privacy**: `Referrer-Policy: strict-origin-when-cross-origin`.
- **Sandpack Preview CSP**:
  ```http
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' blob: data: https:; font-src 'self' data: https:; connect-src 'self' https: wss:; frame-src 'self' https://codesandbox.io https://*.codesandbox.io blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self';
  ```
  This permits live Sandpack React/Vite preview iframes and audio transcription workers while defending against external framing and XSS attacks.

---

## 6. Standalone Container & Docker Deployment (`.next/standalone`)

When deploying LOT-OS outside Vercel (e.g. AWS ECS, Google Cloud Run, Kubernetes, or self-hosted bare metal), use Next.js standalone output.

### How Standalone Output Works
With `output: 'standalone'` in `next.config.mjs`, running `npm run build` generates:
- `.next/standalone`: Lean Node.js server bundle with only tracing-resolved dependencies.
- Static assets remain in `.next/static` and `public/`, which are copied into the final image.

### Production Multi-Stage `Dockerfile`
Create `Dockerfile` in the repository root:

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1: Base image
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
RUN npm ci --legacy-peer-deps

# Stage 3: Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment build-time variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 4: Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Security: Run as unprivileged user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and standalone server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/lot-os || exit 1

CMD ["node", "server.js"]
```

### Docker Compose Configuration (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  lot-os:
    build:
      context: .
      dockerfile: Dockerfile
    image: lot-os:latest
    container_name: lot-os-production
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOSTNAME=0.0.0.0
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2048M
        reservations:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/lot-os"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
```

### Docker Build & Run Commands
```bash
# Build production Docker image
docker build -t lot-os:latest .

# Run container in detached mode
docker run -d \
  --name lot-os \
  -p 3000:3000 \
  --env-file .env.local \
  lot-os:latest

# Check live logs
docker logs -f lot-os
```

---

## 7. Systemd Service for Self-Hosted Bare Metal / VPS

For self-hosted Linux servers running Ubuntu / Debian / RHEL with Node.js 20 LTS:

1. Build the standalone bundle:
   ```bash
   npm install --legacy-peer-deps
   npm run build
   ```

2. Copy static files into standalone directory:
   ```bash
   cp -r public .next/standalone/
   cp -r .next/static .next/standalone/.next/
   ```

3. Create systemd service unit at `/etc/systemd/system/lot-os.service`:
   ```ini
   [Unit]
   Description=LOT Sovereign Multi-Agent OS
   After=network.target

   [Service]
   Type=simple
   User=www-data
   Group=www-data
   WorkingDirectory=/var/www/lot-os/.next/standalone
   EnvironmentFile=/var/www/lot-os/.env.local
   Environment=NODE_ENV=production
   Environment=PORT=3000
   Environment=HOSTNAME=127.0.0.1
   ExecStart=/usr/bin/node server.js
   Restart=always
   RestartSec=10
   StandardOutput=syslog
   StandardError=syslog
   SyslogIdentifier=lot-os

   [Install]
   WantedBy=multi-user.target
   ```

4. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable lot-os
   sudo systemctl start lot-os
   sudo systemctl status lot-os
   ```

---

## 8. DNS Propagation & Production Verification Checklist

Execute the following diagnostic commands from your terminal to verify production deployment for `lot-ai.in`:

### 1. Verify Apex A Record Propagation
```bash
# Query public DNS servers (Google 8.8.8.8, Cloudflare 1.1.1.1)
dig @8.8.8.8 lot-ai.in A +short
# Expected output:
# 76.76.21.21

nslookup lot-ai.in 1.1.1.1
# Address should resolve to 76.76.21.21
```

### 2. Verify Subdomain CNAME Record Propagation
```bash
dig @8.8.8.8 www.lot-ai.in CNAME +short
# Expected output:
# cname.vercel-dns.com.
```

### 3. Verify HTTPS & HTTP-to-HTTPS Redirection
```bash
# Test HTTP to HTTPS 308 redirect
curl -I http://lot-ai.in
# Expected header:
# HTTP/1.1 308 Permanent Redirect
# Location: https://lot-ai.in/

# Test HTTPS response and SSL handshake
curl -Iv https://lot-ai.in
# Verify:
# - TLSv1.3 connection established
# - Common Name: lot-ai.in / *.lot-ai.in
# - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
# - Content-Security-Policy containing frame-src for codesandbox.io
```

### 4. Verify Route Endpoints in Production
```bash
# Test Sovereign Multi-Model API endpoint
curl -X POST https://lot-ai.in/api/lot-os \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}],"mode":"chat"}'
# Expected response: HTTP 200 with streaming SSE or JSON completion

# Test Web Grounding API endpoint
curl -X POST https://lot-ai.in/api/web-grounding \
  -H "Content-Type: application/json" \
  -d '{"query":"https://arxiv.org","mode":"quick"}'
# Expected response: HTTP 200 with structured grounding summary
```

---
*Documentation maintained by LOT-OS DevOps & Production Engineering Team.*
