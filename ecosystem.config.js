module.exports = {
  apps: [{
    name: 'phishing-defense',
    script: 'server-production.js',
    
    // Process management
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      JWT_SECRET: 'change-this-secret-in-production-use-random-string'
    },
    
    // Logging
    error_file: '../phishing-data/logs/pm2-error.log',
    out_file: '../phishing-data/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Process monitoring
    min_uptime: '10s',
    max_restarts: 10,
    
    // Advanced options
    kill_timeout: 5000,
    listen_timeout: 10000,
    shutdown_with_message: true
  }]
};
