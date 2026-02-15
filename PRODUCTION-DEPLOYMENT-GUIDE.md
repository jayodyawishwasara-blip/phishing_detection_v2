# 🚀 PRODUCTION DEPLOYMENT GUIDE
## Phishing Defense Platform v3.0

Complete guide for deploying a secure, production-ready phishing detection platform with HTTPS, authentication, and persistent storage.

---

## 📋 What's New in v3.0

✅ **SQLite Database** - Persistent storage for domains and check logs  
✅ **Authentication System** - JWT-based login (admin/phishdish)  
✅ **HTTPS Support** - Proper reverse proxy with Caddy  
✅ **Mixed Content Fixed** - All API calls work over HTTPS  
✅ **Static Assets Fixed** - CSS/JS load correctly  
✅ **CORS Configured** - Proper cross-origin handling  

---

## 📦 Files You Need

Download these 6 files from Claude:

### Backend Files (3):
1. **server-production.js** - Backend with SQLite + Auth
2. **package-production.json** - All dependencies
3. **ecosystem.config.js** - PM2 configuration

### Frontend Files (1):
4. **App-production.js** - React app with auth + dynamic API

### Configuration Files (2):
5. **Caddyfile-production** - HTTPS reverse proxy config
6. **deploy-production.sh** - Automated deployment script

---

## 🎯 Deployment Steps

### Step 1: Upload Files to VPS

From your local machine:

```bash
# Navigate to downloads
cd ~/Downloads

# Upload all files
scp server-production.js package-production.json ecosystem.config.js \
    App-production.js Caddyfile-production deploy-production.sh \
    root@194.233.84.223:~/phishing_detection/
```

---

### Step 2: SSH to VPS

```bash
ssh root@194.233.84.223
```

---

### Step 3: Run Deployment

```bash
cd ~/phishing_detection

# Make script executable
chmod +x deploy-production.sh

# Run deployment
./deploy-production.sh
```

**When prompted about existing installation, type: `y`**

---

### Step 4: Wait for Completion

The script will:
- ✅ Install Node.js 20.x, SQLite, PM2, Caddy
- ✅ Create application structure
- ✅ Install all dependencies (~10 minutes)
- ✅ Build frontend production build (~5 minutes)
- ✅ Initialize SQLite database
- ✅ Create admin user
- ✅ Generate secure JWT secret
- ✅ Configure and start services

**Total time: ~20 minutes**

---

### Step 5: Access Dashboard

Open browser: **http://194.233.84.223**

Login:
- **Username:** `admin`
- **Password:** `phishdish`

---

## 🗂️ Project Structure

```
/opt/phishing-defense/
├── backend/
│   ├── server.js                    # Main server (production)
│   ├── package.json                 # Dependencies
│   ├── ecosystem.config.js          # PM2 config
│   └── node_modules/               # Installed packages
│
├── frontend/
│   ├── build/                      # Production build (served by Caddy)
│   ├── src/
│   │   ├── App.js                  # React app (production)
│   │   ├── index.js
│   │   └── index.css
│   ├── public/
│   └── package.json
│
└── phishing-data/
    ├── phishing-defense.db         # SQLite database ⭐
    ├── baseline/
    │   ├── baseline.json
    │   └── screenshot.png
    ├── screenshots/                # Domain screenshots
    ├── logs/
    │   ├── pm2-error.log
    │   └── pm2-out.log
    └── (other data files)
```

---

## 🔧 How It Works

### Architecture

```
Internet (HTTPS/HTTP)
    ↓
Caddy (Port 80/443)
    ├→ /api/* → Backend (localhost:5000) → SQLite DB
    ├→ /screenshots/* → Static files
    └→ /* → Frontend (React build)
```

### Authentication Flow

1. User visits site → Sees login page
2. Enters admin/phishdish
3. Backend validates credentials
4. Returns JWT token (24h expiry)
5. Token stored in sessionStorage
6. All API calls include: `Authorization: Bearer <token>`
7. Backend validates token on every request

### API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | No | Login and get token |
| `/api/monitoring-status` | GET | Yes | Backend status |
| `/api/domains` | GET | Yes | List all domains |
| `/api/domains` | POST | Yes | Add domain |
| `/api/domains/:domain` | DELETE | Yes | Remove domain |
| `/api/check/:domain` | GET | Yes | Check domain for phishing |
| `/api/start-monitoring` | POST | Yes | Start auto-monitoring |
| `/api/stop-monitoring` | POST | Yes | Stop auto-monitoring |
| `/api/baseline/refresh` | POST | Yes | Refresh baseline |

### Database Schema

