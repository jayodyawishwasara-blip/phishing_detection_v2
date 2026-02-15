#!/bin/bash

# ========================================================================
# Complete Tailwind CSS Fix with Debugging
# ========================================================================

set -e

echo "=========================================================================="
echo "   Tailwind CSS Installation & Build (With Debugging)"
echo "=========================================================================="
echo ""

cd /opt/phishing-defense/frontend

# Step 1: Check current state
echo "📋 Step 1: Checking current state..."
echo ""

if [ -f "node_modules/.bin/tailwindcss" ]; then
    echo "✅ Tailwind is installed"
else
    echo "❌ Tailwind is NOT installed"
fi

if [ -f "tailwind.config.js" ]; then
    echo "✅ Tailwind config exists"
else
    echo "❌ Tailwind config missing"
fi

echo ""
echo "Current CSS file:"
ls -lh build/static/css/*.css 2>/dev/null || echo "No build yet"

echo ""
read -p "Press Enter to continue with installation..."

# Step 2: Clean everything
echo ""
echo "🗑️  Step 2: Cleaning old build..."
rm -rf build
rm -rf node_modules/.cache
echo "✅ Clean complete"

# Step 3: Install Tailwind
echo ""
echo "📦 Step 3: Installing Tailwind CSS..."
npm install -D tailwindcss@latest postcss@latest autoprefixer@latest
echo "✅ Tailwind packages installed"

# Step 4: Create Tailwind config
echo ""
echo "⚙️  Step 4: Creating Tailwind configuration..."

cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

echo "✅ Configuration files created"

# Step 5: Update CSS
echo ""
echo "📝 Step 5: Updating index.css with Tailwind directives..."

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

# Step 6: Verify Tailwind installation
echo ""
echo "🔍 Step 6: Verifying Tailwind installation..."
npx tailwindcss --help > /dev/null 2>&1 && echo "✅ Tailwind CLI works" || echo "❌ Tailwind CLI failed"

# Step 7: Build
echo ""
echo "🔨 Step 7: Building production build (this takes 3-5 minutes)..."
echo "⏳ Please wait, do not interrupt..."
echo ""

CI=false npm run build

echo ""
echo "✅ Build complete!"

# Step 8: Check build output
echo ""
echo "📊 Step 8: Checking build output..."
echo ""

echo "CSS files generated:"
ls -lh build/static/css/

echo ""
echo "CSS file size:"
du -h build/static/css/*.css

echo ""
echo "Checking for Tailwind classes in CSS..."
if grep -q "bg-gradient-to-br" build/static/css/*.css; then
    echo "✅ Tailwind classes found in CSS!"
else
    echo "❌ Tailwind classes NOT in CSS - build may have failed"
fi

# Step 9: Restart Caddy
echo ""
echo "🔄 Step 9: Restarting Caddy..."
sudo systemctl restart caddy
echo "✅ Caddy restarted"

# Step 10: Final instructions
echo ""
echo "=========================================================================="
echo "   ✅ Installation Complete!"
echo "=========================================================================="
echo ""
echo "🌐 Now do this:"
echo ""
echo "1. Open browser in INCOGNITO/PRIVATE mode"
echo "   (This bypasses cache)"
echo ""
echo "2. Go to: http://194.233.84.223"
echo ""
echo "3. Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)"
echo "   (This forces a hard refresh)"
echo ""
echo "4. You should see:"
echo "   ✓ Dark gradient background (blue to gray)"
echo "   ✓ Styled login form with rounded corners"
echo "   ✓ Blue login button"
echo "   ✓ Professional appearance"
echo ""
echo "📊 Build Summary:"
ls -lh build/static/css/*.css
echo ""
echo "🔍 If still not working, check browser console:"
echo "   Right-click → Inspect → Console tab"
echo "   Look for CSS loading errors"
echo ""
echo "=========================================================================="
