# SSL Domain Setup - prudential-uat.innocorn.net

## ✅ SSL Configuration Complete

### Domain Information
- **Domain:** prudential-uat.innocorn.net
- **Protocol:** HTTPS (SSL/TLS)
- **HTTP Port:** 80 (redirects to HTTPS)
- **HTTPS Port:** 443

### SSL Certificates
- **Certificate File:** `/home/aditya.developer/prudential/cert.pem`
- **Private Key:** `/home/aditya.developer/prudential/cert.key`

### Nginx Configuration
- **Config File:** `/etc/nginx/sites-available/prudential`
- **Backup:** `/etc/nginx/sites-available/prudential.bak`
- **Enabled:** `/etc/nginx/sites-enabled/prudential` (symlink)

---

## Configuration Details

### HTTP → HTTPS Redirect
All HTTP traffic on port 80 is automatically redirected to HTTPS:
```
http://prudential-uat.innocorn.net → https://prudential-uat.innocorn.net
```

### HTTPS Server (Port 443)
- **SSL Protocols:** TLSv1.2, TLSv1.3
- **HTTP/2:** Enabled
- **Session Cache:** 10 minutes
- **Security Headers:** Enabled (HSTS, X-Frame-Options, etc.)

### Backend Services
- **Frontend (React):** http://localhost:3001
- **Backend (Flask):** http://localhost:5001

### Proxy Configuration
- Frontend: All requests to `/` go to React app
- Backend API: All requests to `/api` go to Flask
- Timeouts: 600s (10 minutes) for long image processing
- Max Upload: 50MB

---

## Security Features

### SSL/TLS Configuration
✅ Modern protocols only (TLSv1.2, TLSv1.3)
✅ Strong cipher suites
✅ Server-preferred ciphers
✅ Session caching for performance

### Security Headers
✅ **HSTS:** Forces HTTPS for 1 year
✅ **X-Frame-Options:** Prevents clickjacking
✅ **X-Content-Type-Options:** Prevents MIME sniffing
✅ **X-XSS-Protection:** Enables XSS filtering

---

## DNS Configuration Required

### To make the domain work, configure DNS:

**A Record:**
```
prudential-uat.innocorn.net → 34.21.174.189
```

**Or if using a subdomain:**
```
Type: A
Host: prudential-uat
Value: 34.21.174.189
TTL: 3600 (1 hour)
```

---

## Testing

### After DNS propagation, test:

**1. HTTP Redirect:**
```bash
curl -I http://prudential-uat.innocorn.net
# Should return: 301 redirect to https://
```

**2. HTTPS Access:**
```bash
curl -I https://prudential-uat.innocorn.net
# Should return: 200 OK
```

**3. Browser Test:**
```
https://prudential-uat.innocorn.net/prudential/
```

---

## URLs

### User Portal
```
https://prudential-uat.innocorn.net/prudential/
```

### Admin Login
```
https://prudential-uat.innocorn.net/prudential/admin/login
```

### Admin Dashboard
```
https://prudential-uat.innocorn.net/prudential/admin
```

### Certificate History
```
https://prudential-uat.innocorn.net/prudential/history
```

---

## Maintenance Commands

### Reload Nginx (after config changes)
```bash
sudo nginx -t                    # Test configuration
sudo systemctl reload nginx      # Apply changes
```

### Check Nginx Status
```bash
sudo systemctl status nginx
sudo ss -tlnp | grep nginx       # Check listening ports
```

### View Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Certificate Renewal (when needed)
1. Replace files: `/home/aditya.developer/prudential/cert.pem` and `cert.key`
2. Reload nginx: `sudo systemctl reload nginx`

---

## Rollback (if needed)

### Restore old configuration:
```bash
sudo cp /etc/nginx/sites-available/prudential.bak /etc/nginx/sites-available/prudential
sudo systemctl reload nginx
```

---

## Status: ✅ Ready for Production

- SSL certificates installed
- Nginx configured and running
- HTTP→HTTPS redirect active
- Security headers enabled
- Backend services connected
- Ready for DNS configuration