**users table:**
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at DATETIME
);
```

**domains table:**
```sql
CREATE TABLE domains (
    id INTEGER PRIMARY KEY,
    domain TEXT UNIQUE,
    similarity INTEGER DEFAULT 0,
    last_checked DATETIME,
    screenshot TEXT,
    details TEXT,  -- JSON: {textSimilarity, visualSimilarity, etc}
    added_at DATETIME
);
```

**check_logs table:**
```sql
CREATE TABLE check_logs (
    id INTEGER PRIMARY KEY,
    domain TEXT,
    similarity INTEGER,
    threat_level TEXT,  -- 'low', 'medium', 'high'
    details TEXT,       -- JSON
    checked_at DATETIME
);
```

---

## 🔐 Security Features

### 1. Authentication
- ✅ JWT tokens with 24h expiry
- ✅ bcrypt password hashing (10 rounds)
- ✅ Secure token storage (sessionStorage)
- ✅ Auto-logout on token expiry

### 2. HTTPS Support
- ✅ Caddy handles TLS automatically
- ✅ HSTS headers when using domain
- ✅ Secure cookie flags ready

### 3. CORS Configuration
- ✅ Allow credentials
- ✅ Proper origin handling
- ✅ Pre-flight support

### 4. Security Headers
- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: SAMEORIGIN
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Content-Security-Policy
- ✅ Referrer-Policy

---

## 🛠️ Service Management

### Check Status

```bash
# Backend
pm2 status

# Caddy
sudo systemctl status caddy

# Database
sqlite3 /opt/phishing-defense/phishing-data/phishing-defense.db ".tables"
```

### View Logs

```bash
# Backend logs (real-time)
pm2 logs phishing-defense

# Backend logs (last 50 lines)
pm2 logs phishing-defense --lines 50

# Caddy logs
sudo journalctl -u caddy -f

# Access Caddy log file
sudo tail -f /var/log/caddy/phishing-defense-access.log
```

### Restart Services

```bash
# Restart backend
pm2 restart phishing-defense

# Restart Caddy
sudo systemctl restart caddy

# Restart both
pm2 restart phishing-defense && sudo systemctl restart caddy
```

### Stop Services

```bash
# Stop backend
pm2 stop phishing-defense

# Stop Caddy
sudo systemctl stop caddy

# Stop both
pm2 stop phishing-defense && sudo systemctl stop caddy
```

---

## 💾 Database Management

### Access Database

```bash
# Open SQLite CLI
sqlite3 /opt/phishing-defense/phishing-data/phishing-defense.db

# In SQLite:
.tables                    # List tables
SELECT * FROM domains;     # View all domains
SELECT * FROM users;       # View users
SELECT * FROM check_logs ORDER BY checked_at DESC LIMIT 10;  # Recent checks
.quit                      # Exit
```

### Backup Database

```bash
# Create backup
sqlite3 /opt/phishing-defense/phishing-data/phishing-defense.db ".backup /tmp/backup.db"

# Copy to local machine
scp root@194.233.84.223:/tmp/backup.db ./phishing-backup-$(date +%Y%m%d).db
```

### Reset Database

```bash
# Stop backend
pm2 stop phishing-defense

# Remove database
rm /opt/phishing-defense/phishing-data/phishing-defense.db

# Restart backend (will recreate database)
pm2 restart phishing-defense

# Default admin user will be recreated
```

---

## 🔒 Adding HTTPS with Domain

### Step 1: Configure DNS

Point your domain to the VPS:

```
Type: A
Name: phishing-detector (or @)
Value: 194.233.84.223
TTL: 3600
```

### Step 2: Update Caddyfile

```bash
sudo nano /etc/caddy/Caddyfile
```

Uncomment the domain section and replace with your domain:

```caddy
phishing-detector.yourdomain.com {
    # ... rest of config
}
```

### Step 3: Restart Caddy

```bash
sudo systemctl restart caddy
```

**Caddy will automatically:**
- Obtain SSL certificate from Let's Encrypt
- Configure HTTPS
- Redirect HTTP to HTTPS

Access via: `https://phishing-detector.yourdomain.com`

---

## 🧪 Testing the Deployment

### 1. Test Login

```bash
curl -X POST http://194.233.84.223/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"phishdish"}'

# Should return: {"token":"...","user":{...}}
```

### 2. Test Authenticated Endpoint

```bash
# Get token from login
TOKEN="your-jwt-token-here"

curl http://194.233.84.223/api/monitoring-status \
  -H "Authorization: Bearer $TOKEN"

# Should return: {"status":"online",...}
```

### 3. Test Frontend

