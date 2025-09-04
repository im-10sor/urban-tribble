// Configuration - Load from environment
const CONFIG = {
  BACKEND_URL: 'https://bnb-ai-backend.onrender.com'
};
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "scrapeProfile") {
    // Forward the message to the content script in the specified tab
    chrome.tabs.sendMessage(request.tabId, {
      action: "scrapeProfile",
      processWithGPT: request.processWithGPT
    }, function(response) {
      if (chrome.runtime.lastError || !response) {
        // Content script might not be ready yet, try to execute it
        chrome.scripting.executeScript({
          target: { tabId: request.tabId },
          files: ['content.js']
        }).then(() => {
          // Try sending the message again after injecting
          setTimeout(() => {
            chrome.tabs.sendMessage(request.tabId, {
              action: "scrapeProfile",
              processWithGPT: request.processWithGPT
            }, function(respRetry) {
              if (chrome.runtime.lastError || !respRetry) {
                chrome.runtime.sendMessage({
                  action: "error",
                  message: "Could not scrape profile after retry. Please refresh the page and try again."
                });
              } else {
                processProfileData(respRetry, request.processWithGPT);
              }
            });
          }, 500);
        }).catch(error => {
          console.error('Error injecting content script:', error);
          chrome.runtime.sendMessage({
            action: "error",
            message: "Could not scrape profile. Please refresh the page and try again."
          });
        });
      } else {
        processProfileData(response, request.processWithGPT);
      }
    });
  }

  // Handle messages from content script
  if (request.action === "profileDataScraped") {
    processProfileData(request.data, request.processWithGPT);
  }

  return true; // Keep message channel open if needed
});

async function processProfileData(profileData, processWithGPT) {
  try {
    // Save raw data
    const rawData = JSON.stringify(profileData, null, 2);
    const profileUrl = profileData.profileUrl || window.location.href;
    const uid = profileUrl.split('/').filter(Boolean).pop();
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
        const processedFilename = `airbnb_profile_${profileData.name.replace(/\s+/g, '_')}_persona.json`;
        const processedData = JSON.stringify(gptProcessed, null, 2);
        
        // Download processed data
        const processedDataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(processedData);
        chrome.downloads.download({
          url: processedDataUrl,
          filename: processedFilename,
          saveAs: false
        });
        
        // Save to storage for popup access
        chrome.storage.local.set({ lastEnhancedData: gptProcessed });
        
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
