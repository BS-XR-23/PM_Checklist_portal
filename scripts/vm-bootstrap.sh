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
