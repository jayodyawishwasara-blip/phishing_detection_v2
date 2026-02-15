#!/bin/bash

# ========================================================================
# Tailwind CSS v3 Installation (Fixed Version)
# ========================================================================

set -e

echo "=========================================================================="
echo "   Installing Tailwind CSS v3 (Stable)"
echo "=========================================================================="
echo ""

cd /opt/phishing-defense/frontend

# Step 1: Remove any existing Tailwind
echo "🗑️  Removing any existing Tailwind installation..."
npm uninstall tailwindcss postcss autoprefixer 2>/dev/null || true
rm -f tailwind.config.js postcss.config.js

# Step 2: Install Tailwind CSS v3 (stable version)
echo ""
echo "📦 Installing Tailwind CSS v3..."
npm install -D tailwindcss@^3.4.1 postcss@^8.4.35 autoprefixer@^10.4.17

echo "✅ Tailwind v3 installed"

# Step 3: Initialize Tailwind
echo ""
echo "⚙️  Initializing Tailwind configuration..."
npx tailwindcss init -p

# Step 4: Update Tailwind config
echo ""
echo "📝 Configuring Tailwind..."

cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

# Verify PostCSS config was created
if [ ! -f "postcss.config.js" ]; then
  cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
fi

echo "✅ Configuration complete"

# Step 5: Update index.css
echo ""
echo "📝 Updating index.css..."

cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

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

echo "✅ CSS updated"

# Step 6: Clean build
echo ""
echo "🗑️  Cleaning old build..."
rm -rf build
rm -rf node_modules/.cache

# Step 7: Build
echo ""
echo "🔨 Building production build..."
echo "⏳ This will take 3-5 minutes, please wait..."
echo ""

CI=false npm run build

# Step 8: Verify build
echo ""
echo "=========================================================================="
echo "   ✅ Build Complete!"
echo "=========================================================================="
echo ""

echo "📊 Build verification:"
echo ""

# Check CSS file size
echo "CSS files:"
ls -lh build/static/css/*.css

echo ""
echo "CSS file size:"
du -h build/static/css/*.css

echo ""

# Check for Tailwind classes
if grep -q "bg-gradient-to-br" build/static/css/*.css 2>/dev/null; then
    echo "✅ Tailwind classes found in CSS! Build successful!"
    
    # Restart Caddy
    echo ""
    echo "🔄 Restarting Caddy..."
    sudo systemctl restart caddy
    echo "✅ Caddy restarted"
    
    echo ""
    echo "=========================================================================="
    echo "   🎉 INSTALLATION SUCCESSFUL!"
    echo "=========================================================================="
    echo ""
    echo "🌐 NOW DO THIS:"
    echo ""
    echo "1. Open browser in INCOGNITO/PRIVATE mode"
    echo "2. Go to: http://194.233.84.223"
    echo "3. Press Ctrl+Shift+R (hard refresh)"
    echo ""
    echo "You should see:"
    echo "  ✓ Dark gradient background (blue to gray)"
    echo "  ✓ Styled login form with rounded corners"
    echo "  ✓ Blue login button"
    echo "  ✓ Professional appearance"
    echo ""
    echo "=========================================================================="
else
    echo "❌ Tailwind classes NOT found in CSS"
    echo "Build may have failed. Check errors above."
fi
