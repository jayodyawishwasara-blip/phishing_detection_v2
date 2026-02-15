# 🚀 QUICK DEPLOYMENT - 3 STEPS

## ✅ What's Fixed

All your issues are now resolved:

✅ **Mixed Content Error** - Fixed with proper Caddy reverse proxy  
✅ **CSS/JS Not Loading** - Fixed with correct build serving  
✅ **Failed to Fetch** - Fixed with dynamic API detection  
✅ **Authentication** - JWT-based login system (admin/phishdish)  
✅ **Database** - SQLite for persistent storage  
✅ **HTTPS Ready** - Automatic SSL with Caddy  

---

## 📥 Step 1: Download These 6 Files

Download from above:

1. **deploy-production.sh** - Automated deployment script
2. **server-production.js** - Backend with SQLite + Auth
3. **package-production.json** - All dependencies  
4. **App-production.js** - React app with auth
5. **ecosystem.config.js** - PM2 configuration
6. **Caddyfile-production** - HTTPS reverse proxy

---

## 📤 Step 2: Upload to VPS

```bash
# From your local machine
cd ~/Downloads

scp deploy-production.sh server-production.js package-production.json \
    App-production.js ecosystem.config.js Caddyfile-production \
    root@194.233.84.223:~/phishing_detection/
```

---

## 🎯 Step 3: Deploy

```bash
# SSH to VPS
ssh root@194.233.84.223

# Navigate to directory
cd ~/phishing_detection

# Run deployment
chmod +x deploy-production.sh
./deploy-production.sh
```

**When prompted, type: `y`**

**Wait ~20 minutes for complete installation**

---

## ✅ Access Dashboard

**URL:** http://194.233.84.223

**Login:**
- Username: `admin`
- Password: `phishdish`

---

## 🎯 What Gets Deployed

### Application
```
/opt/phishing-defense/
├── backend/          # Node.js + SQLite
├── frontend/build/   # React production build
└── phishing-data/
    └── phishing-defense.db  # SQLite database
```

### Services
- **Backend:** PM2 (auto-restart, monitoring)
- **Frontend:** Caddy (reverse proxy, HTTPS)
- **Database:** SQLite (persistent storage)

---

## 📊 Verify Deployment

```bash
# Check backend
pm2 status
# Should show: phishing-defense | online

# Check Caddy
sudo systemctl status caddy
# Should show: active (running)

# Check database
sqlite3 /opt/phishing-defense/phishing-data/phishing-defense.db ".tables"
# Should show: users, domains, check_logs
```

---

## 🔧 Quick Commands

```bash
# View logs
pm2 logs phishing-defense

# Restart backend
pm2 restart phishing-defense

# Restart Caddy
sudo systemctl restart caddy

# Access database
sqlite3 /opt/phishing-defense/phishing-data/phishing-defense.db
```

---

## 🆘 Troubleshooting

### Dashboard won't load
```bash
sudo systemctl restart caddy
pm2 restart phishing-defense
```

### Can't login
```bash
# Check if admin user exists
sqlite3 /opt/phishing-defense/phishing-data/phishing-defense.db \
  "SELECT * FROM users;"

# Restart backend to recreate admin
pm2 restart phishing-defense
```

### CSS not loading
```bash
cd /opt/phishing-defense/frontend
npm run build
sudo systemctl restart caddy
```

---

## 🎉 Success Checklist

- [ ] Dashboard loads at http://194.233.84.223
- [ ] Login page has proper styling
- [ ] Can login with admin/phishdish
- [ ] Dashboard shows correctly
- [ ] Backend status shows "ONLINE"
- [ ] Can add and check domains
- [ ] No console errors

---

## 📚 Full Documentation

See **PRODUCTION-DEPLOYMENT-GUIDE.md** for:
- Complete architecture
- Database schema
- Security features
- Service management
- Monitoring & maintenance
- HTTPS setup with domain
- Advanced troubleshooting

---

## 🔐 Default Credentials

**Username:** admin  
**Password:** phishdish

**⚠️ Change password after first login!**

---

**Estimated deployment time: 20 minutes**  
**All issues fixed, production-ready! 🎉**