1. Open: http://194.233.84.223
2. Should see login page
3. Login with admin/phishdish
4. Should see dashboard
5. Check browser console - no errors

---

## 🐛 Troubleshooting

### Issue: Can't access dashboard

**Check Caddy:**
```bash
sudo systemctl status caddy
sudo journalctl -u caddy -n 50
```

**Fix:**
```bash
# Restart Caddy
sudo systemctl restart caddy

# Check firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

### Issue: Backend not running

**Check PM2:**
```bash
pm2 status
pm2 logs phishing-defense --lines 50
```

**Fix:**
```bash
# Restart backend
pm2 restart phishing-defense

# If still failing, check dependencies
cd /opt/phishing-defense/backend
npm install
pm2 restart phishing-defense
```

---

### Issue: Login fails

**Check database:**
```bash
sqlite3 /opt/phishing-defense/phishing-data/phishing-defense.db "SELECT * FROM users;"
```

**Fix:**
```bash
# Recreate admin user
sqlite3 /opt/phishing-defense/phishing-data/phishing-defense.db

# In SQLite:
DELETE FROM users WHERE username='admin';
.quit

# Restart backend (will recreate admin)
pm2 restart phishing-defense
```

---

### Issue: CSS/JS not loading

**Check build:**
```bash
ls -la /opt/phishing-defense/frontend/build/
ls -la /opt/phishing-defense/frontend/build/static/
```

**Fix:**
```bash
# Rebuild frontend
cd /opt/phishing-defense/frontend
npm run build

# Restart Caddy
sudo systemctl restart caddy
```

---

### Issue: Mixed content errors

**Check Caddyfile:**
```bash
sudo cat /etc/caddy/Caddyfile | grep "reverse_proxy"
```

**Should see:**
```caddy
handle /api/* {
    reverse_proxy localhost:5000
}
```

**If missing:**
```bash
# Recopy Caddyfile
sudo cp ~/phishing_detection/Caddyfile-production /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

---

## 📊 Monitoring & Maintenance

### Daily Checks

```bash
# Check services
pm2 status && sudo systemctl status caddy

# Check disk space
df -h

# Check database size
du -h /opt/phishing-defense/phishing-data/phishing-defense.db

# Check recent logs
pm2 logs phishing-defense --lines 20
```

### Weekly Tasks

```bash
# Backup database
sqlite3 /opt/phishing-defense/phishing-data/phishing-defense.db \
  ".backup /opt/phishing-defense/backups/backup-$(date +%Y%m%d).db"

# Clean old screenshots (optional)
find /opt/phishing-defense/phishing-data/screenshots -mtime +30 -delete

# Update system
sudo apt update && sudo apt upgrade -y
```

### Monthly Tasks

```bash
# Update Node.js packages
cd /opt/phishing-defense/backend
npm update
pm2 restart phishing-defense

cd /opt/phishing-defense/frontend
npm update
npm run build
sudo systemctl restart caddy
```

---

## 🎯 Success Checklist

After deployment, verify:

- [ ] Dashboard accessible at http://194.233.84.223
- [ ] Login page appears (not blank/unstyled)
- [ ] Can login with admin/phishdish
- [ ] Dashboard shows properly (CSS loaded)
- [ ] Backend status shows "ONLINE"
- [ ] Can add domain to watchlist
- [ ] "Check Now" button works
- [ ] Detection runs and shows similarity score
- [ ] No console errors in browser
- [ ] `pm2 status` shows "online"
- [ ] `sudo systemctl status caddy` shows "active"

---

## 🆘 Getting Help

### Collect Debug Info

```bash
# Create debug report
cat > /tmp/debug-report.txt << EOF
=== System Info ===
$(uname -a)
$(node --version)
$(npm --version)

=== PM2 Status ===
$(pm2 status)

=== PM2 Logs ===
$(pm2 logs phishing-defense --lines 50 --nostream)

=== Caddy Status ===
$(sudo systemctl status caddy)

=== Caddy Logs ===
$(sudo journalctl -u caddy -n 50 --no-pager)

=== Database ===
$(sqlite3 /opt/phishing-defense/phishing-data/phishing-defense.db ".schema")

=== Disk Space ===
$(df -h)
EOF

# View report
cat /tmp/debug-report.txt
```

---

## 🎉 You're Done!

Your production-ready phishing detection platform is now:
- ✅ Secure with authentication
- ✅ Persistent with SQLite
- ✅ HTTPS-ready
- ✅ Auto-restarting with PM2
- ✅ Production-optimized

**Default login:** admin / phishdish  
**Access:** http://194.233.84.223

Change the admin password after first login!
