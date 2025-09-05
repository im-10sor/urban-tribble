console.log('Airbnb Persona Creator content script loaded');

// Configuration
const CONFIG = {
  pdf: {
    margin: 20,
    headerHeight: 60,
    maxY: 270,
    fontSize: {
      title: 24,
      heading: 14,
      body: 10,
      small: 8
    },
    colors: {
      airbnbRed: [255, 90, 95],
      black: [0, 0, 0],
      white: [255, 255, 255],
      gray: [100, 100, 100]
    }
  },
  selectors: {
    name: 'span.t1gpcl1t.atm_w4_16rzvi6.atm_9s_1o8liyq.atm_gi_idpfg4.dir.dir-ltr',
    location: '.s1woay09 span',
    stats: {
      container: '.s1oxm7bp',
      value: '.vqkyk4b',
      label: '.t1gpcl1t'
    },
    reviews: {
      container: '.s1w4y9s5',
      review: '.r1yofr2n',
      text: '.t1gpcl1t.atm_9s_1o8liyq.atm_gi_idpfg4.dir.dir-ltr',
      date: '.s1woay09 span',
      rating: '.r1f9x8ns'
    },
    verifications: '.s1vx0s1c .s1vx0s1c',
    about: '.s1oxm7bp .t1gpcl1t.atm_9s_1o8liyq.atm_gi_idpfg4.dir.dir-ltr',
    languages: '.s1oxm7bp .t1gpcl1t.atm_9s_1o8liyq.atm_gi_idpfg4.dir.dir-ltr',
    joinedDate: '.s1woay09 span'
  }
};

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Content script received message:', request.action);
  
  // Handle different types of messages
  switch (request.action) {
    case "scrapeProfile":
      console.log('Scraping profile...');
      try {
        const profileData = scrapeProfileData();
        console.log('Profile data scraped successfully');
        sendResponse({
          success: true,
          data: profileData
        });
      } catch (error) {
        console.error('Scraping error:', error);
        sendResponse({
          success: false,
          error: error.message,
          details: 'Failed to scrape profile data'
        });
      }
      return true; // Keep message channel open for async response
      
    case "exportPDF":
      console.log('Exporting PDF...');
      try {
        exportToPDF(request.data);
        sendResponse({ 
          success: true,
          message: 'PDF export initiated'
        });
      } catch (error) {
        console.error('PDF export error:', error);
        sendResponse({ 
          success: false, 
          error: error.message,
          details: 'PDF export failed'
        });
      }
      return true;
      
    case "exportEnhancedPDF":
      console.log('Exporting enhanced PDF...');
      try {
        exportEnhancedPDF(request.data);
        sendResponse({ 
          success: true,
          message: 'Enhanced PDF export initiated'
        });
      } catch (error) {
        console.error('Enhanced PDF export error:', error);
        sendResponse({ 
          success: false, 
          error: error.message,
          details: 'Enhanced PDF export failed'
        });
      }
      return true;
      
    case "ping":
      // Response to check if content script is active
      console.log('Ping received - content script is active');
      sendResponse({ 
        status: "active", 
        url: window.location.href,
        ready: true
      });
      return true;
      
    case "debugInfo":
      // Provide debugging information
      console.log('Debug info requested');
      sendResponse({
        success: true,
        url: window.location.href,
        pageTitle: document.title,
        isAirbnbProfile: isAirbnbProfilePage(),
        selectors: testSelectors(),
        timestamp: new Date().toISOString()
      });
      return true;
      
    default:
      console.log('Unknown action:', request.action);
      sendResponse({ 
        success: false, 
        error: 'Unknown action',
        receivedAction: request.action
      });
      return false;
  }
});

// Main scraping function
function scrapeProfileData() {
  console.log('Starting profile data scraping...');
  
  try {
    const profileData = {
      name: extractName(),
      location: extractLocation(),
      stats: extractStats(),
      reviews: extractReviews(),
      verifications: extractVerifications(),
      about: extractAbout(),
      languages: extractLanguages(),
      joinedDate: extractJoinedDate(),
      profileUrl: window.location.href,
      scrapedAt: new Date().toISOString()
    };
    
    console.log('Profile data scraped successfully:', profileData);
    return profileData;
    
  } catch (error) {
    console.error('Error scraping profile data:', error);
    throw new Error('Failed to scrape profile data: ' + error.message);
  }
}

// Individual data extraction functions
function extractName() {
  try {
    const nameElement = document.querySelector(CONFIG.selectors.name);
    return nameElement ? nameElement.textContent.trim() : 'Name not found';
  } catch (error) {
    console.error('Error extracting name:', error);
    return 'Error extracting name';
  }
}

function extractLocation() {
  try {
    const locationElements = document.querySelectorAll(CONFIG.selectors.location);
    for (let element of locationElements) {
      const text = element.textContent.trim();
      if (text && !text.includes('·') && !text.includes('Joined')) {
        return text;
      }
    }
    return 'Location not found';
  } catch (error) {
    console.error('Error extracting location:', error);
    return 'Error extracting location';
  }
}

