const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');
const Jimp = require('jimp');
const natural = require('natural');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 5000;

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'phishing-defense-secret-key-change-in-production';

// CORS Configuration - Allow all origins in production
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Data storage paths
const DATA_DIR = path.join(__dirname, '../phishing-data');
const DB_FILE = path.join(DATA_DIR, 'phishing-defense.db');
const BASELINE_FILE = path.join(DATA_DIR, 'baseline/baseline.json');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

// Serve screenshots statically
app.use('/screenshots', express.static(SCREENSHOTS_DIR));

// Configuration
const LEGITIMATE_SITE = 'https://combankdigital.com';
const SIMILARITY_THRESHOLD = 75;

// Global state
let baseline = null;
let monitoringInterval = null;
let db = null;

// Initialize SQLite database
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_FILE, async (err) => {
      if (err) {
        console.error('Database connection error:', err);
        reject(err);
        return;
      }

      console.log('Connected to SQLite database');

      // Create tables
      db.serialize(async () => {
        // Users table
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Domains table
        db.run(`
          CREATE TABLE IF NOT EXISTS domains (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT UNIQUE NOT NULL,
            similarity INTEGER DEFAULT 0,
            last_checked DATETIME,
            screenshot TEXT,
            details TEXT,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Check logs table
        db.run(`
          CREATE TABLE IF NOT EXISTS check_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL,
            similarity INTEGER,
            threat_level TEXT,
            details TEXT,
            checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create default admin user if not exists
        const adminPassword = await bcrypt.hash('phishdish', 10);
        db.run(
          `INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)`,
          ['admin', adminPassword],
          (err) => {
            if (err) {
              console.error('Error creating admin user:', err);
            } else {
              console.log('Admin user initialized (username: admin, password: phishdish)');
            }
          }
        );

        resolve();
      });
    });
  });
}

