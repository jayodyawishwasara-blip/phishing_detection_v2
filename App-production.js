import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Clock, CheckCircle, XCircle, Search, Plus, Trash2, Eye, Activity, LogOut, Lock } from 'lucide-react';

// Dynamic API base - works with both HTTP and HTTPS
const API_BASE = window.location.protocol === 'https:' 
  ? '/api'  // Use relative URL for HTTPS (Caddy will proxy)
  : 'http://localhost:5000/api';  // Development fallback

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  const [domains, setDomains] = useState([]);
  const [newDomain, setNewDomain] = useState('');
  const [monitoring, setMonitoring] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [logs, setLogs] = useState([]);

  // Check if already logged in (using sessionStorage)
  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // Check backend status
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_BASE}/monitoring-status`, {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
          }
        });
        if (response.ok) {
          setBackendStatus('online');
        } else if (response.status === 401) {
          handleLogout();
        } else {
          setBackendStatus('offline');
        }
      } catch (error) {
        setBackendStatus('offline');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Load domains
  useEffect(() => {
    if (isAuthenticated) {
      loadDomains();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      const data = await response.json();

      if (response.ok) {
        sessionStorage.setItem('authToken', data.token);
        setIsAuthenticated(true);
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (error) {
      setLoginError('Connection error. Please check if backend is running.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setLoginForm({ username: '', password: '' });
  };

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
  });

  const loadDomains = async () => {
    try {
      const response = await fetch(`${API_BASE}/domains`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setDomains(data.domains || []);
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (error) {
      console.error('Failed to load domains:', error);
    }
  };

  const addDomain = async () => {
    if (!newDomain.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/domains`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ domain: newDomain })
      });

      if (response.ok) {
        setNewDomain('');
        loadDomains();
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (error) {
      console.error('Failed to add domain:', error);
    }
  };

  const removeDomain = async (domain) => {
    try {
      const response = await fetch(`${API_BASE}/domains/${encodeURIComponent(domain)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        loadDomains();
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (error) {
      console.error('Failed to remove domain:', error);
    }
  };

  const checkDomain = async (domain) => {
    try {
      const response = await fetch(`${API_BASE}/check/${encodeURIComponent(domain)}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const result = await response.json();
        loadDomains();
        return result;
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (error) {
      console.error('Failed to check domain:', error);
    }
  };

  const startMonitoring = async () => {
    setMonitoring(true);
    try {
      await fetch(`${API_BASE}/start-monitoring`, { 
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  };

  const stopMonitoring = async () => {
    setMonitoring(false);
    try {
      await fetch(`${API_BASE}/stop-monitoring`, { 
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
    }
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md border border-gray-700">
          <div className="text-center mb-8">
            <Shield className="text-blue-400 mx-auto mb-4" size={64} />
            <h1 className="text-3xl font-bold text-white mb-2">Phishing Defense Platform</h1>
            <p className="text-gray-400">Admin Login</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2 font-medium">Username</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2 font-medium">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
                required
              />
            </div>

            {loginError && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-lg p-3 text-red-300 text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Lock size={20} />
              Login
            </button>
          </form>

          <div className="mt-6 text-center text-gray-400 text-sm">
            Default: admin / phishdish
          </div>
        </div>
      </div>
    );
  }

  const StatusBadge = ({ status }) => {
    const config = {
      online: { color: 'bg-green-500', text: 'ONLINE', icon: CheckCircle },
      offline: { color: 'bg-red-500', text: 'OFFLINE', icon: XCircle },
      checking: { color: 'bg-yellow-500', text: 'CHECKING', icon: Clock }
    };

    const { color, text, icon: Icon } = config[status];

    return (
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${color} text-white text-sm font-semibold`}>
        <Icon size={16} />
        {text}
      </div>
    );
  };

  const ThreatLevelBadge = ({ similarity }) => {
    if (similarity === 0) {
      return <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-semibold">INACTIVE</span>;
    } else if (similarity < 50) {
      return <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-semibold">LOW</span>;
    } else if (similarity < 75) {
      return <span className="px-3 py-1 bg-yellow-500 text-white rounded-full text-sm font-semibold">MEDIUM</span>;
    } else {
      return <span className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-semibold">HIGH</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="text-blue-400" size={32} />
              <div>
                <h1 className="text-2xl font-bold text-white">Phishing Defense Platform</h1>
                <p className="text-gray-400 text-sm">Real-time threat detection & monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <StatusBadge status={backendStatus} />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {['dashboard', 'monitoring', 'logs', 'settings'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Add Domain */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Plus size={24} className="text-blue-400" />
                Add Domain to Watchlist
              </h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addDomain()}
                  placeholder="Enter suspicious domain (e.g., combankdigita1.com)"
                  className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={addDomain}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2"
                >
                  <Plus size={20} />
                  Add Domain
                </button>
              </div>
            </div>

            {/* Domains List */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">Monitored Domains ({domains.length})</h2>
              <div className="space-y-3">
                {domains.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Search size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No domains in watchlist</p>
                    <p className="text-sm">Add a domain above to start monitoring</p>
                  </div>
                ) : (
                  domains.map((domain) => (
                    <div
                      key={domain.domain}
                      className="bg-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-600 transition-all"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{domain.domain}</h3>
                          <ThreatLevelBadge similarity={domain.similarity || 0} />
                        </div>
                        {domain.similarity > 0 && (
                          <div className="space-y-1 text-sm">
                            <p className="text-gray-300">
                              Similarity: <span className="font-semibold text-white">{domain.similarity}%</span>
                            </p>
                            <p className="text-gray-400">
                              Last checked: {domain.last_checked ? new Date(domain.last_checked).toLocaleString() : 'Never'}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => checkDomain(domain.domain)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                        >
                          <Search size={16} />
                          Check Now
                        </button>
                        <button
                          onClick={() => setSelectedDomain(domain)}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                        >
                          <Eye size={16} />
                          Details
                        </button>
                        <button
                          onClick={() => removeDomain(domain.domain)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Activity size={24} className="text-blue-400" />
              Automated Monitoring
            </h2>
            <div className="space-y-4">
              <p className="text-gray-300">
                Automated monitoring checks all domains every 60 minutes for changes and threats.
              </p>
              <div className="flex items-center gap-4">
                {!monitoring ? (
                  <button
                    onClick={startMonitoring}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all"
                  >
                    Start Monitoring
                  </button>
                ) : (
                  <button
                    onClick={stopMonitoring}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all"
                  >
                    Stop Monitoring
                  </button>
                )}
                {monitoring && (
                  <span className="text-green-400 flex items-center gap-2">
                    <Activity className="animate-pulse" size={20} />
                    Monitoring Active
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Settings</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="font-semibold text-white mb-2">Detection Thresholds</h3>
                <p className="text-sm text-gray-400 mb-2">Similarity threshold for threat detection</p>
                <input
                  type="range"
                  min="50"
                  max="100"
                  defaultValue="75"
                  className="w-full"
                />
                <div className="flex justify-between text-sm mt-1">
                  <span>50%</span>
                  <span>75% (Current)</span>
                  <span>100%</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Monitoring Interval</h3>
                <select className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                  <option value="30">30 minutes</option>
                  <option value="60" defaultValue>60 minutes</option>
                  <option value="120">2 hours</option>
                  <option value="360">6 hours</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Domain Details Modal */}
      {selectedDomain && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full border border-gray-700">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-white">{selectedDomain.domain}</h2>
              <button
                onClick={() => setSelectedDomain(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-gray-300">
              <div>
                <span className="font-semibold text-white">Status:</span>{' '}
                <ThreatLevelBadge similarity={selectedDomain.similarity || 0} />
              </div>
              <div>
                <span className="font-semibold text-white">Similarity:</span> {selectedDomain.similarity}%
              </div>
              <div>
                <span className="font-semibold text-white">Last Checked:</span>{' '}
                {selectedDomain.last_checked ? new Date(selectedDomain.last_checked).toLocaleString() : 'Never'}
              </div>
              {selectedDomain.screenshot && (
                <div>
                  <span className="font-semibold text-white">Screenshot:</span>
                  <img
                    src={`/screenshots/${selectedDomain.screenshot.split('/').pop()}`}
                    alt="Domain screenshot"
                    className="mt-2 rounded-lg border border-gray-600 w-full"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
