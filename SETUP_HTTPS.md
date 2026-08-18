# 🔒 Setup HTTPS for Camera Access

## Problem
Camera access requires HTTPS, but the app is currently running on HTTP (http://34.21.174.189)

## Solution Options

### Option 1: Self-Signed Certificate (Quick - 5 minutes)

**Pros:**
- Quick to setup
- Camera will work immediately
- Free

**Cons:**
- Browser shows security warning (users must click "Advanced" → "Proceed anyway")
- Not recommended for production

**Steps:**

```bash
# 1. Generate self-signed certificate
cd /home/aditya.developer/prudential
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/nginx-selfsigned.key \
  -out /etc/ssl/certs/nginx-selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=Prudential/CN=34.21.174.189"

# 2. Update nginx config to use HTTPS
sudo nano /etc/nginx/sites-available/prudential

# Add this server block (keep existing HTTP block too):
server {
    listen 443 ssl;
    server_name 34.21.174.189;

    ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;

    # Frontend (React)
    location /prudential/ {
        alias /home/aditya.developer/prudential/frontend/build/;
        try_files $uri $uri/ /prudential/index.html;
    }

    # Backend API
    location /prudential-api/ {
        proxy_pass http://localhost:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 3. Test and restart nginx
sudo nginx -t
sudo systemctl restart nginx

# 4. Open HTTPS port in firewall (if needed)
sudo ufw allow 443/tcp
```

**Access:** https://34.21.174.189/prudential/
- Browser will warn about self-signed cert
- Click "Advanced" → "Proceed to 34.21.174.189 (unsafe)"
- Camera will work!

---

### Option 2: Let's Encrypt (Free SSL - Recommended for Production)

**Pros:**
- Free, trusted SSL certificate
- No browser warnings
- Auto-renewal
- Professional

**Cons:**
- Requires domain name (not IP address)
- Takes 15-30 minutes to setup

**Requirements:**
- A domain name pointing to 34.21.174.189 (e.g., certificates.prudential.com)

**Steps:**

```bash
# 1. Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# 2. Get certificate (replace with your domain)
sudo certbot --nginx -d certificates.prudential.com

# 3. Follow prompts:
# - Enter email
# - Agree to terms
# - Choose redirect HTTP to HTTPS: Yes

# 4. Certbot will auto-configure nginx!
# Certificate auto-renews every 90 days
```

**Access:** https://certificates.prudential.com/prudential/

---

### Option 3: Just Use File Upload (No HTTPS needed)

**Pros:**
- Works right now
- No setup needed
- Works on any device
- More reliable

**Cons:**
- Users can't use live camera
- Must upload existing photos

**How users use it:**
1. Take photo with phone camera
2. Click "Upload from Files"
3. Select the photo
4. Generate certificate

**This is perfectly fine for most use cases!**

---

## Recommended Approach

### For Testing/Internal Use:
✅ **Use Option 3 (File Upload)** - works perfectly, no setup needed

### For Production/External Users:
✅ **Use Option 2 (Let's Encrypt)** - professional, trusted SSL

### For Quick Demo:
⚠️ **Use Option 1 (Self-Signed)** - works but shows warnings

---

## Quick Self-Signed Setup Script

Create and run this script:

```bash
#!/bin/bash
# setup-https.sh

echo "🔒 Setting up HTTPS for Prudential Certificate Generator..."

# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/nginx-selfsigned.key \
  -out /etc/ssl/certs/nginx-selfsigned.crt \
  -subj "/C=HK/ST=HongKong/L=HongKong/O=Prudential/CN=34.21.174.189"

echo "✅ Certificate generated"

# Backup existing config
sudo cp /etc/nginx/sites-available/prudential /etc/nginx/sites-available/prudential.backup

echo "✅ Config backed up"
echo ""
echo "⚠️  Next steps:"
echo "1. Edit nginx config: sudo nano /etc/nginx/sites-available/prudential"
echo "2. Add the HTTPS server block (see SETUP_HTTPS.md)"
echo "3. Test: sudo nginx -t"
echo "4. Restart: sudo systemctl restart nginx"
echo "5. Open firewall: sudo ufw allow 443/tcp"
echo "6. Access: https://34.21.174.189/prudential/"
```

---

## Testing Camera After HTTPS Setup

1. Go to: https://34.21.174.189/prudential/
2. Click "Capture with Camera"
3. Browser asks for camera permission → Click "Allow"
4. Camera feed appears
5. Click "Capture Photo"
6. Works! ✅

---

## Troubleshooting

**Issue: Still getting camera error after HTTPS**
- Check you're using https:// not http://
- Clear browser cache
- Check browser console for errors

**Issue: nginx won't start after config change**
- Run: `sudo nginx -t` to check syntax
- Check: Certificate files exist and have correct permissions

**Issue: Can't access via HTTPS**
- Check firewall: `sudo ufw status`
- Check nginx is running: `sudo systemctl status nginx`
- Check port 443 is open: `sudo ss -tlnp | grep 443`
