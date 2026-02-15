#!/bin/bash

# ========================================================================
# Phishing Defense Platform - COMPLETE Production Deployment
# Includes: SQLite, Authentication, HTTPS, All fixes
# ========================================================================

set -e

PUBLIC_IP="194.233.84.223"
APP_DIR="/opt/phishing-defense"

echo "=========================================================================="
echo "   Phishing Defense Platform - Production Deployment"
echo "   Version: 3.0 (SQLite + Auth + HTTPS)"
echo "=========================================================================="
echo ""

# ========================================================================
# Step 0: Pre-deployment Cleanup
# ========================================================================
echo "Step 0: Checking for existing installation..."

if [ -d "$APP_DIR" ]; then
    echo "⚠️  Found existing installation"
    read -p "Remove and deploy fresh? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Stopping services..."
        pm2 delete phishing-defense 2>/dev/null || true
        
        echo "🗑️  Removing old installation..."
        sudo rm -rf "$APP_DIR"
        echo "✅ Cleanup complete"
    else
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

echo ""

# ========================================================================
# Step 1: Install Prerequisites
# ========================================================================
echo "──────────────────────────────────────────────────────────────────────"
echo "   Step 1: Installing Prerequisites"
echo "──────────────────────────────────────────────────────────────────────"
echo ""

# Update system
sudo apt update
sudo apt upgrade -y

# Remove old Node.js
sudo apt remove -y nodejs npm 2>/dev/null || true

# Install Node.js 20.x LTS
echo "📦 Installing Node.js 20.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "✅ Node.js $(node --version) installed"
echo "✅ npm $(npm --version) installed"

# Install PM2
sudo npm install -g pm2

# Install build tools
sudo apt install -y build-essential git bc python3

# Install SQLite
sudo apt install -y sqlite3 libsqlite3-dev

# Install Chromium dependencies (Ubuntu 24.04 compatible)
UBUNTU_VERSION=$(lsb_release -rs)

sudo apt-get install -y \
    ca-certificates fonts-liberation wget xdg-utils lsb-release

if [[ $(echo "$UBUNTU_VERSION >= 24.04" | bc -l) -eq 1 ]]; then
    sudo apt-get install -y \
        libappindicator3-1 libasound2t64 libatk-bridge2.0-0t64 \
        libatk1.0-0t64 libc6 libcairo2 libcups2t64 libdbus-1-3 \
        libexpat1 libfontconfig1 libgbm1 libgcc-s1 libglib2.0-0t64 \
        libgtk-3-0t64 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
        libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
        libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
        libxrandr2 libxrender1 libxss1 libxtst6
else
    sudo apt-get install -y \
        libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 \
        libcups2 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
        libpango-1.0-0 libpangocairo-1.0-0 libx11-6 libx11-xcb1 \
        libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
        libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6
fi

echo "✅ All prerequisites installed"

# ========================================================================
# Step 2: Install/Update Caddy
# ========================================================================
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "   Step 2: Installing Caddy"
echo "──────────────────────────────────────────────────────────────────────"
echo ""

if ! command -v caddy &> /dev/null; then
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update
    sudo apt install -y caddy
fi

echo "✅ Caddy installed: $(caddy version)"

# ========================================================================
# Step 3: Create Application Structure
# ========================================================================
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "   Step 3: Creating Application Structure"
echo "──────────────────────────────────────────────────────────────────────"
echo ""

sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR
cd $APP_DIR

# Create directories
mkdir -p phishing-data/{logs,screenshots,baseline}
mkdir -p backend frontend

echo "✅ Directory structure created"

# ========================================================================
# Step 4: Setup Backend
# ========================================================================
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "   Step 4: Setting Up Backend"
echo "──────────────────────────────────────────────────────────────────────"
echo ""

cd backend

# Check if production files exist in ~/phishing_detection
SOURCE_DIR=~/phishing_detection

if [ ! -f "$SOURCE_DIR/server-production.js" ]; then
    echo "❌ server-production.js not found in $SOURCE_DIR"
    echo "Please upload these files to $SOURCE_DIR:"
    echo "  - server-production.js"
    echo "  - package-production.json"
    echo "  - ecosystem.config.js"
    echo "  - App-production.js"
    exit 1
fi

# Copy backend files
cp "$SOURCE_DIR/server-production.js" server.js
cp "$SOURCE_DIR/package-production.json" package.json
cp "$SOURCE_DIR/ecosystem.config.js" ecosystem.config.js

echo "📦 Installing backend dependencies (5-7 minutes)..."
npm install

# Generate random JWT secret
JWT_SECRET=$(openssl rand -hex 32)

