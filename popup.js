document.addEventListener('DOMContentLoaded', function() {
  // Load saved configuration and session
  chrome.storage.sync.get(['openaiKey', 'webhookUrl'], function(data) {
    if (data.openaiKey) document.getElementById('openai-key').value = data.openaiKey;
    if (data.webhookUrl) document.getElementById('webhook-url').value = data.webhookUrl;
    checkAdminStatus();  
  });

  // Cached DOM elements for auth and main UI
  const authSection = document.getElementById('auth-section');
  const mainSection = document.getElementById('main-section');
  const exportSection = document.getElementById('export-section');
  const userWelcome = document.getElementById('user-welcome');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const createPersonaBtn = document.getElementById('create-persona');
  const downloadPdfBtn = document.getElementById('download-pdf');
  const sendToServerBtn = document.getElementById('send-to-server');
  const employeeIdInput = document.getElementById('employee-id');
  const employeePinInput = document.getElementById('employee-pin');

  // Employee creation elements
  const createEmployeeBtn = document.getElementById('create-employee-btn');
  const employeeIdInputNew = document.getElementById('employee-id-input');
  const employeeNameInputNew = document.getElementById('employee-name-input');
  const employeePinInputNew = document.getElementById('employee-pin-input');
  const masterPinInputNew = document.getElementById('master-pin-input');
  
  document.getElementById('admin-banner').style.display = 'block';
  
  let isAuthenticated = false;
  let currentToken = null;
  let currentEmployee = null;
  let scrapedData = null;

  // Backend URLs
  const FRAPPE_SERVER_URL = 'https://your-frappe-server.com';
  const BACKEND_URL = 'https://bnb-ai-backend.onrender.com';

  // --- Employee Registration ---
  if (createEmployeeBtn) {
    createEmployeeBtn.addEventListener('click', () => {
      const employeeId = employeeIdInputNew.value.trim();
      const employeeName = employeeNameInputNew.value.trim();
      const employeePin = employeePinInputNew.value.trim();
       const masterPin = masterPinInputNew ? masterPinInputNew.value.trim() : '';
      if (!employeeId || !employeeName || !employeePin) {
        updateStatus('Please fill in all fields', 'error');
        return;
      }
      createEmployee(employeeId, employeeName, employeePin, masterPin);
    });
  }
  
  async function createEmployee(employee_id, name, pin, masterPin) {
  try {
    const payload = { employee_id, name, pin };
    if (masterPin) {
      payload.masterPin = masterPin; // Include masterPin only if provided
    }

    const response = await fetch(`${BACKEND_URL}/api/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    updateStatus(
      data.success ? 'Employee created successfully!' : `Error: ${data.error || data.message || 'Unknown error'}`,
      data.success ? 'success' : 'error'
    );
    console.log('Create employee response:', data);

    if (data.success) {
      // Optional: clear input fields on success
      employeeIdInputNew.value = '';
      employeeNameInputNew.value = '';
      employeePinInputNew.value = '';
      if (masterPinInputNew) masterPinInputNew.value = '';
    }
  } catch (error) {
    updateStatus('Network error: ' + error.message, 'error');
    console.error('Error creating employee:', error);
  }

}

async function checkAdminStatus() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/check-admin`);
    const data = await response.json();
    if (data.isAdmin) {
      document.getElementById('admin-banner').style.display = 'block';
      const pinInput = document.getElementById('master-pin-input');
      if (pinInput) pinInput.style.display = 'none';
    } else {
      document.getElementById('admin-banner').style.display = 'none';
      const pinInput = document.getElementById('master-pin-input');
      if (pinInput) pinInput.style.display = 'block';
    }
  } catch (err) {
    console.error('Failed to get admin status:', err);
  }
}
  // --- Status Message Handler ---
function updateStatus(message, type = 'info') {
  const statusElement = document.getElementById('status');
  if (!statusElement) return;

  // Update main status element content and styling
  statusElement.textContent = message;
  statusElement.className = '';

  switch (type) {
    case 'success':
      statusElement.classList.add('status-success');
      break;
    case 'error':
      statusElement.classList.add('status-error');
      break;
    case 'loading':
      statusElement.classList.add('status-loading');
      statusElement.innerHTML = '<div class="loader"></div> ' + message;
      break;
    default:
      // For 'info' or any other type, no extra styling
      break;
  }

  // Fade-up popup notification code
  const popup = document.getElementById('status-popup');
  if (!popup) return;

  let bgColor = 'rgba(102, 126, 234, 0.9)'; // default blue
  if (type === 'success') bgColor = 'rgba(0, 184, 148, 0.9)';      // green
  else if (type === 'error') bgColor = 'rgba(214, 48, 49, 0.9)';   // red
  else if (type === 'loading') bgColor = 'rgba(9, 132, 227, 0.9)'; // blue

  popup.textContent = message;
  popup.style.backgroundColor = bgColor;

  popup.style.opacity = '1';
  popup.style.transform = 'translateX(-50%) translateY(0)';

  clearTimeout(popup._timeout);
  popup._timeout = setTimeout(() => {
    popup.style.opacity = '0';
    popup.style.transform = 'translateX(-50%) translateY(20px)';
  }, 1500);
}
  // --- Session Resume & Layout ---
  chrome.storage.local.get(['authToken', 'currentUser'], async function(result) {
    if (result.authToken && result.currentUser) {
      updateStatus('Verifying saved session...', 'loading');
      const valid = await verifyToken(result.authToken);
      if (valid) {
        currentToken = result.authToken;
        currentEmployee = result.currentUser;
        isAuthenticated = true;
        showMainInterface();
        updateStatus('Welcome back, ' + currentEmployee.name, 'success');
        return;
      } else {
        // Invalid token, clear storage
        chrome.storage.local.remove(['authToken', 'currentUser']);
      }
    }
    // Show auth UI if no valid session
    authSection.style.display = 'block';
    mainSection.style.display = 'none';
    exportSection.style.display = 'none';
  });

  // --- Login/Logout Events ---
  loginBtn.addEventListener('click', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  employeePinInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') handleLogin();
  });

  // --- Save OpenAI/Webhook Configuration ---
  document.getElementById('save-config').addEventListener('click', function() {
    const openaiKey = document.getElementById('openai-key').value;
    const webhookUrl = document.getElementById('webhook-url').value;
    chrome.storage.sync.set({ openaiKey, webhookUrl }, function() {
      updateStatus('Configuration saved!', 'success');
    });
  });

  // --- Scraping and Exporting Button Events ---
  document.getElementById('scrape').addEventListener('click', () => executeScraping(false));
  document.getElementById('scrape-gpt').addEventListener('click', () => executeScraping(true));
  document.getElementById('export-pdf').addEventListener('click', exportToPDF);
  document.getElementById('export-enhanced-pdf').addEventListener('click', exportEnhancedPDF);

  // --- Custom Persona/Download/Server Button Events ---
  createPersonaBtn.addEventListener('click', handleCreatePersona);
  downloadPdfBtn.addEventListener('click', handleDownloadPdf);
  sendToServerBtn.addEventListener('click', handleSendToServer);

  // --- Listen for Background Script Messages ---
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.action) {
      case "scrapingComplete":
        updateStatus('Profile data scraped successfully!', 'success');
        window.lastScrapedData = request.data;
        break;
      case "gptProcessingComplete":
        updateStatus('Persona created successfully!', 'success');
        window.lastEnhancedData = request.data;
        break;
      case "error":
        updateStatus('Error: ' + request.message, 'error');
        break;
      case "noActiveTab":
        updateStatus('Error: Please navigate to an Airbnb profile page first.', 'error');
        break;
      case "pdfExportComplete":
        updateStatus('PDF exported successfully!', 'success');
        break;
      case "pdfExportFailed":
        updateStatus('PDF export failed: ' + request.message, 'error');
        break;
    }
    return true;
  });

  // --- Load Saved Scraped/Enhanced Data ---
  chrome.storage.local.get(['lastScrapedData', 'lastEnhancedData'], function(data) {
    if (data.lastScrapedData) window.lastScrapedData = data.lastScrapedData;
    if (data.lastEnhancedData) window.lastEnhancedData = data.lastEnhancedData;
  });

  // --------- Main Functionality ---------

  function executeScraping(processWithGPT) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        updateStatus('Error: No active tab found.', 'error');
        return;
      }
      const currentTab = tabs[0];
      if (!currentTab.url.includes('airbnb.co.in/users/show/')) {
        updateStatus('Error: Please navigate to an Airbnb profile page first.', 'error');
        return;
      }
      updateStatus('Scraping profile...', 'loading');
      chrome.runtime.sendMessage({
        action: "scrapeProfile",
        processWithGPT: processWithGPT,
        tabId: currentTab.id
      });
    });
  }

  function exportToPDF() {
    if (!window.lastScrapedData) {
      updateStatus('Error: Please scrape a profile first.', 'error');
      return;
    }
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        updateStatus('Error: No active tab found.', 'error');
        return;
      }
      const currentTab = tabs[0];
      updateStatus('Exporting PDF...', 'loading');
      chrome.tabs.sendMessage(currentTab.id, {
        action: "exportPDF",
        data: window.lastScrapedData
      }, function(response) {
        if (chrome.runtime.lastError) {
          updateStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        } else if (response && response.success) {
          updateStatus('PDF exported successfully!', 'success');
        } else {
          updateStatus('PDF export failed.', 'error');
        }
      });
    });
  }

  function exportEnhancedPDF() {
    if (!window.lastEnhancedData) {
      updateStatus('Error: Please create an enhanced persona with GPT first.', 'error');
      return;
    }
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        updateStatus('Error: No active tab found.', 'error');
        return;
      }
      const currentTab = tabs[0];
      updateStatus('Exporting enhanced PDF...', 'loading');
      chrome.tabs.sendMessage(currentTab.id, {
        action: "exportEnhancedPDF",
        data: window.lastEnhancedData
      }, function(response) {
        if (chrome.runtime.lastError) {
          updateStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        } else if (response && response.success) {
          updateStatus('Enhanced PDF exported successfully!', 'success');
        } else {
          updateStatus('Enhanced PDF export failed.', 'error');
        }
      });
    });
  }

  async function handleCreatePersona() {
    if (!isAuthenticated) {
      updateStatus('Please login first', 'error');
      return;
    }
    updateStatus('Scraping profile data...', 'loading');
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tabs.length) {
        updateStatus('No active tab found', 'error');
        return;
      }
      const currentTab = tabs[0];
      if (!currentTab.url.includes('airbnb.co.in/users/show/')) {
        updateStatus('Please navigate to an Airbnb profile page first.', 'error');
        return;
      }
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: "scrapeProfile"
      });
      if (response) {
        scrapedData = {
          ...response,
          employee_id: currentEmployee.id,
          employee_name: currentEmployee.name,
          timestamp: new Date().toISOString(),
          profile_url: currentTab.url
        };
        exportSection.style.display = 'block';
        updateStatus('Profile data ready for export!', 'success');
      } else {
        updateStatus('Failed to scrape profile data', 'error');
      }
    } catch (error) {
      updateStatus('Scraping error: ' + error.message, 'error');
    }
  }

  async function handleDownloadPdf() {
    if (!scrapedData) {
      updateStatus('No data to export', 'error');
      return;
    }
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tabs.length) return;
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: "exportPDF",
        data: scrapedData
      });
      if (response && response.success) {
        updateStatus('PDF downloaded successfully!', 'success');
      } else {
        updateStatus('PDF download failed', 'error');
      }
    } catch (error) {
      updateStatus('Download error: ' + error.message, 'error');
    }
  }

  async function handleSendToServer() {
    if (!scrapedData || !currentToken) {
      updateStatus('No data to send', 'error');
      return;
    }
    updateStatus('Sending to server...', 'loading');
    try {
      const result = await sendToFrappeServer(scrapedData, currentToken);
      if (result.success) {
        updateStatus('Data sent to server successfully!', 'success');
        scrapedData = null;
        exportSection.style.display = 'none';
      } else {
        updateStatus('Server error: ' + (result.message || 'Unknown error'), 'error');
      }
    } catch (error) {
      updateStatus('Network error: ' + error.message, 'error');
    }
  }

  // --- Auth/Session Functions ---
  async function handleLogin() {
    const employeeId = employeeIdInput.value.trim();
    const pin = employeePinInput.value.trim();

    if (!employeeId || !pin) {
      updateStatus('Please enter employee ID and PIN.', 'error');
      return;
    }
    try {
      updateStatus('Logging in...', 'loading');
      loginBtn.disabled = true;
      const result = await authenticateEmployee(employeeId, pin);
      if (result.success) {
        currentToken = result.token;
        currentEmployee = result.employee;
        isAuthenticated = true;
        chrome.storage.local.set({ authToken: currentToken, currentUser: currentEmployee });
        showMainInterface();
        updateStatus('Login successful! Welcome, ' + currentEmployee.name, 'success');
      } else {
        updateStatus(result.message || 'Login failed', 'error');
      }
    } catch (err) {
      updateStatus(err.message || 'Login error', 'error');
    } finally {
      loginBtn.disabled = false;
    }
  }

  function handleLogout() {
    isAuthenticated = false;
    currentToken = null;
    currentEmployee = null;
    scrapedData = null;
    chrome.storage.local.remove(['authToken', 'currentUser']);
    authSection.style.display = 'block';
    mainSection.style.display = 'none';
    exportSection.style.display = 'none';
    updateStatus('Logged out', 'info');
  }

  // --- Backend API Calls ---
  async function authenticateEmployee(employeeId, pin) {
    const response = await fetch(`${BACKEND_URL}/api/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employeeId, pin }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  }

  async function verifyToken(token) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/verify-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return data.success === true;
    } catch {
      return false;
    }
  }

  async function sendToFrappeServer(data, token) {
    const response = await fetch(`${FRAPPE_SERVER_URL}/api/method/persona_app.api.save_persona`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data, employee_id: data.employee_id }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return await response.json();
  }
async function getOpenAIKey() {
  const token = localStorage.getItem('authToken');  // or wherever you store it

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${BACKEND_URL}/api/openai-key`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch OpenAI API key');
  }

  const data = await response.json();
  return data.openaiKey;
}
  // --- Helpers ---
  function showMainInterface() {
    authSection.style.display = 'none';
    mainSection.style.display = 'block';
    exportSection.style.display = 'none';
    if (userWelcome && currentEmployee) {
      userWelcome.textContent = `Logged in as: ${currentEmployee.name} (${currentEmployee.id})`;
    }
  }
});