# Resilient Email Service

A robust email sending service built with Node.js 22 that implements retry logic, fallback mechanisms, rate limiting, and idempotency to ensure reliable email delivery.

## Quick Start

### Development

```bash
# Backend
npm install
npm run dev  # runs on :4000

# Frontend  
cd frontend
npm install
npm start    # runs on :3000
```

### Production Build

```bash
# Backend - just run with npm start
npm install
npm start    # runs on :4000

# Frontend - build static files
cd frontend
npm install
npm run build

# For local testing of production build
npx serve -s build -l 3000

# For actual production deployment
# Use nginx or your preferred static file server
```

## AWS EC2 + Nginx + SSL Setup

### 1. DNS Records
Point your domain to EC2 public IP:
```
Type: A
Name: demo-email.shaurya.codes
Value: YOUR_EC2_PUBLIC_IP
TTL: 300
```

### 2. Server Setup (Amazon Linux)
```bash
# Install Node.js 22
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs nginx certbot python3-certbot-nginx

# Start services
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 3. Nginx Config
Create `/etc/nginx/conf.d/demo-email.shaurya.codes.conf`:

```nginx
server {
    server_name demo-email.shaurya.codes;

    # Health/admin endpoints (ADD THIS BLOCK FIRST)
    location ~ ^/(health|metrics|providers|circuit-breakers|admin) {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_Set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS
        add_header Access-Control-Allow-Origin "https://demo-email.shaurya.codes" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE" always;
        add_header Access-Control-Allow-Headers "Origin, Content-Type, Accept, Authorization" always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Frontend (KEEP THIS LAST)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS
        add_header Access-Control-Allow-Origin "https://demo-email.shaurya.codes" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE" always;
        add_header Access-Control-Allow-Headers "Origin, Content-Type, Accept, Authorization" always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/demo-email.shaurya.codes/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/demo-email.shaurya.codes/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = demo-email.shaurya.codes) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name demo-email.shaurya.codes;
    return 404; # managed by Certbot
}
```

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 4. SSL with Certbot
```bash
# Get certificate
sudo certbot --nginx -d demo-email.shaurya.codes

# Auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### 5. Firewall
```bash
sudo dnf install -y firewalld
sudo systemctl start firewalld
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http  
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 6. Environment Files

Backend `.env`:
```bash
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://demo-email.shaurya.codes
MAX_RETRY_ATTEMPTS=3
PRIMARY_PROVIDER_SUCCESS_RATE=0.6
SECONDARY_PROVIDER_SUCCESS_RATE=0.8
```

Frontend `.env.production`:
```bash
REACT_APP_API_URL=https://demo-email.shaurya.codes/api
```

That's it! Run your services and access via https://demo-email.shaurya.codes
