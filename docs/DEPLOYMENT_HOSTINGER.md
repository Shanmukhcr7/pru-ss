# Hostinger KVM VPS Production Deployment Guide

This guide details the step-by-step process for deploying the **ParentVision** platform on a Hostinger KVM VPS running Ubuntu 22.04 or 24.04 LTS.

---

## 1. Sizing & Hosting Cost Considerations

| Resource | Recommended Minimum | Notes |
| :--- | :--- | :--- |
| **VPS Plan** | Hostinger KVM 2 or KVM 4 | 2–4 vCPU, 4–8 GB RAM, NVMe storage |
| **Bandwidth** | 4 TB – 8 TB / month | Included in standard Hostinger KVM plans |
| **TURN Relay Traffic** | ~1.5 Mbps per active 720p 24fps stream | Relayed through Coturn only when direct P2P NAT fails |

> [!NOTE]
> WebRTC operates peer-to-peer (P2P) whenever possible. In typical home WiFi scenarios, media packets route directly between the iPhone and the parent's device without passing through the VPS TURN server, consuming **zero** server relay bandwidth. The coturn server relays media only when symmetric NATs or restrictive cellular firewalls prevent direct P2P connectivity.

---

## 2. DNS Configuration

In your domain registrar (e.g., Hostinger DNS management), create the following DNS A records pointing to your Hostinger VPS public IPv4:

| Type | Host / Name | Value | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` or `parentvision` | `<YOUR_VPS_PUBLIC_IP>` | 300 |
| **A** | `turn` | `<YOUR_VPS_PUBLIC_IP>` | 300 |

---

## 3. Server Preparation & Firewall Configuration

Connect to your VPS via SSH:
```bash
ssh root@<YOUR_VPS_PUBLIC_IP>
```

Update system packages:
```bash
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban
```

### Configure UFW Firewall Rules
WebRTC requires specific ports open for signaling, HTTPS, STUN/TURN, and UDP media relay:

```bash
# Allow SSH
ufw allow 22/tcp

# Allow Web & HTTPS (Reverse Proxy ACME)
ufw allow 80/tcp
ufw allow 443/tcp

# Allow Coturn STUN & TURN signaling
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 5349/udp

# Allow WebRTC UDP Media Relay Port Range
ufw allow 49152:65535/udp

# Enable Firewall
ufw --force enable
ufw status verbose
```

---

## 4. Install Docker & Docker Compose

```bash
# Install Docker official repository
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker service
systemctl enable --now docker
```

---

## 5. Clone Repository & Setup Secrets

```bash
git clone https://github.com/your-org/parentvision.git /opt/parentvision
cd /opt/parentvision

# Copy configuration template
cp .env.example .env
```

### Generate Production Cryptographic Secrets
Run the following commands to generate 256-bit random secrets:

```bash
# Generate secrets
sed -i "s/replace_with_openssl_rand_hex_32_access_secret/$(openssl rand -hex 32)/g" .env
sed -i "s/replace_with_openssl_rand_hex_32_refresh_secret/$(openssl rand -hex 32)/g" .env
sed -i "s/replace_with_openssl_rand_hex_32_device_secret/$(openssl rand -hex 32)/g" .env
sed -i "s/replace_with_openssl_rand_hex_32_session_secret/$(openssl rand -hex 32)/g" .env

# Set TURN shared secret
TURN_KEY=$(openssl rand -hex 32)
sed -i "s/replace_with_openssl_rand_hex_32_turn_secret/$TURN_KEY/g" .env
sed -i "s/CHANGE_ME_PRODUCTION_TURN_SECRET_KEY_VERY_SECURE/$TURN_KEY/g" infrastructure/coturn/turnserver.conf

# Set Coturn external IP
VPS_IP=$(curl -s https://api.ipify.org)
sed -i "s/# external-ip=YOUR_PUBLIC_IP/external-ip=$VPS_IP/g" infrastructure/coturn/turnserver.conf
```

Edit `.env` to set your actual domain name:
```bash
nano .env
# Set DOMAIN=parentvision.yourdomain.com
# Set TURN_REALM=turn.parentvision.yourdomain.com
```

---

## 6. Launch Platform with Docker Compose

```bash
cd /opt/parentvision/infrastructure/docker

# Build and start all services in detached mode
docker compose up -d --build
```

### Verify Service Health
```bash
# Check running containers
docker compose ps

# Check API health check
curl -f http://localhost:4000/health
```

Caddy will automatically provision Let's Encrypt TLS certificates for your domain upon the first HTTPS request.

---

## 7. Setup Automated Database Backups

Ensure database backups are run nightly:

```bash
chmod +x /opt/parentvision/infrastructure/docker/backup.sh

# Add cron job to run backup every midnight
(crontab -l 2>/dev/null; echo "0 0 * * * /opt/parentvision/infrastructure/docker/backup.sh >> /var/log/parentvision_backup.log 2>&1") | crontab -
```

---

## 8. Managing and Updating the Platform

```bash
# View real-time logs
docker compose logs -f api
docker compose logs -f caddy
docker compose logs -f coturn

# Pull updates and rebuild
git pull
docker compose up -d --build
```
