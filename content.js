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
  
  switch (request.action) {
    case "scrapeProfile":
      console.log('Scraping profile...');
      const profileData = scrapeProfileData();
      sendResponse(profileData);
      return true;
      
    case "exportPDF":
      console.log('Exporting PDF...');
      try {
        exportToPDF(request.data);
        sendResponse({ success: true });
      } catch (error) {
        console.error('PDF export error:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
      
    case "exportEnhancedPDF":
      console.log('Exporting enhanced PDF...');
      try {
        exportEnhancedPDF(request.data);
        sendResponse({ success: true });
      } catch (error) {
        console.error('Enhanced PDF export error:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
      
    default:
      console.log('Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
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

function createPDF(data, isEnhanced = false) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Set document properties
    doc.setProperties({
      title: `Airbnb ${isEnhanced ? 'Enhanced Persona' : 'Profile'} - ${data.name}`,
      subject: 'Airbnb Guest Profile Analysis',
      author: 'Airbnb Persona Creator',
      keywords: 'airbnb, profile, persona, guest, analysis'
    });
    
    // Add header with Airbnb branding
    doc.setFillColor(...CONFIG.pdf.colors.airbnbRed);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), CONFIG.pdf.headerHeight, 'F');
    
    doc.setFontSize(CONFIG.pdf.fontSize.title);
    doc.setTextColor(...CONFIG.pdf.colors.white);
    doc.text('Airbnb Guest Profile', CONFIG.pdf.margin, 30);
    
    doc.setFontSize(CONFIG.pdf.fontSize.body);
    doc.text(isEnhanced ? 'Enhanced Persona Analysis' : 'Profile Summary', CONFIG.pdf.margin, 40);
    
    // Reset text color for content
    doc.setTextColor(...CONFIG.pdf.colors.black);
    
    let yPosition = CONFIG.pdf.headerHeight + CONFIG.pdf.margin;
    
    // Basic Information Section
    yPosition = addSection(doc, 'Basic Information', yPosition);
    yPosition = addText(doc, `Name: ${data.name}`, yPosition);
    yPosition = addText(doc, `Location: ${data.location}`, yPosition);
    yPosition = addText(doc, `Joined: ${data.joinedDate}`, yPosition);
    yPosition = addText(doc, `Profile URL: ${data.profileUrl}`, yPosition);
    
    // Stats Section
    if (data.stats && Object.keys(data.stats).length > 0) {
      yPosition = addSection(doc, 'Profile Statistics', yPosition);
      for (const [key, value] of Object.entries(data.stats)) {
        yPosition = addText(doc, `${formatKey(key)}: ${value}`, yPosition);
      }
    }
    
    // Verifications Section
    if (data.verifications && data.verifications.length > 0) {
      yPosition = addSection(doc, 'Verifications', yPosition);
      data.verifications.forEach(verification => {
        yPosition = addText(doc, `✓ ${verification}`, yPosition);
      });
    }
    
    // Languages Section
    if (data.languages && data.languages.length > 0) {
      yPosition = addSection(doc, 'Languages', yPosition);
      data.languages.forEach(language => {
        yPosition = addText(doc, `• ${language}`, yPosition);
      });
    }
    
    // About Section
    if (data.about && data.about !== 'About section not found') {
      yPosition = addSection(doc, 'About', yPosition);
      const aboutLines = doc.splitTextToSize(data.about, doc.internal.pageSize.getWidth() - (CONFIG.pdf.margin * 2));
      aboutLines.forEach(line => {
        if (yPosition > CONFIG.pdf.maxY) {
          doc.addPage();
          yPosition = CONFIG.pdf.margin;
        }
        doc.text(line, CONFIG.pdf.margin, yPosition);
        yPosition += 7;
      });
    }
    
    // Reviews Section
    if (data.reviews && data.reviews.length > 0) {
      yPosition = addSection(doc, 'Recent Reviews', yPosition);
      data.reviews.slice(0, 3).forEach((review, index) => {
        yPosition = addText(doc, `Review ${index + 1}:`, yPosition);
        yPosition = addText(doc, `Rating: ${review.rating}`, yPosition, 5);
        yPosition = addText(doc, `Date: ${review.date}`, yPosition, 5);
        
        const reviewLines = doc.splitTextToSize(review.text, doc.internal.pageSize.getWidth() - (CONFIG.pdf.margin * 2));
        reviewLines.forEach(line => {
          if (yPosition > CONFIG.pdf.maxY) {
            doc.addPage();
            yPosition = CONFIG.pdf.margin;
          }
          doc.text(line, CONFIG.pdf.margin + 5, yPosition);
          yPosition += 5;
        });
        yPosition += 5;
      });
    }
    
    // Enhanced Persona Section (if applicable)
    if (isEnhanced && data.persona) {
      yPosition = addSection(doc, 'AI Persona Analysis', yPosition);
      
      if (data.persona.travelPreferences) {
        yPosition = addSubsection(doc, 'Travel Preferences', yPosition);
        for (const [key, value] of Object.entries(data.persona.travelPreferences)) {
          yPosition = addText(doc, `${formatKey(key)}: ${value}`, yPosition, 5);
        }
      }
      
      if (data.persona.communicationStyle) {
        yPosition = addSubsection(doc, 'Communication Style', yPosition);
        for (const [key, value] of Object.entries(data.persona.communicationStyle)) {
          yPosition = addText(doc, `${formatKey(key)}: ${value}`, yPosition, 5);
        }
      }
      
      if (data.persona.hostingRecommendations) {
        yPosition = addSubsection(doc, 'Hosting Recommendations', yPosition);
        const recLines = doc.splitTextToSize(data.persona.hostingRecommendations, doc.internal.pageSize.getWidth() - (CONFIG.pdf.margin * 2));
        recLines.forEach(line => {
          if (yPosition > CONFIG.pdf.maxY) {
            doc.addPage();
            yPosition = CONFIG.pdf.margin;
          }
          doc.text(line, CONFIG.pdf.margin, yPosition);
          yPosition += 5;
        });
      }
    }
    
    // Footer with timestamp
    doc.setFontSize(CONFIG.pdf.fontSize.small);
    doc.setTextColor(...CONFIG.pdf.colors.gray);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, CONFIG.pdf.margin, doc.internal.pageSize.getHeight() - 10);
    
    // Save the PDF
    const filename = `Airbnb_${isEnhanced ? 'Persona' : 'Profile'}_${data.name.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
    
    // Notify background script of success
    chrome.runtime.sendMessage({
      action: "pdfExportComplete",
      filename: filename
    });
    
  } catch (error) {
    console.error('Error creating PDF:', error);
    chrome.runtime.sendMessage({
      action: "pdfExportFailed",
      message: error.message
    });
  }
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