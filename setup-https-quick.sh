#!/bin/bash
# Quick HTTPS setup for camera access

set -e

echo "🔒 Setting up HTTPS for Prudential Certificate Generator..."
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run with sudo: sudo bash setup-https-quick.sh"
    exit 1
fi

# 1. Generate self-signed certificate
echo "📜 Generating self-signed SSL certificate..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/prudential-selfsigned.key \
  -out /etc/ssl/certs/prudential-selfsigned.crt \
  -subj "/C=HK/ST=HongKong/L=HongKong/O=Prudential/CN=34.21.174.189" 2>/dev/null

echo "✅ SSL certificate generated"

# 2. Backup existing nginx config
echo "💾 Backing up nginx config..."
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)

# 3. Create new nginx config with HTTPS
echo "⚙️  Configuring nginx for HTTPS..."
cat > /etc/nginx/sites-available/default << 'EOF'
# HTTP server - redirect to HTTPS
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    
    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;

    # SSL certificate
    ssl_certificate /etc/ssl/certs/prudential-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/prudential-selfsigned.key;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;

    # Prudential Certificate Generator - Frontend (React)
    location /prudential/ {
        alias /home/aditya.developer/prudential/frontend/build/;
        try_files $uri $uri/ /prudential/index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    # Prudential Certificate Generator - Backend API
    location /prudential-api/ {
        proxy_pass http://localhost:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Root location
    location / {
        root /var/www/html;
        index index.html index.htm index.nginx-debian.html;
    }
}
EOF

echo "✅ Nginx config updated"

# 4. Test nginx config
echo "🧪 Testing nginx configuration..."
nginx -t

# 5. Restart nginx
echo "🔄 Restarting nginx..."
systemctl restart nginx

# 6. Open HTTPS port in firewall (if ufw is active)
if systemctl is-active --quiet ufw; then
    echo "🔥 Opening HTTPS port in firewall..."
    ufw allow 443/tcp
    echo "✅ Firewall updated"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ HTTPS Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Access your application at:"
echo "   👉 https://34.21.174.189/prudential/"
echo ""
echo "⚠️  IMPORTANT:"
echo "   1. Browser will show security warning (self-signed certificate)"
echo "   2. Click 'Advanced' or 'Show Details'"
echo "   3. Click 'Proceed to 34.21.174.189 (unsafe)' or 'Accept Risk'"
echo "   4. Camera will now work! 📸"
echo ""
echo "🔄 HTTP (port 80) automatically redirects to HTTPS"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