# Update ecosystem.config.js with generated secret
sed -i "s/change-this-secret-in-production-use-random-string/$JWT_SECRET/" ecosystem.config.js

echo "✅ Backend configured with secure JWT secret"

# ========================================================================
# Step 5: Setup Frontend
# ========================================================================
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "   Step 5: Setting Up Frontend"
echo "──────────────────────────────────────────────────────────────────────"
echo ""

cd $APP_DIR/frontend

# Create React app structure
echo "📁 Creating React application..."
npx -y create-react-app . 2>/dev/null || {
    # If create-react-app fails, create manually
    npm init -y
    npm install react react-dom react-scripts lucide-react
}

# Install additional dependencies
npm install lucide-react

# Copy production App.js
if [ -f "$SOURCE_DIR/App-production.js" ]; then
    mkdir -p src
    cp "$SOURCE_DIR/App-production.js" src/App.js
    echo "✅ Frontend App.js copied"
else
    echo "❌ App-production.js not found in $SOURCE_DIR"
    exit 1
fi

# Create index.js
cat > src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

# Create index.css
cat > src/index.css << 'EOF'
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}
EOF

# Create public/index.html if not exists
mkdir -p public
if [ ! -f "public/index.html" ]; then
    cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Phishing Defense Platform" />
    <title>Phishing Defense Platform</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF
fi

echo "🔨 Building production frontend (3-5 minutes)..."
npm run build

echo "✅ Frontend built successfully"

# ========================================================================
# Step 6: Configure Caddy
# ========================================================================
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "   Step 6: Configuring Caddy"
echo "──────────────────────────────────────────────────────────────────────"
echo ""

if [ -f "$SOURCE_DIR/Caddyfile-production" ]; then
    sudo cp "$SOURCE_DIR/Caddyfile-production" /etc/caddy/Caddyfile
    echo "✅ Caddyfile configured"
else
    echo "⚠️  Caddyfile-production not found, using default configuration"
fi

# Validate Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile

echo "✅ Caddyfile validated"

# ========================================================================
# Step 7: Configure Firewall
# ========================================================================
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "   Step 7: Configuring Firewall"
echo "──────────────────────────────────────────────────────────────────────"
echo ""

sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable 2>/dev/null || true

echo "✅ Firewall configured"

# ========================================================================
# Step 8: Start Services
# ========================================================================
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "   Step 8: Starting Services"
echo "──────────────────────────────────────────────────────────────────────"
echo ""

# Start backend with PM2
cd $APP_DIR/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp $(eval echo ~$USER)

# Restart Caddy
sudo systemctl restart caddy
sudo systemctl enable caddy

echo "✅ All services started"

# ========================================================================
# Deployment Complete
# ========================================================================
echo ""
echo "=========================================================================="
echo "   ✅ PRODUCTION DEPLOYMENT COMPLETE!"
echo "=========================================================================="
echo ""
echo "🌐 Access Dashboard:"
echo "   http://$PUBLIC_IP"
echo "   (Will auto-redirect to HTTPS if domain configured)"
echo ""
echo "🔐 Login Credentials:"
echo "   Username: admin"
echo "   Password: phishdish"
echo ""
echo "📊 System Information:"
echo "   Node.js: $(node --version)"
echo "   SQLite: $(sqlite3 --version)"
echo "   Database: $APP_DIR/phishing-data/phishing-defense.db"
echo "   Application: $APP_DIR"
echo ""
echo "🔧 Service Management:"
echo "   Backend:  pm2 status"
echo "   Caddy:    sudo systemctl status caddy"
echo "   Database: sqlite3 $APP_DIR/phishing-data/phishing-defense.db"
echo ""
echo "📝 View Logs:"
echo "   Backend:  pm2 logs phishing-defense"
echo "   Caddy:    sudo journalctl -u caddy -f"
echo "   Database: Check $APP_DIR/phishing-data/logs/"
echo ""
echo "🔄 Restart Services:"
echo "   Backend:  pm2 restart phishing-defense"
echo "   Caddy:    sudo systemctl restart caddy"
echo ""
echo "🔒 Security Notes:"
echo "   - Change admin password after first login"
echo "   - JWT secret automatically generated: $JWT_SECRET"
echo "   - All API calls require authentication"
echo "   - HTTPS ready when domain is configured"
echo ""
echo "🎯 Next Steps:"
echo "   1. Open http://$PUBLIC_IP in browser"
echo "   2. Login with admin/phishdish"
echo "   3. Add domains to monitor"
echo "   4. (Optional) Configure domain for HTTPS"
echo ""
echo "=========================================================================="