// Initialize data directories
async function initializeDirectories() {
  const dirs = [
    DATA_DIR,
    path.join(DATA_DIR, 'baseline'),
    path.join(DATA_DIR, 'screenshots'),
    path.join(DATA_DIR, 'logs')
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${dir}:`, error);
    }
  }
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Database helper functions
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Create baseline from legitimate site
async function createBaseline() {
  console.log('Creating baseline from legitimate site...');
  
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(LEGITIMATE_SITE, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);
    
    const screenshotPath = path.join(DATA_DIR, 'baseline/screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    await browser.close();

    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const brandKeywords = extractBrandKeywords(text);
    const forms = Array.from(document.querySelectorAll('form'));
    const formFields = forms.map(form => {
      return Array.from(form.querySelectorAll('input')).map(input => ({
        type: input.type,
        name: input.name || input.id,
        placeholder: input.placeholder
      }));
    }).flat();

    const domStructure = extractDOMStructure(document);

    baseline = {
      url: LEGITIMATE_SITE,
      html,
      text,
      screenshot: screenshotPath,
      brandKeywords,
      formFields,
      domStructure,
      createdAt: new Date().toISOString(),
      textLength: text.length,
      wordCount: text.split(/\s+/).length
    };

    await fs.writeFile(BASELINE_FILE, JSON.stringify(baseline, null, 2));
    console.log('Baseline created successfully');
    
    return baseline;
  } catch (error) {
    console.error('Failed to create baseline:', error);
    throw error;
  }
}

// Load baseline
async function loadBaseline() {
  try {
    const data = await fs.readFile(BASELINE_FILE, 'utf8');
    baseline = JSON.parse(data);
    console.log('Baseline loaded successfully');
  } catch (error) {
    console.log('No baseline found, creating new one...');
    await createBaseline();
  }
}

// Extract brand keywords from text
function extractBrandKeywords(text) {
  const keywords = [];
  const commonBrandTerms = ['combank', 'commercial', 'bank', 'digital', 'login', 'account'];
  
  const lowerText = text.toLowerCase();
  for (const term of commonBrandTerms) {
    const regex = new RegExp(term, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      keywords.push({ term, count: matches.length });
    }
  }
  
  return keywords;
}

// Extract DOM structure
function extractDOMStructure(document) {
  const structure = {
    title: document.title,
    metaTags: Array.from(document.querySelectorAll('meta')).length,
    links: Array.from(document.querySelectorAll('a')).length,
    images: Array.from(document.querySelectorAll('img')).length,
    forms: Array.from(document.querySelectorAll('form')).length,
    inputs: Array.from(document.querySelectorAll('input')).length,
    buttons: Array.from(document.querySelectorAll('button')).length
  };
  
  return structure;
}

// Calculate text similarity using TF-IDF
function calculateTextSimilarity(text1, text2) {
  try {
    const TfIdf = natural.TfIdf;
    const tfidf = new TfIdf();
    
    tfidf.addDocument(text1);
    tfidf.addDocument(text2);
    
    const terms1 = {};
    const terms2 = {};
    
    tfidf.listTerms(0).forEach(item => {
      terms1[item.term] = item.tfidf;
    });
    
    tfidf.listTerms(1).forEach(item => {
      terms2[item.term] = item.tfidf;
    });
    
    const allTerms = new Set([...Object.keys(terms1), ...Object.keys(terms2)]);
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    allTerms.forEach(term => {
      const val1 = terms1[term] || 0;
      const val2 = terms2[term] || 0;
      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    });
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    const similarity = dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
    return Math.round(similarity * 100);
  } catch (error) {
    console.error('Text similarity error:', error);
    return 0;
  }
}

// Calculate visual similarity
async function calculateVisualSimilarity(screenshot1Path, screenshot2Path) {
  try {
    const img1 = PNG.sync.read(await fs.readFile(screenshot1Path));
    const img2 = PNG.sync.read(await fs.readFile(screenshot2Path));
    
    if (img1.width !== img2.width || img1.height !== img2.height) {
      return 50;
    }
    
    const { width, height } = img1;
    const diff = new PNG({ width, height });
    
    const numDiffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      { threshold: 0.1 }
    );
    
    const totalPixels = width * height;
    const similarity = Math.round((1 - numDiffPixels / totalPixels) * 100);
    
    return similarity;
  } catch (error) {
    console.error('Visual similarity error:', error);
    return 0;
  }
}

// Calculate keyword similarity
function calculateKeywordSimilarity(baseline, target) {
  if (!baseline.brandKeywords || !target.brandKeywords) return 0;
  
  let matches = 0;
  let total = baseline.brandKeywords.length;
  
  for (const baseKeyword of baseline.brandKeywords) {
    const found = target.brandKeywords.find(k => k.term === baseKeyword.term);
    if (found) {
      matches++;
    }
  }
  
  return total > 0 ? Math.round((matches / total) * 100) : 0;
}

// Calculate DOM similarity
function calculateDOMSimilarity(baseline, target) {
  if (!baseline.domStructure || !target.domStructure) return 0;
  
  const metrics = ['metaTags', 'links', 'images', 'forms', 'inputs', 'buttons'];
  let totalSimilarity = 0;
  
  for (const metric of metrics) {
    const baseValue = baseline.domStructure[metric] || 0;
    const targetValue = target.domStructure[metric] || 0;
    
    if (baseValue === 0 && targetValue === 0) {
      totalSimilarity += 100;
    } else if (baseValue === 0 || targetValue === 0) {
      totalSimilarity += 0;
    } else {
      const diff = Math.abs(baseValue - targetValue);
      const max = Math.max(baseValue, targetValue);
      const similarity = Math.max(0, (1 - diff / max) * 100);
      totalSimilarity += similarity;
    }
  }
  
  return Math.round(totalSimilarity / metrics.length);
}

// Check a suspicious domain
async function checkDomain(domain) {
  console.log(`Checking domain: ${domain}`);
  
  if (!baseline) {
    await loadBaseline();
  }
  
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const targetUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    
    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);
    
    const screenshotFilename = `${domain.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.png`;
    const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    await browser.close();

    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const target = {
      url: targetUrl,
      html,
      text,
      screenshot: screenshotPath,
      brandKeywords: extractBrandKeywords(text),
      formFields: [],
      domStructure: extractDOMStructure(document),
      checkedAt: new Date().toISOString()
    };

    // Calculate similarities
    const textSimilarity = calculateTextSimilarity(baseline.text, target.text);
    const keywordSimilarity = calculateKeywordSimilarity(baseline, target);
    const domSimilarity = calculateDOMSimilarity(baseline, target);
    const visualSimilarity = await calculateVisualSimilarity(baseline.screenshot, target.screenshot);

    // Weighted composite score
    const compositeSimilarity = Math.round(
      textSimilarity * 0.30 +
      visualSimilarity * 0.30 +
      domSimilarity * 0.20 +
      keywordSimilarity * 0.20
    );

    const threatLevel = compositeSimilarity >= SIMILARITY_THRESHOLD ? 'high' : 
                        compositeSimilarity >= 50 ? 'medium' : 'low';

    const details = {
      textSimilarity,
      visualSimilarity,
      domSimilarity,
      keywordSimilarity
    };

    // Update domain in database
    await dbRun(
      `UPDATE domains SET similarity = ?, last_checked = ?, screenshot = ?, details = ? WHERE domain = ?`,
      [compositeSimilarity, new Date().toISOString(), screenshotFilename, JSON.stringify(details), domain]
    );

    // Log check
    await dbRun(
      `INSERT INTO check_logs (domain, similarity, threat_level, details) VALUES (?, ?, ?, ?)`,
      [domain, compositeSimilarity, threatLevel, JSON.stringify(details)]
    );

    console.log(`Check complete: ${domain} - ${compositeSimilarity}% similarity`);
    
    return {
      domain,
      similarity: compositeSimilarity,
      details,
      threatLevel,
      screenshot: screenshotFilename,
      checkedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Failed to check domain ${domain}:`, error);
    throw error;
  }
}

