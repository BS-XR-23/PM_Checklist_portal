# Ubuntu VM Deployment + CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the PM Checklist Portal to a self-hosted Ubuntu VM behind HTTPS at `project-management.xr-23.com`, with a GitHub Actions self-hosted runner on that same VM auto-deploying every push to `main`.

**Architecture:** The Ubuntu VM runs Docker (app container, built from the existing `Dockerfile`), Nginx (system service, reverse-proxies HTTPS traffic on 443 to the container's port 3000, with Certbot managing Let's Encrypt certs and auto-renewal), and a GitHub Actions self-hosted runner (systemd service) registered to the `BS-XR-23/PM_Checklist_portal` repo. On push to `main`, the runner checks out the repo in place, restores the persistent production `.env`, runs `docker compose up -d --build`, and verifies the container is healthy before finishing.

**Tech Stack:** Docker + Docker Compose (already in repo), Nginx + Certbot (reverse proxy / TLS), GitHub Actions self-hosted runner, Next.js 14 health-check route.

## Global Constraints

- Domain: `project-management.xr-23.com` — DNS A record must point at the VM's public IP before Task 5's cert issuance will succeed.
- Repo: `BS-XR-23/PM_Checklist_portal` (private) — self-hosted runner is only safe because this repo is private with trusted committers, per the earlier design discussion.
- Production secrets (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, seed vars) live **only** in `/opt/portal-secrets/.env` on the VM — never committed, never put in GitHub Secrets (the runner already has local disk access, so there's no need to route them through GitHub).
- The VM's Postgres is external (Supabase) — no database container, no volume to manage for data.
- Existing `docker-entrypoint.sh` already runs `prisma migrate deploy` (and the optional seed) on container start — do not duplicate that logic in the workflow.
- **This is a shared production VM** hosting ~30 other live client sites under PM2 (as `root`) and an existing Nginx reverse proxy with one vhost per subdomain. Confirmed via `pm2 list` and `ls /etc/nginx/sites-enabled/` during Task 4/5 — port 3000 was free at check time, and our Nginx vhost is additive (new file only, existing sites untouched). Any future troubleshooting should assume other tenants' uptime is also at stake, not just this app's.

---

### Task 1: Health-check endpoint

**Files:**
- Create: `app/api/health/route.ts`

**Interfaces:**
- Produces: `GET /api/health` → `200 {"status":"ok"}` on success, `503 {"status":"error"}` if the DB is unreachable. Consumed by Task 3 (Compose healthcheck) and Task 7 (workflow's post-deploy check).

- [ ] **Step 1: Create the route**

```ts
// app/api/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
```

- [ ] **Step 2: Verify locally**

Run: `npm run dev`, then in another terminal: `curl -i http://localhost:3000/api/health`
Expected: `HTTP/1.1 200 OK` and body `{"status":"ok"}` (requires your local `.env` to have a working `DATABASE_URL`).

- [ ] **Step 3: Commit**

```bash
git add app/api/health/route.ts
git commit -m "feat: add health check endpoint"
```

---

### Task 2: Exclude health check from auth middleware

**Files:**
- Modify: `middleware.ts:4`

**Interfaces:**
- Consumes: `/api/health` route from Task 1.

- [ ] **Step 1: Update the matcher**

```ts
// middleware.ts
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/((?!api/auth|api/health|login|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Verify**

Run: `npm run dev`, then `curl -i http://localhost:3000/api/health`
Expected: still `200`, and crucially *not* a redirect to `/login` (compare against `curl -i http://localhost:3000/` which should redirect).

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "fix: exclude health check from auth middleware"
```

---

### Task 3: Docker Compose healthcheck

**Files:**
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: `GET /api/health` from Task 1.
- Produces: container `health` status, consumed by Task 7's workflow wait-loop and by `docker compose ps`.

- [ ] **Step 1: Add the healthcheck block**

```yaml
services:
  portal:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: ${DATABASE_URL:?set your Supabase pooled connection string in .env}
      DIRECT_URL: ${DIRECT_URL:?set your Supabase direct connection string in .env}
      NEXTAUTH_URL: ${NEXTAUTH_URL:-http://localhost:3000}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?set a long random string in .env}
      SEED_ADMIN_EMAIL: ${SEED_ADMIN_EMAIL:-}
      SEED_ADMIN_NAME: ${SEED_ADMIN_NAME:-}
      SEED_ADMIN_PASSWORD: ${SEED_ADMIN_PASSWORD:-}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
```

(Uses Node's built-in `http` module instead of `curl`/`wget` since the `node:18-slim` runner stage doesn't have either installed — no Dockerfile change needed.)

- [ ] **Step 2: Verify locally**

Run: `docker compose up --build -d` (with a valid local `.env`), then `docker compose ps`
Expected: after ~20-30s, the `STATUS` column shows `(healthy)`.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add container healthcheck"
```

---

### Task 4: VM bootstrap — Docker, firewall, deploy user

**Files:**
- Create: `scripts/vm-bootstrap.sh`

This task is executed **by you, on the VM**, not by CI. The script is committed to the repo so it's documented and repeatable, but you run it manually over your existing SSH session since no automation has access to the VM yet.

- [ ] **Step 1: Add the script to the repo**

```bash
#!/usr/bin/env bash
# One-time Ubuntu VM bootstrap: Docker, firewall, deploy user.
# Run manually via: sudo bash scripts/vm-bootstrap.sh
set -euo pipefail

# Docker Engine + Compose plugin (official repo)
apt-get update -y
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Dedicated non-root deploy user (runs the app + the GitHub Actions runner)
id -u deploy &>/dev/null || useradd -m -s /bin/bash deploy
usermod -aG docker deploy

# Firewall: SSH + HTTP/HTTPS only
apt-get install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Directory for persistent production secrets (outside any git checkout)
mkdir -p /opt/portal-secrets
chown deploy:deploy /opt/portal-secrets
chmod 700 /opt/portal-secrets

echo "Bootstrap complete. Next: log in as 'deploy' (sudo -iu deploy) for Tasks 5-8."
```

- [ ] **Step 2: Copy it to the VM and run it**

From your machine: `scp scripts/vm-bootstrap.sh you@<vm-ip>:~/`
On the VM: `sudo bash ~/vm-bootstrap.sh`
Expected output ends with `Bootstrap complete...`. Verify with `docker --version`, `docker compose version`, `ufw status` (should show 22, 80, 443 allowed), and `id deploy` (should exist, in the `docker` group).

- [ ] **Step 3: Commit**

```bash
git add scripts/vm-bootstrap.sh
git commit -m "chore: add VM bootstrap script"
```

---

### Task 5: Nginx reverse proxy + HTTPS (Certbot)

**Note:** This VM turned out to already run Nginx 1.24.0 as a shared reverse proxy for ~30 other live client sites (one vhost file per subdomain in `/etc/nginx/sites-enabled/`, named after the subdomain, e.g. `nissan-car.xr-23.com`). We follow that existing convention instead of a generic filename, and we do **not** touch `nginx` itself, `sites-enabled/default`, or any other site's config — only add our own file.

**Files:**
- Create: `deploy/nginx.conf` (deployed to the VM as `/etc/nginx/sites-available/project-management.xr-23.com`)

- [ ] **Step 1: Add the Nginx server block to the repo**

```nginx
server {
    listen 80;
    server_name project-management.xr-23.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 2: Point DNS at the VM**

In your DNS provider, create an **A record**: `project-management.xr-23.com` → `<vm-public-ip>`. Wait for it to propagate (`dig +short project-management.xr-23.com` should return the VM's IP) — Certbot's HTTP-01 challenge in Step 4 will fail until this resolves correctly.

- [ ] **Step 3: Deploy the vhost file, on the VM**

Nginx is already installed and running other sites — skip installing it, and only add our file:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/project-management.xr-23.com
sudo ln -sf /etc/nginx/sites-available/project-management.xr-23.com /etc/nginx/sites-enabled/project-management.xr-23.com
sudo nginx -t
sudo systemctl reload nginx
```

(Run this after Task 9's first deploy has the app listening on port 3000 — Nginx will 502 until then, which is fine; Certbot in Step 4 only needs port 80 to answer, not a working upstream. We deliberately do not touch `sites-enabled/default` or any other existing site.)

- [ ] **Step 4: Issue the HTTPS certificate with Certbot**

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d project-management.xr-23.com --redirect --agree-tos -m moshiuzzaman@brainstation-23.com --non-interactive
```

Certbot edits `/etc/nginx/sites-available/portal` in place to add the `listen 443 ssl` block and cert paths, adds an HTTP→HTTPS redirect, and registers a systemd timer (`certbot.timer`, installed automatically by the package) that renews the cert before it expires — no cron job needed. The live file on the VM will diverge from the committed `deploy/nginx.conf` after this step; that's expected, since Certbot owns the TLS portion.

- [ ] **Step 5: Verify**

Once DNS has propagated and the app container is running (Task 9): `curl -i https://project-management.xr-23.com/api/health`
Expected: `200`, valid TLS cert (no `-k` needed). Also check `sudo systemctl list-timers | grep certbot` shows the renewal timer scheduled.

- [ ] **Step 6: Commit**

```bash
git add deploy/nginx.conf
git commit -m "feat: add Nginx reverse proxy config"
```

---

### Task 6: Production secrets file on the VM

This task is manual, on the VM, as the `deploy` user, and is **never** committed to git.

- [ ] **Step 1: Create `/opt/portal-secrets/.env`**

```bash
sudo -iu deploy
nano /opt/portal-secrets/.env
```

Contents (fill in real values — Supabase connection strings from your project's Connect button, Session pooler, and a freshly generated secret for `NEXTAUTH_SECRET`, e.g. `openssl rand -base64 32`):

```
DATABASE_URL="postgresql://postgres.xxxxxxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres"
DIRECT_URL="postgresql://postgres.xxxxxxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres"
NEXTAUTH_URL="https://project-management.xr-23.com"
NEXTAUTH_SECRET="<output of: openssl rand -base64 32>"
SEED_ADMIN_EMAIL="pm@bs23.local"
SEED_ADMIN_NAME="Admin PM"
SEED_ADMIN_PASSWORD="<a real one-time password, not changeme123>"
```

- [ ] **Step 2: Lock down permissions**

```bash
chmod 600 /opt/portal-secrets/.env
```

- [ ] **Step 3: Verify**

`cat /opt/portal-secrets/.env` should show your real values, readable only by `deploy` (`ls -l` shows `-rw-------`).

(No commit — this step deliberately produces nothing for git.)

---

### Task 7: GitHub Actions self-hosted runner

Manual, on the VM, as the `deploy` user.

**Interfaces:**
- Produces: a `self-hosted` runner label that Task 8's workflow targets via `runs-on: self-hosted`.

- [ ] **Step 1: Get a registration token**

In the browser: `github.com/BS-XR-23/PM_Checklist_portal` → Settings → Actions → Runners → New self-hosted runner → Linux/x64. Copy the `./config.sh --url ... --token ...` command it shows you (the token is single-use and expires quickly, so do this right before Step 2).

- [ ] **Step 2: Install and register, as the `deploy` user**

```bash
sudo -iu deploy
mkdir -p /opt/actions-runner && cd /opt/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64-2.319.1.tar.gz
tar xzf actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/BS-XR-23/PM_Checklist_portal --token <PASTE_TOKEN_FROM_STEP_1>
```

Accept the defaults (name, work folder `_work`, labels) unless you have a reason not to.

- [ ] **Step 3: Install as a systemd service (so it survives reboots and SSH disconnects)**

```bash
exit  # back to your sudo-capable user
cd /opt/actions-runner
sudo ./svc.sh install deploy
sudo ./svc.sh start
```

- [ ] **Step 4: Verify**

`sudo ./svc.sh status` should show it running. In GitHub: Settings → Actions → Runners should show the runner as **Idle** (green).

---

### Task 8: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `self-hosted` runner (Task 7), `/opt/portal-secrets/.env` (Task 6), `GET /api/health` (Task 1), Compose healthcheck (Task 3).

- [ ] **Step 1: Create the workflow**

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Restore production env file
        run: cp /opt/portal-secrets/.env .env

      - name: Build and start
        run: docker compose up -d --build

      - name: Wait for healthy container
        run: |
          for i in $(seq 1 30); do
            status=$(docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q portal)" 2>/dev/null || echo "starting")
            if [ "$status" = "healthy" ]; then
              echo "Container healthy."
              exit 0
            fi
            sleep 2
          done
          echo "Container did not become healthy in time."
          docker compose logs --tail=100
          exit 1

      - name: Clean up old images
        run: docker image prune -f
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add self-hosted deploy workflow"
git push origin main
```

- [ ] **Step 3: Verify**

In GitHub: Actions tab → the `Deploy` workflow should start automatically on the push, run on your self-hosted runner, and finish green. On the VM: `docker compose ps` shows the `portal` service `Up (healthy)`.

---

### Task 9: End-to-end verification

No new files — this is a checklist to run once Tasks 1-8 are all live.

- [ ] **Step 1: Confirm the app is reachable over HTTPS**

`curl -i https://project-management.xr-23.com/login` → `200`, valid cert.

- [ ] **Step 2: Confirm login works**

Visit `https://project-management.xr-23.com/login` in a browser, log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `/opt/portal-secrets/.env`.

- [ ] **Step 3: Confirm the pipeline is live**

Make a trivial change (e.g. edit a comment), push to `main`, and watch the Actions tab run the workflow end-to-end without manual intervention.

- [ ] **Step 4: Document rollback**

If a deploy breaks something: `git log --oneline` on the VM inside `/opt/actions-runner/_work/PM_Checklist_portal/PM_Checklist_portal`, then `git checkout <previous-good-sha> && docker compose up -d --build`. No need to script this — it's a rare-enough operation to do by hand, and scripting it risks masking what actually happened.

---

## Self-Review Notes

- Spec coverage: registry-based build was dropped in favor of self-hosted-runner build-in-place per the confirmed pivot; all four original design pillars (VM base setup, app/VM config, CI/CD pipeline, safety net) are covered by Tasks 4-9.
- No placeholders remain except the registration token in Task 7 Step 1 and the runner tarball version in Step 2, both of which are inherently supplied by GitHub at run time, not something this plan can pre-fill.
- `NEXTAUTH_URL` in Task 6 correctly uses `https://` to match Task 5's Nginx/Certbot TLS termination, not the `.env.example`'s `http://localhost:3000` default.
- Reverse proxy switched from Caddy to Nginx + Certbot per user request after initial plan approval — Task 5 rewritten accordingly (Certbot email defaults to the requesting user's address, moshiuzzaman@brainstation-23.com, for renewal notices; change it in Step 4's command if a different address should own the cert).
