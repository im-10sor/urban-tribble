// Configuration - Load from environment
const CONFIG = {
  BACKEND_URL: 'https://bnb-ai-backend.onrender.com'
};

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request.action);
  
  switch (request.action) {
    case "scrapeProfile":
      handleScrapeProfile(request, sendResponse);
      return true; // Keep message channel open for async response
      
    case "profileDataScraped":
      processProfileData(request.data, request.processWithGPT);
      sendResponse({ success: true });
      break;
      
    case "generatePDF":
      generatePDF(request.data, request.isEnhanced);
      sendResponse({ success: true });
      break;
      
    default:
      console.log('Unknown action:', request.action);
  }
  
  return true;
});

// Handle profile scraping requests
// In background.js - FIX THE HANDLE SCRAPE PROFILE FUNCTION
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

// PDF Generation Function - FIXED VERSION
// PDF Generation Function - SIMPLIFIED AND FIXED VERSION
// PDF Generation Function - FIXED VERSION
async function generatePDF(data, isEnhanced = false) {
  try {
    console.log('Generating PDF...', { isEnhanced, data });
    
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
    
    // Listen for the PDF generation to complete
    const pdfGenerationListener = function(request, sender, sendResponse) {
      if (request.action === "pdfGenerationComplete" || request.action === "pdfGenerationFailed") {
        // Close the PDF generator tab
        chrome.tabs.remove(pdfTab.id);
        chrome.runtime.onMessage.removeListener(pdfGenerationListener);
        
        if (request.action === "pdfGenerationComplete") {
          console.log('✅ PDF exported successfully:', request.filename);
          chrome.runtime.sendMessage({
            action: "pdfExportComplete",
            filename: request.filename
          });
        } else {
          console.error('❌ PDF export failed:', request.message);
          chrome.runtime.sendMessage({
            action: "pdfExportFailed",
            message: request.message
          });
        }
      }
    };
    
    chrome.runtime.onMessage.addListener(pdfGenerationListener);
    
    // Set a timeout to handle cases where the PDF generator doesn't respond
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(pdfGenerationListener);
      try {
        chrome.tabs.remove(pdfTab.id);
      } catch (e) {
        // Tab might have already been closed
      }
      
      chrome.runtime.sendMessage({
        action: "pdfExportFailed",
        message: "PDF generation timed out"
      });
    }, 30000); // 30 second timeout
    
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    chrome.runtime.sendMessage({
      action: "pdfExportFailed",
      message: "Failed to generate PDF: " + error.message
    });
  }
}

// Helper functions for PDF creation (used by the PDF generator page)
function createPDF(jsPDF, data, isEnhanced = false) {
  try {
    const doc = new jsPDF();
    const config = {
      margin: 20,
      headerHeight: 60,
      maxY: 270,
      fontSize: { title: 24, heading: 14, body: 10, small: 8 },
      colors: { airbnbRed: [255, 90, 95], black: [0, 0, 0], white: [255, 255, 255], gray: [100, 100, 100] }
    };

    // Add header with Airbnb branding
    doc.setFillColor(...config.colors.airbnbRed);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), config.headerHeight, 'F');
    
    doc.setFontSize(config.fontSize.title);
    doc.setTextColor(...config.colors.white);
    doc.text('Airbnb Guest Profile', config.margin, 30);
    
    doc.setFontSize(config.fontSize.body);
    doc.text(isEnhanced ? 'Enhanced Persona Analysis' : 'Profile Summary', config.margin, 40);
    
    // Reset text color for content
    doc.setTextColor(...config.colors.black);
    
    let yPosition = config.headerHeight + config.margin;
    
    // Basic Information Section
    yPosition = addSection(doc, 'Basic Information', yPosition, config);
    yPosition = addText(doc, `Name: ${data.name || 'N/A'}`, yPosition, config);
    yPosition = addText(doc, `Location: ${data.location || 'N/A'}`, yPosition, config);
    yPosition = addText(doc, `Joined: ${data.joinedDate || 'N/A'}`, yPosition, config);
    
    // Stats Section
    if (data.stats && Object.keys(data.stats).length > 0) {
      yPosition = addSection(doc, 'Profile Statistics', yPosition, config);
      for (const [key, value] of Object.entries(data.stats)) {
        yPosition = addText(doc, `${formatKey(key)}: ${value}`, yPosition, config);
      }
    }
    
    // Enhanced Persona Section (if applicable)
    if (isEnhanced && data.persona) {
      yPosition = addSection(doc, 'AI Persona Analysis', yPosition, config);
      
      // Add persona fields
      const persona = data.persona;
      if (persona.personaName) yPosition = addText(doc, `Persona: ${persona.personaName}`, yPosition, config);
      if (persona.demographics) yPosition = addText(doc, `Demographics: ${persona.demographics}`, yPosition, config);
      if (persona.psychologicalProfile) yPosition = addText(doc, `Psychological Profile: ${persona.psychologicalProfile}`, yPosition, config);
      if (persona.emotionalDrivers) yPosition = addText(doc, `Emotional Drivers: ${persona.emotionalDrivers}`, yPosition, config);
      if (persona.painPoints) yPosition = addText(doc, `Pain Points: ${persona.painPoints}`, yPosition, config);
      if (persona.travelBehavior) yPosition = addText(doc, `Travel Behavior: ${persona.travelBehavior}`, yPosition, config);
      if (persona.customerValue) yPosition = addText(doc, `Customer Value: ${persona.customerValue}`, yPosition, config);
      if (persona.marketingRecommendations) yPosition = addText(doc, `Marketing Recommendations: ${persona.marketingRecommendations}`, yPosition, config);
      if (persona.communicationStyle) yPosition = addText(doc, `Communication Style: ${persona.communicationStyle}`, yPosition, config);
    }
    
    // Footer with timestamp
    doc.setFontSize(config.fontSize.small);
    doc.setTextColor(...config.colors.gray);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, config.margin, doc.internal.pageSize.getHeight() - 10);
    
    // Generate blob and trigger download
    const pdfBlob = doc.output('blob');
    const filename = `Airbnb_${isEnhanced ? 'Persona' : 'Profile'}_${(data.name || 'unknown').replace(/\s+/g, '_')}.pdf`;
    
    // Download the PDF
    chrome.downloads.download({
      url: URL.createObjectURL(pdfBlob),
      filename: filename,
      saveAs: true
    });
    
    return filename;
    
  } catch (error) {
    console.error('Error creating PDF:', error);
    throw error;
  }
}

// Helper functions for PDF creation
function addSection(doc, title, yPosition, config) {
  if (yPosition > config.maxY) {
    doc.addPage();
    yPosition = config.margin;
  }
  
  doc.setFontSize(config.fontSize.heading);
  doc.setFont(undefined, 'bold');
  doc.text(title, config.margin, yPosition);
  
  doc.setFontSize(config.fontSize.body);
  doc.setFont(undefined, 'normal');
  
  return yPosition + 10;
}

function addText(doc, text, yPosition, config, lineHeight = 7) {
  if (yPosition > config.maxY) {
    doc.addPage();
    yPosition = config.margin;
  }
  
  doc.text(text, config.margin, yPosition);
  return yPosition + lineHeight;
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}