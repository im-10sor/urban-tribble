console.log('Airbnb Persona Creator content script loaded');

// Configuration
const CONFIG = {
  selectors: {
    verifications: '[data-testid*="verified"], .bbkw4bl, .verified-badge',
    about: '.rx7n8c4, .about-item, [data-testid*="about"]',
    languages: '[data-testid*="language"], .language-item',
    joinedDate: '[data-testid*="joined"], .join-date, .member-since'
  }
};

// Message listener
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Message received:', request.action);

  if (request.action === "scrapeProfile") {
    console.log('Starting profile scraping...');
    
    // Use setTimeout to ensure DOM is fully loaded
    setTimeout(async () => {
      try {
        const profileData = await extractProfileData();
        if (profileData) {
          console.log('Profile data scraped successfully:', profileData);
          sendResponse({ success: true, data: profileData });
        } else {
          console.error('Failed to extract profile data');
          sendResponse({ success: false, error: 'Failed to extract profile data' });
        }
      } catch (error) {
        console.error('Error in scraping:', error);
        sendResponse({ success: false, error: error.message });
      }
    }, 1000); // Wait 1 second for DOM to be ready
    
    return true; // Keep message channel open for async response
  }

  if (request.action === "processWithGPT") {
    processWithGPT(request.profileData)
      .then(processedData => {
        sendResponse(processedData);
      })
      .catch(error => {
        console.error('Error processing with GPT:', error);
        sendResponse(null);
      });
    return true;
  }

  if (request.action === "exportPDF") {
    exportProfileToPDF(request.data)
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        console.error('PDF export error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Profile scraping function
async function extractProfileData() {
  try {
    console.log('Extracting profile data...');
    
    // Extract name
    const nameElement = document.querySelector('h1, h2, [data-testid="user-profile-name"], .t1gpcl1t, span[class*="name"], .profile-name');
    const name = nameElement ? nameElement.textContent.trim() : 'Unknown';

    // Extract location
    const locationElement = document.querySelector('[data-testid="user-profile-location"], .s1woay09, .profile-location, .location');
    const location = locationElement ? locationElement.textContent.trim() : 'Unknown';

    // Extract stats
    const stats = {};
    const statElements = document.querySelectorAll('[data-testid*="stats"], .s1oxm7bp, .profile-stats, .stats-item');
    statElements.forEach(el => {
      const value = el.querySelector('.vqkyk4b, .stat-value, [class*="value"]')?.textContent.trim();
      const label = el.querySelector('.lh1pygb, .stat-label, [class*="label"]')?.textContent.trim().toLowerCase();
      if (value && label) {
        stats[label] = value;
      }
    });

    // Extract guest self-description
    const selfDescElement = document.querySelector('[data-testid="user-profile-description"], ._1e2prbn, .profile-description, .bio');
    const selfDescription = selfDescElement ? selfDescElement.textContent.trim() : null;
    const guestSays = selfDescription ? `${name} says that:- ${selfDescription}` : null;

    // Extract visited places
    const visitedPlaces = scrapeCurrentPlaces();

    // Extract about section
    const aboutItems = await extractAboutItems();

    // Expand and scrape reviews
    await expandAllReviews();
    const reviews = scrapeReviews();

    // Extract interests
    const interests = [];
    const interestElements = document.querySelectorAll('[data-testid*="interest"], .izloe29, .interests, .interest-item');
    interestElements.forEach(el => {
      const interest = el.textContent.trim();
      if (interest) interests.push(interest);
    });

    // Extract verification status
    const verified = document.querySelector('[data-testid*="verified"], .bbkw4bl, .verified-badge') !== null;

    // Extract joined date
    const joinedDateElement = document.querySelector('[data-testid*="joined"], .join-date, .member-since');
    const joinedDate = joinedDateElement ? joinedDateElement.textContent.trim() : 'Unknown';

    // Compile all data
    const profileData = {
      name,
      location,
      stats,
      about: aboutItems,
      guestSays,
      interests,
      visitedPlaces,
      reviews,
      verified,
      joinedDate,
      profileUrl: window.location.href,
      scrapedAt: new Date().toISOString()
    };

    console.log('Profile data scraped:', profileData);
    return profileData;
  } catch (error) {
    console.error('Error extracting profile data:', error);
    return null;
  }
}

// Helper functions
function scrapeCurrentPlaces() {
  const results = [];
  try {
    const placeElements = document.querySelectorAll('div.c14tdjhp[title], .visited-place, .place-item');
    placeElements.forEach(el => {
      const placeNameElem = el.querySelector('div[id^="caption"], .place-name');
      const dateElem = el.querySelector('span[id^="subtitle"], .visit-date');
      if (placeNameElem && dateElem) {
        results.push({
          placeName: placeNameElem.textContent.trim(),
          monthYear: dateElem.textContent.trim()
        });
      }
    });
  } catch (error) {
    console.error('Error scraping visited places:', error);
  }
  return results;
}

async function expandAllReviews() {
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const showAll = document.querySelector('button > span[data-button-content="true"].bpg39da');
  if (showAll) {
    showAll.click();
    await wait(2000);
  }
  let clicked;
  do {
    clicked = false;
    const buttons = Array.from(document.querySelectorAll('button'));
    const showMoreBtn = buttons.find(btn => btn.textContent.trim().toLowerCase() === 'show more reviews');
    if (showMoreBtn) {
      showMoreBtn.click();
      clicked = true;
      await wait(2000);
    }
  } while (clicked);
}

async function expandAbout() {
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const showAllAboutBtn = document.querySelector('button[data-testid="expand-about"]') ||
                         document.querySelector('button[aria-label*="Show all"]') ||
                         Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.trim().toLowerCase() === 'show all');
  if (showAllAboutBtn) {
    showAllAboutBtn.click();
    await wait(1500);
  }
}

async function extractAboutItems() {
  await expandAbout();
  const aboutItems = [];
  const aboutElements = document.querySelectorAll('.rx7n8c4, .about-item, [data-testid*="about"]');
  aboutElements.forEach(el => {
    const text = el.querySelector('.i87tibg, .about-text')?.textContent.trim();
    if (text) aboutItems.push(text);
  });
  return aboutItems;
}

function scrapeReviews() {
  const reviews = [];
  const reviewElements = document.querySelectorAll('.c1mr303f, .review-item, [data-testid*="review"]');
  reviewElements.forEach(el => {
    const reviewer = el.querySelector('.t1n02t28, .reviewer-name')?.textContent.trim();
    const date = el.querySelector('.d1rm4ilz, .review-date')?.textContent.trim();
    const content = el.querySelector('.c1op3f1i div, .review-content')?.textContent.trim();
    if (reviewer && content) {
      reviews.push({ reviewer, date, content });
    }
  });
  return reviews;
}

// GPT Processing
async function processWithGPT(profileData) {
  try {
    // Get auth token from storage
    const token = await new Promise(resolve => {
      chrome.storage.local.get(['authToken'], function(result) {
        resolve(result.authToken);
      });
    });
    
    if (!token) {
      throw new Error('Not authenticated. Please login first.');
    }

    // Call backend API for GPT processing
    const response = await fetch('https://bnb-ai-backend.onrender.com/api/process-with-gpt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
    console.error('Error processing with GPT:', error);
    throw error;
  }
}

// PDF Export
async function exportProfileToPDF(profileData) {
  try {
    // Send data to background script for PDF generation
    chrome.runtime.sendMessage({
      action: "generatePDF",
      data: profileData,
      isEnhanced: false
    }, function(response) {
      if (response && response.success) {
        console.log('✅ PDF generation started');
        return true;
      } else {
        console.error('❌ PDF export failed:', response?.error);
        throw new Error(response?.error || 'PDF export failed');
      }
    });
    
  } catch (error) {
    console.error('❌ PDF export failed:', error);
    throw error;
  }
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

// Call debug function to help identify working selectors
setTimeout(testSelectors, 2000);