// ============================================================================
// API Routes
// ============================================================================

// Authentication - Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get monitoring status
app.get('/api/monitoring-status', authenticateToken, (req, res) => {
  res.json({
    status: 'online',
    monitoring: !!monitoringInterval,
    baseline: !!baseline,
    timestamp: new Date().toISOString()
  });
});

// Get all domains
app.get('/api/domains', authenticateToken, async (req, res) => {
  try {
    const domains = await dbAll('SELECT * FROM domains ORDER BY added_at DESC');
    
    // Parse details JSON for each domain
    const domainsWithDetails = domains.map(d => ({
      ...d,
      details: d.details ? JSON.parse(d.details) : null
    }));
    
    res.json({ domains: domainsWithDetails });
  } catch (error) {
    console.error('Failed to fetch domains:', error);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

// Add domain
app.post('/api/domains', authenticateToken, async (req, res) => {
  const { domain } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain required' });
  }
  
  try {
    await dbRun(
      'INSERT INTO domains (domain) VALUES (?)',
      [domain]
    );
    
    res.json({ success: true, domain });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      res.status(400).json({ error: 'Domain already in watchlist' });
    } else {
      console.error('Failed to add domain:', error);
      res.status(500).json({ error: 'Failed to add domain' });
    }
  }
});

// Delete domain
app.delete('/api/domains/:domain', authenticateToken, async (req, res) => {
  const { domain } = req.params;
  
  try {
    await dbRun('DELETE FROM domains WHERE domain = ?', [domain]);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete domain:', error);
    res.status(500).json({ error: 'Failed to delete domain' });
  }
});

// Check domain
app.get('/api/check/:domain', authenticateToken, async (req, res) => {
  const { domain } = req.params;
  
  try {
    const result = await checkDomain(domain);
    res.json(result);
  } catch (error) {
    console.error('Check failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start monitoring
app.post('/api/start-monitoring', authenticateToken, async (req, res) => {
  if (monitoringInterval) {
    return res.json({ message: 'Monitoring already active' });
  }
  
  monitoringInterval = setInterval(async () => {
    console.log('Running scheduled monitoring...');
    
    try {
      const domains = await dbAll('SELECT domain FROM domains');
      
      for (const { domain } of domains) {
        try {
          await checkDomain(domain);
        } catch (error) {
          console.error(`Monitoring check failed for ${domain}:`, error);
        }
      }
    } catch (error) {
      console.error('Monitoring error:', error);
    }
  }, 60 * 60 * 1000); // Every hour
  
  res.json({ success: true, message: 'Monitoring started' });
});

// Stop monitoring
app.post('/api/stop-monitoring', authenticateToken, (req, res) => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  res.json({ success: true, message: 'Monitoring stopped' });
});

// Refresh baseline
app.post('/api/baseline/refresh', authenticateToken, async (req, res) => {
  try {
    await createBaseline();
    res.json({ success: true, message: 'Baseline refreshed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize and start server
async function startServer() {
  await initializeDirectories();
  await initializeDatabase();
  
  // Load or create baseline
  try {
    await loadBaseline();
  } catch (error) {
    console.log('Baseline will be created on first domain check');
  }
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`==========================================================`);
    console.log(`  Phishing Defense Backend - PRODUCTION`);
    console.log(`  Port: ${PORT}`);
    console.log(`  Database: SQLite (${DB_FILE})`);
    console.log(`  Baseline: ${baseline ? 'Loaded' : 'Not created yet'}`);
    console.log(`  Admin: username=admin, password=phishdish`);
    console.log(`==========================================================`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