function extractStats() {
  const stats = {};
  try {
    const statContainers = document.querySelectorAll(CONFIG.selectors.stats.container);
    statContainers.forEach(container => {
      const valueElement = container.querySelector(CONFIG.selectors.stats.value);
      const labelElement = container.querySelector(CONFIG.selectors.stats.label);
      
      if (valueElement && labelElement) {
        const value = valueElement.textContent.trim();
        const label = labelElement.textContent.trim().toLowerCase();
        
        if (label.includes('review')) {
          stats.reviews = value;
        } else if (label.includes('identity')) {
          stats.identityVerified = value;
        } else if (label.includes('response')) {
          stats.responseRate = value;
        } else if (label.includes('superhost')) {
          stats.superhost = value;
        }
      }
    });
  } catch (error) {
    console.error('Error extracting stats:', error);
  }
  return stats;
}

function extractReviews() {
  const reviews = [];
  try {
    const reviewContainers = document.querySelectorAll(CONFIG.selectors.reviews.container);
    reviewContainers.forEach(container => {
      const textElement = container.querySelector(CONFIG.selectors.reviews.text);
      const dateElement = container.querySelector(CONFIG.selectors.reviews.date);
      const ratingElement = container.querySelector(CONFIG.selectors.reviews.rating);
      
      if (textElement) {
        reviews.push({
          text: textElement.textContent.trim(),
          date: dateElement ? dateElement.textContent.trim() : 'Date not available',
          rating: ratingElement ? ratingElement.textContent.trim() : 'Rating not available'
        });
      }
    });
  } catch (error) {
    console.error('Error extracting reviews:', error);
  }
  return reviews;
}

function extractVerifications() {
  const verifications = [];
  try {
    const verificationElements = document.querySelectorAll(CONFIG.selectors.verifications);
    verificationElements.forEach(element => {
      const text = element.textContent.trim();
      if (text) {
        verifications.push(text);
      }
    });
  } catch (error) {
    console.error('Error extracting verifications:', error);
  }
  return verifications;
}

function extractAbout() {
  try {
    const aboutElements = document.querySelectorAll(CONFIG.selectors.about);
    for (let element of aboutElements) {
      const text = element.textContent.trim();
      if (text && text.length > 50) { // Assuming "About" section has longer text
        return text;
      }
    }
    return 'About section not found';
  } catch (error) {
    console.error('Error extracting about:', error);
    return 'Error extracting about section';
  }
}

function extractLanguages() {
  const languages = [];
  try {
    const languageElements = document.querySelectorAll(CONFIG.selectors.languages);
    languageElements.forEach(element => {
      const text = element.textContent.trim();
      if (text && text.includes('Language')) {
        languages.push(text.replace('Language: ', ''));
      }
    });
  } catch (error) {
    console.error('Error extracting languages:', error);
  }
  return languages;
}

function extractJoinedDate() {
  try {
    const dateElements = document.querySelectorAll(CONFIG.selectors.joinedDate);
    for (let element of dateElements) {
      const text = element.textContent.trim();
      if (text.includes('Joined')) {
        return text;
      }
    }
    return 'Joined date not found';
  } catch (error) {
    console.error('Error extracting joined date:', error);
    return 'Error extracting joined date';
  }
}

// PDF Export Functions
function exportToPDF(data) {
  console.log('Sending data to background for PDF generation:', data);
  chrome.runtime.sendMessage({
    action: "generatePDF",
    data: data,
    isEnhanced: false
  });
}

function exportEnhancedPDF(data) {
  console.log('Sending enhanced data to background for PDF generation:', data);
  chrome.runtime.sendMessage({
    action: "generatePDF", 
    data: data,
    isEnhanced: true
  });
}

// Helper functions for PDF creation
function addSection(doc, title, yPosition) {
  if (yPosition > CONFIG.pdf.maxY) {
    doc.addPage();
    yPosition = CONFIG.pdf.margin;
  }
  
  doc.setFontSize(CONFIG.pdf.fontSize.heading);
  doc.setFont(undefined, 'bold');
  doc.text(title, CONFIG.pdf.margin, yPosition);
  
  doc.setFontSize(CONFIG.pdf.fontSize.body);
  doc.setFont(undefined, 'normal');
  
  return yPosition + 10;
}

function addSubsection(doc, title, yPosition) {
  if (yPosition > CONFIG.pdf.maxY) {
    doc.addPage();
    yPosition = CONFIG.pdf.margin;
  }
  
  doc.setFontSize(CONFIG.pdf.fontSize.body);
  doc.setFont(undefined, 'bold');
  doc.text(title, CONFIG.pdf.margin + 5, yPosition);
  
  doc.setFont(undefined, 'normal');
  
  return yPosition + 7;
}

function addText(doc, text, yPosition, lineHeight = 7) {
  if (yPosition > CONFIG.pdf.maxY) {
    doc.addPage();
    yPosition = CONFIG.pdf.margin;
  }
  
  doc.text(text, CONFIG.pdf.margin, yPosition);
  return yPosition + lineHeight;
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

// Additional helper functions
function isAirbnbProfilePage() {
  return window.location.href.includes('airbnb.co.in/users/show/') || 
         window.location.href.includes('airbnb.com/users/show/');
}

function testSelectors() {
  const results = {};
  for (const [key, selector] of Object.entries(CONFIG.selectors)) {
    if (typeof selector === 'string') {
      results[key] = {
        selector: selector,
        found: document.querySelector(selector) !== null,
        count: document.querySelectorAll(selector).length
      };
    }
  }
  return results;
}