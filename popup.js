let generatePDFWithOpenAI;

// Load the styles script
const styleScript = document.createElement('script');
styleScript.src = chrome.runtime.getURL('popup-styles.js');
document.head.appendChild(styleScript);

document.addEventListener('DOMContentLoaded', function() {
  // ========== CONFIGURATION ==========
  const CONFIG = {
    BACKEND_URL: 'https://bnb-ai-backend.onrender.com',
  };

  // ========== DOM ELEMENTS ==========
  // Authentication elements
  const authSection = document.getElementById('auth-section');
  const mainSection = document.getElementById('main-section');
  const exportSection = document.getElementById('export-section');
  const userWelcome = document.getElementById('user-welcome');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  
  // Input fields
  const employeeIdInput = document.getElementById('employee-id');
  const employeePinInput = document.getElementById('employee-pin');
  const employeeIdInputNew = document.getElementById('employee-id-input');
  const employeeNameInputNew = document.getElementById('employee-name-input');
  const employeePinInputNew = document.getElementById('employee-pin-input');
  const masterPinInputNew = document.getElementById('master-pin-input');
  
  // Action buttons
  const createPersonaBtn = document.getElementById('create-persona');
  const downloadPdfBtn = document.getElementById('download-pdf');
  const sendToServerBtn = document.getElementById('send-to-server');
  const createEmployeeBtn = document.getElementById('create-employee-btn');
  const scrapeBtn = document.getElementById('scrape');
  const scrapeGptBtn = document.getElementById('scrape-gpt');
  const exportPdfBtn = document.getElementById('export-pdf');
  const exportEnhancedPdfBtn = document.getElementById('export-enhanced-pdf');
  const downloadEnhancedPdfBtn = document.getElementById('download-enhanced-pdf');
  const downloadAiPdfBtn = document.getElementById('download-ai-pdf');
  
  // ========== STATE VARIABLES ==========
  let isAuthenticated = false;
  let currentToken = null;
  let currentEmployee = null;
  let scrapedData = null;
  let enhancedData = null;
  let frappeServerUrl = null;

  window.lastScrapedData = null;
  window.lastEnhancedData = null;

  // ========== INITIALIZATION ==========
  initializeUI();

  // ========== EVENT LISTENERS ==========
  // Authentication
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  
  // Employee management
  if (createEmployeeBtn) {
    createEmployeeBtn.addEventListener('click', handleCreateEmployee);
  }
  
  // Scraping and export
  if (createPersonaBtn) createPersonaBtn.addEventListener('click', handleCreatePersona);
  if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', handleDownloadPdf);
  if (downloadEnhancedPdfBtn) downloadEnhancedPdfBtn.addEventListener('click', handleDownloadEnhancedPdf);
  if (downloadAiPdfBtn) downloadAiPdfBtn.addEventListener('click', handleDownloadAiPdf);
  if (sendToServerBtn) sendToServerBtn.addEventListener('click', handleSendToServer);
  
  // Additional scraping buttons
  if (scrapeBtn) scrapeBtn.addEventListener('click', () => executeScraping(false));
  if (scrapeGptBtn) scrapeGptBtn.addEventListener('click', () => executeScraping(true));
  if (exportPdfBtn) exportPdfBtn.addEventListener('click', handleDownloadPdf);
  if (exportEnhancedPdfBtn) exportEnhancedPdfBtn.addEventListener('click', handleDownloadEnhancedPdf);
  
  // Enter key support for login
  if (employeePinInput) {
    employeePinInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleLogin();
    });
  }

  // ========== MESSAGE LISTENER ==========
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.action) {
      case "scrapingComplete":
        handleScrapingComplete(request.data);
        break;
      case "gptProcessingComplete":
        handleGptProcessingComplete(request.data);
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
      case "statusUpdate":
        updateStatus(request.message, request.type);
        break;
    }
    return true;
  });

  // ========== CORE FUNCTIONS ==========
  
  // --- Initialization ---
  async function initializeUI() {
    // Show admin banner initially
    const adminBanner = document.getElementById('admin-banner');
    if (adminBanner) adminBanner.style.display = 'block';
    
    // Load session and check admin status
    await loadSavedSession();
    await checkAdminStatus();
    
    // Load saved scraped/enhanced data
    chrome.storage.local.get(['lastScrapedData', 'lastEnhancedData'], function(data) {
      if (data.lastScrapedData) window.lastScrapedData = data.lastScrapedData;
      if (data.lastEnhancedData) window.lastEnhancedData = data.lastEnhancedData;
    });
  }

  // --- Authentication Functions ---
  async function loadSavedSession() {
    chrome.storage.local.get(['authToken', 'currentUser', 'frappeServerUrl'], async function(result) {
      if (result.authToken && result.currentUser) {
        updateStatus('Verifying saved session...', 'loading');
        try {
          const valid = await verifyToken(result.authToken);
          if (valid) {
            currentToken = result.authToken;
            currentEmployee = result.currentUser;
            frappeServerUrl = result.frappeServerUrl;
            isAuthenticated = true;
            showMainInterface();
            updateStatus('Welcome back, ' + currentEmployee.name, 'success');
            return;
          }
        } catch (error) {
          console.error('Session validation failed:', error);
          // Token invalid, clear storage
          chrome.storage.local.remove(['authToken', 'currentUser', 'frappeServerUrl']);
        }
      }
      // Show auth UI if no valid session
      authSection.style.display = 'block';
      mainSection.style.display = 'none';
      exportSection.style.display = 'none';
    });
  }

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
        frappeServerUrl = result.frappeServerUrl;
        isAuthenticated = true;
        chrome.storage.local.set({ 
          authToken: currentToken, 
          currentUser: currentEmployee,
          frappeServerUrl: frappeServerUrl
        });
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
    enhancedData = null;
    chrome.storage.local.remove(['authToken', 'currentUser', 'frappeServerUrl', 'lastScrapedData', 'lastEnhancedData']);
    authSection.style.display = 'block';
    mainSection.style.display = 'none';
    exportSection.style.display = 'none';
    updateStatus('Logged out', 'info');
  }

  // --- Employee Management ---
  async function handleCreateEmployee() {
    const employeeId = employeeIdInputNew.value.trim();
    const employeeName = employeeNameInputNew.value.trim();
    const employeePin = employeePinInputNew.value.trim();
    const masterPin = masterPinInputNew ? masterPinInputNew.value.trim() : '';
    
    if (!employeeId || !employeeName || !employeePin) {
      updateStatus('Please fill in all fields', 'error');
      return;
    }
    
    await createEmployee(employeeId, employeeName, employeePin, masterPin);
  }

  async function createEmployee(employee_id, name, pin, masterPin) {
    try {
      const payload = { employee_id, name, pin };
      if (masterPin) {
        payload.masterPin = masterPin;
      }

      const data = await apiCall('/api/employees', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      updateStatus(
        data.success ? 'Employee created successfully!' : `Error: ${data.error || data.message || 'Unknown error'}`,
        data.success ? 'success' : 'error'
      );

      if (data.success) {
        // Clear input fields on success
        employeeIdInputNew.value = '';
        employeeNameInputNew.value = '';
        employeePinInputNew.value = '';
        if (masterPinInputNew) masterPinInputNew.value = '';
      }
    } catch (error) {
      updateStatus('Error creating employee: ' + error.message, 'error');
      console.error('Error creating employee:', error);
    }
  }

  // --- Scraping Functions ---
  function executeScraping(processWithGPT) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        updateStatus('Error: No active tab found.', 'error');
        return;
      }
      
      const currentTab = tabs[0];
      if (!currentTab.url.includes('airbnb.co.in/users/show/') && !currentTab.url.includes('airbnb.com/users/show/')) {
        updateStatus('Error: Please navigate to an Airbnb profile page first.', 'error');
        return;
      }
      
      updateStatus('Scraping profile...', 'loading');
      
      // Scrape directly from content script
      chrome.tabs.sendMessage(currentTab.id, {
        action: "scrapeProfile"
      }, function(response) {
        if (chrome.runtime.lastError) {
          updateStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        } else if (response && response.success) {
          // Save the scraped data
          window.lastScrapedData = response.data;
          chrome.storage.local.set({ lastScrapedData: response.data });
          
          if (processWithGPT) {
            // Process with GPT via background
            updateStatus('Processing with GPT...', 'loading');
            chrome.runtime.sendMessage({
              action: "scrapeProfile",
              processWithGPT: true,
              tabId: currentTab.id
            });
          } else {
            updateStatus('Profile data scraped successfully!', 'success');
          }
        } else {
          updateStatus('Scraping failed', 'error');
        }
      });
    });
  }

  async function handleCreatePersona() {
    if (!isAuthenticated) {
      updateStatus('Please login first', 'error');
      return;
    }
    
    updateStatus('Checking current page...', 'loading');
    
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tabs.length) {
        updateStatus('No active tab found', 'error');
        return;
      }
      
      const currentTab = tabs[0];
      if (!currentTab.url.includes('airbnb.co.in/users/show/') && 
          !currentTab.url.includes('airbnb.com/users/show/')) {
        updateStatus('Please navigate to an Airbnb profile page first.', 'error');
        return;
      }
      
      updateStatus('Scraping profile data...', 'loading');
      
      // First, try to scrape the profile directly from content script
      const scrapedResponse = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(currentTab.id, {
          action: "scrapeProfile"
        }, function(response) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response.data);
          } else if (response && response.error) {
            reject(new Error(response.error));
          } else {
            reject(new Error('Failed to scrape profile'));
          }
        });
      });
      
      // If scraping failed, try to inject content script and retry
      if (!scrapedResponse) {
        updateStatus('Injecting scraper...', 'loading');
        
        // Inject the content script
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['content.js']
        });
        
        // Wait a moment for the script to load
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try scraping again
        updateStatus('Scraping profile data...', 'loading');
        const retryResponse = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(currentTab.id, {
            action: "scrapeProfile"
          }, function(response) {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
              resolve(response.data);
            } else if (response && response.error) {
              reject(new Error(response.error));
            } else {
              reject(new Error('Failed to scrape profile after injection'));
            }
          });
        });
        
        if (!retryResponse) {
          throw new Error('Scraping failed after retry');
        }
        
        // Use the retry response
        await processScrapedData(retryResponse);
      } else {
        // Use the initial response
        await processScrapedData(scrapedResponse);
      }
    } catch (error) {
      console.error('Create persona error:', error);
      updateStatus('Error: ' + error.message, 'error');
    }
  }

  // Helper function to process scraped data
  async function processScrapedData(scrapedData) {
    if (scrapedData) {
      // Now process with GPT
      updateStatus('Processing with AI...', 'loading');
      const gptResult = await processWithBackendGPT(scrapedData);
      
      if (gptResult && gptResult.success) {
        enhancedData = gptResult.processedData;
        exportSection.style.display = 'block';
        updateStatus('AI Persona created successfully!', 'success');
        
        // Save for download
        const completeData = {
          ...scrapedData,
          persona: enhancedData,
          employee_id: currentEmployee.id,
          employee_name: currentEmployee.name,
          timestamp: new Date().toISOString(),
          profile_url: window.location.href
        };
        
        // Save to storage and global variables
        window.scrapedData = completeData;
        window.lastScrapedData = completeData;
        window.lastEnhancedData = enhancedData;
        
        chrome.storage.local.set({ 
          lastEnhancedData: enhancedData,
          lastScrapedData: completeData 
        });
      } else {
        updateStatus('AI processing failed: ' + (gptResult?.message || 'Unknown error'), 'error');
      }
    } else {
      updateStatus('Failed to scrape profile data', 'error');
    }
  }

  // --- Export Functions ---
  async function handleDownloadPdf() {
    if (!window.lastScrapedData) {
      updateStatus('Error: Please scrape a profile first.', 'error');
      return;
    }
    
    try {
      updateStatus('Generating PDF...', 'loading');
      
      // Send to background script for PDF generation
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: "generatePDF",
          data: window.lastScrapedData,
          isEnhanced: false
        }, resolve);
      });
      
      if (response && response.success) {
        updateStatus('PDF generation started successfully!', 'success');
      } else {
        updateStatus('PDF generation failed: ' + (response?.error || 'Unknown error'), 'error');
      }
      
    } catch (error) {
      updateStatus('Download error: ' + error.message, 'error');
    }
  }

  async function handleDownloadEnhancedPdf() {
    if (!window.lastScrapedData || !window.lastEnhancedData) {
      updateStatus('Error: Please create an AI-enhanced persona first.', 'error');
      return;
    }
    
    try {
      updateStatus('Generating enhanced PDF...', 'loading');
      
      // Prepare the complete data object with both scraped and enhanced data
      const completeData = {
        ...window.lastScrapedData,
        persona: window.lastEnhancedData || {}
      };
      
      // Send to background script for PDF generation
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: "generatePDF",
          data: completeData,
          isEnhanced: true
        }, resolve);
      });
      
      if (response && response.success) {
        updateStatus('Enhanced PDF generation started!', 'success');
      } else {
        updateStatus('Enhanced PDF generation failed: ' + (response?.error || 'Unknown error'), 'error');
      }
      
    } catch (error) {
      updateStatus('Download error: ' + error.message, 'error');
    }
  }

  async function handleDownloadAiPdf() {
    if (!window.lastScrapedData) {
      updateStatus('Error: Please scrape a profile first.', 'error');
      return;
    }
    
    try {
      updateStatus('Generating AI-powered PDF...', 'loading');
      
      // Load OpenAI PDF module if not already loaded
      if (!generatePDFWithOpenAI) {
        await loadOpenAIPDFModule();
      }
      
      // Generate PDF with OpenAI
      await generatePDFWithOpenAI(window.lastScrapedData, window.lastEnhancedData);
      updateStatus('AI-powered PDF generated successfully!', 'success');
      
    } catch (error) {
      updateStatus('AI PDF generation failed: ' + error.message, 'error');
    }
  }

  async function loadOpenAIPDFModule() {
    try {
      const module = await import(chrome.runtime.getURL('openai-pdf-generator.js'));
      generatePDFWithOpenAI = module.generatePDFWithOpenAI;
    } catch (error) {
      console.error('Failed to load OpenAI PDF module:', error);
      throw new Error('Could not load AI PDF generator');
    }
  }

  async function handleSendToServer() {
    if (!window.scrapedData || !currentToken) {
      updateStatus('No data to send', 'error');
      return;
    }
    
    updateStatus('Sending to server...', 'loading');
    
    try {
      const result = await sendToFrappeServer(window.scrapedData, currentToken);
      if (result.success) {
        updateStatus('Data sent to server successfully!', 'success');
        window.scrapedData = null;
        exportSection.style.display = 'none';
      } else {
        updateStatus('Server error: ' + (result.message || 'Unknown error'), 'error');
      }
    } catch (error) {
      updateStatus('Network error: ' + error.message, 'error');
    }
  }

  // --- Message Handlers ---
  function handleScrapingComplete(data) {
    updateStatus('Profile data scraped successfully!', 'success');
    window.lastScrapedData = data;
    chrome.storage.local.set({ lastScrapedData: data });
  }

  function handleGptProcessingComplete(data) {
    updateStatus('Persona created successfully!', 'success');
    window.lastEnhancedData = data;
    chrome.storage.local.set({ lastEnhancedData: data });
    exportSection.style.display = 'block';
  }

  // ========== HELPER FUNCTIONS ==========
  
  // --- API Helper Function ---
  async function apiCall(endpoint, options = {}) {
    try {
      let baseUrl;
      if (endpoint.includes('/api/')) {
        baseUrl = CONFIG.BACKEND_URL;
      } else if (endpoint.includes('/frappe/') && frappeServerUrl) {
        baseUrl = frappeServerUrl;
        endpoint = endpoint.replace('/frappe/', '/api/method/');
      } else {
        throw new Error('Invalid API endpoint');
      }
      
      const url = `${baseUrl}${endpoint}`;
      console.log('API Call:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': currentToken ? `Bearer ${currentToken}` : '',
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (response.status === 503) {
        throw new Error('Service temporarily unavailable. Please try again later.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      
      // Handle specific error types
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  // --- Status Message Handler ---
  function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    if (!statusElement) return;

    // Update main status element
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
        // For 'info' or any other type
        break;
    }

    // Popup notification
    const popup = document.getElementById('status-popup');
    if (!popup) return;

    let bgColor = 'rgba(102, 126, 234, 0.9)';
    if (type === 'success') bgColor = 'rgba(0, 184, 148, 0.9)';
    else if (type === 'error') bgColor = 'rgba(214, 48, 49, 0.9)';
    else if (type === 'loading') bgColor = 'rgba(9, 132, 227, 0.9)';

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

  // --- UI Helper Functions ---
  function showMainInterface() {
    authSection.style.display = 'none';
    mainSection.style.display = 'block';
    exportSection.style.display = 'none';
    if (userWelcome && currentEmployee) {
      userWelcome.textContent = `Logged in as: ${currentEmployee.name} (${currentEmployee.id})`;
    }
  }

  async function checkAdminStatus() {
    try {
      const data = await apiCall('/api/check-admin');
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
      document.getElementById('admin-banner').style.display = 'none';
    }
  }

  // --- Backend API Functions ---
  async function authenticateEmployee(employeeId, pin) {
    return await apiCall('/api/authenticate', {
      method: 'POST',
      body: JSON.stringify({ employee_id: employeeId, pin })
    });
  }

  async function verifyToken(token) {
    try {
      const data = await apiCall('/api/verify-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return data.success === true;
    } catch {
      return false;
    }
  }

  async function processWithBackendGPT(profileData) {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/process-with-gpt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ profileData })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('GPT processing error:', error);
      throw error;
    }
  }

  async function sendToFrappeServer(data, token) {
    return await apiCall('/frappe/persona_app.api.save_persona', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ data, employee_id: data.employee_id })
    });
  }
});