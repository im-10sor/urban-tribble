// Configuration - Load from environment
const CONFIG = {
  BACKEND_URL: 'https://bnb-ai-backend.onrender.com'
};

// Listen for messages from popup and content scripts
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
    case "pdfGenerationComplete":
      updateStatus('PDF exported successfully!', 'success');
      break;
    case "pdfGenerationFailed":
      updateStatus('PDF export failed: ' + request.message, 'error');
      break;
    case "generatePDF":
      generatePDF(request.data, request.isEnhanced)
        .then(() => sendResponse({success: true}))
        .catch(error => sendResponse({success: false, error: error.message}));
      return true; // Keep message channel open for async response
  }
  return true;
});

// Handle profile scraping requests
function handleScrapeProfile(request, sendResponse) {
  console.log('Attempting to scrape profile...');
  
  chrome.tabs.sendMessage(request.tabId, {
    action: "scrapeProfile"
  }, function(response) {
    if (chrome.runtime.lastError) {
      console.log('Content script communication error:', chrome.runtime.lastError);
      
      // Try to inject content script
      chrome.scripting.executeScript({
        target: { tabId: request.tabId },
        files: ['content.js']
      }).then(() => {
        console.log('Content script injected, retrying in 2 seconds...');
        
        setTimeout(() => {
          chrome.tabs.sendMessage(request.tabId, {
            action: "scrapeProfile"
          }, function(retryResponse) {
            if (chrome.runtime.lastError || !retryResponse) {
              console.error('Scraping failed after injection');
              sendResponse({ success: false, error: "Could not scrape profile" });
            } else {
              processProfileData(retryResponse.data || retryResponse, request.processWithGPT);
              sendResponse({ success: true });
            }
          });
        }, 2000);
      }).catch(error => {
        console.error('Error injecting content script:', error);
        sendResponse({ success: false, error: error.message });
      });
    } else if (response && response.success) {
      processProfileData(response.data, request.processWithGPT);
      sendResponse({ success: true });
    } else {
      console.error('Scraping failed:', response);
      sendResponse({ success: false, error: response?.error || 'Unknown error' });
    }
  });
}

async function processProfileData(profileData, processWithGPT) {
  try {
    // Save raw data
    const rawData = JSON.stringify(profileData, null, 2);
    const profileUrl = profileData.profileUrl || 'unknown';
    const uid = profileUrl.split('/').filter(Boolean).pop() || 'unknown';
    const rawFilename = `Abnbscrap_${uid}_raw.json`;
    const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(rawData);
    
    chrome.downloads.download({
      url: url,
      filename: rawFilename,
      saveAs: false
    });
    
    // Process with GPT if requested
    if (processWithGPT) {
      console.log('Processing with GPT via backend...');
      const gptProcessed = await processWithBackendGPT(profileData);
      
      if (gptProcessed) {
        // Save processed data
        const processedData = JSON.stringify(gptProcessed, null, 2);
        const processedFilename = `Abnbscrap_${uid}_processed.json`;
        const processedDataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(processedData);
        
        chrome.downloads.download({
          url: processedDataUrl,
          filename: processedFilename,
          saveAs: false
        });
        
        // Save to storage for popup access
        chrome.storage.local.set({ 
          lastEnhancedData: gptProcessed,
          lastScrapedData: profileData 
        });
        
        // Notify popup
        chrome.runtime.sendMessage({
          action: "gptProcessingComplete", 
          data: gptProcessed
        });
      }
    } else {
      // Save to storage for popup access
      chrome.storage.local.set({ lastScrapedData: profileData });
      
      // Notify popup
      chrome.runtime.sendMessage({
        action: "scrapingComplete",
        data: profileData
      });
    }
  } catch (error) {
    console.error('Error processing profile data:', error);
    chrome.runtime.sendMessage({
      action: "error", 
      message: error.message
    });
  }
}

// Function to process with GPT via your backend
async function processWithBackendGPT(profileData) {
  try {
    // Get auth token from storage
    const data = await chrome.storage.local.get(['authToken']);
    if (!data.authToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    // Call your backend API for GPT processing
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/process-with-gpt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.authToken}`
      },
      body: JSON.stringify({
        profileData: profileData
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend API error: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'GPT processing failed on backend');
    }
    
    return result.processedData;
    
  } catch (error) {
    console.error('Error processing with backend GPT:', error);
    throw error;
  }
}

// Handle scraping complete
function handleScrapingComplete(data) {
  console.log('Scraping complete:', data);
  // Forward to popup if needed
  chrome.runtime.sendMessage({
    action: "scrapingComplete",
    data: data
  });
}

// Handle GPT processing complete
function handleGptProcessingComplete(data) {
  console.log('GPT processing complete:', data);
  // Forward to popup if needed
  chrome.runtime.sendMessage({
    action: "gptProcessingComplete",
    data: data
  });
}

// Update status function
function updateStatus(message, type) {
  chrome.runtime.sendMessage({
    action: "statusUpdate",
    message: message,
    type: type
  });
}

// PDF Generation Function
async function generatePDF(data, isEnhanced = false) {
  try {
    console.log('Generating PDF...', { isEnhanced, data: data ? 'data exists' : 'no data' });
    
    // Store data for the PDF generator
    await chrome.storage.local.set({
      pdfData: data,
      pdfIsEnhanced: isEnhanced
    });
    
    // Create a new tab with the PDF generator
    const pdfTab = await chrome.tabs.create({
      url: chrome.runtime.getURL('pdf-generator.html'),
      active: false
    });
    
    console.log('PDF generator tab created:', pdfTab.id);
    
    // Set up a listener for PDF generation completion
    const handlePdfGenerationMessage = (request, sender) => {
      if (request.action === "pdfGenerationComplete" || request.action === "pdfGenerationFailed") {
        // Remove the listener
        chrome.runtime.onMessage.removeListener(handlePdfGenerationMessage);
        
        // Close the PDF generator tab
        if (pdfTab && pdfTab.id) {
          chrome.tabs.remove(pdfTab.id).catch(() => {
            // Tab might already be closed
          });
        }
        
        // Forward the message to the popup
        chrome.runtime.sendMessage(request);
        
        if (request.action === "pdfGenerationComplete") {
          console.log('✅ PDF exported successfully:', request.filename);
        } else {
          console.error('❌ PDF export failed:', request.message);
        }
      }
    };
    
    chrome.runtime.onMessage.addListener(handlePdfGenerationMessage);
    
    // Set a timeout to clean up if the PDF generator doesn't respond
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handlePdfGenerationMessage);
      if (pdfTab && pdfTab.id) {
        chrome.tabs.remove(pdfTab.id).catch(() => {
          // Tab might already be closed
        });
      }
      
      chrome.runtime.sendMessage({
        action: "pdfExportFailed",
        message: "PDF generation timed out after 30 seconds"
      });
    }, 30000); // 30 second timeout
    
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    throw new Error("Failed to generate PDF: " + error.message);
  }
}