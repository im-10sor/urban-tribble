console.log('Airbnb Persona Creator content script loaded');
// JSPdf Integration
const jspdfUrl = chrome.runtime.getURL('libs/jspdf.umd.min.js');
let jsPDFLoaded = false;

// Load jsPDF when content script starts
async function loadJsPDF() {
  if (jsPDFLoaded) return true;

  try {
    await import(jspdfUrl);
    jsPDFLoaded = true;
    console.log('✅ jsPDF UMD loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to load jsPDF UMD:', error);
    return false;
  }
}
// Pre-load the jsPDF library
loadJsPDF();

// Message listener
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Message received:', request.action);
  if (request.action === "scrapeProfile") {
    extractProfileData()
      .then(profileData => {
        sendResponse(profileData); // Reply with scraped profileData directly
      })
      .catch(error => {
        console.error('Error scraping profile:', error);
        sendResponse(null); // Reply with null on error
      });
    return true; // Keep message channel open for async response
  }
  if (request.action === "exportPDF") {
    exportProfileToPDF(request.data)
      .then(success => {
        sendResponse({ success: success });
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
    // Extract name
    const nameElement = document.querySelector('span.t1gpcl1t.atm_w4_16rzvi6.atm_9s_1o8liyq.atm_gi_idpfg4.dir.dir-ltr');
    const name = nameElement ? nameElement.textContent.trim() : 'Unknown';

    // Extract location
    const locationElement = document.querySelector('.s1woay09 span');
    const location = locationElement ? locationElement.textContent.trim() : 'Unknown';

    // Extract stats
    const stats = {};
    const statElements = document.querySelectorAll('.s1oxm7bp');
    statElements.forEach(el => {
      const value = el.querySelector('.vqkyk4b')?.textContent.trim();
      const label = el.querySelector('.lh1pygb')?.textContent.trim().toLowerCase();
      if (value && label) {
        stats[label] = value;
      }
    });

    // Extract guest self-description
    const selfDescElement = document.querySelector('div._1ww3fsj9 > span._1e2prbn');
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
    const interestElements = document.querySelectorAll('ul.izloe29 > li.i13xhekt .t1jabgzk');
    interestElements.forEach(el => {
      const interest = el.textContent.trim();
      if (interest) interests.push(interest);
    });

    // Extract verification status
    const verified = document.querySelector('.bbkw4bl') !== null;

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

// PDF Export function
async function exportProfileToPDF(profileData) {
  if (!jsPDFLoaded) {
    const loaded = await loadJsPDF();
    if (!loaded) {
      throw new Error('jsPDF UMD library failed to load');
    }
  }

  try {
    // UMD version uses window.jspdf.jsPDF instead of window.jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = 20;

    // Add Airbnb-style header
    doc.setFillColor(255, 90, 95); // Airbnb red
    doc.rect(0, 0, pageWidth, 60, 'F');

    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text('Airbnb Guest Persona', pageWidth / 2, 35, { align: 'center' });

    // Reset text color
    doc.setTextColor(0, 0, 0);
    yPosition = 70;

    // Profile Header Section
    doc.setFontSize(18);
    doc.text(profileData.name, margin, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`📍 ${profileData.location}`, margin, yPosition);
    yPosition += 15;

    // Stats Section
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Profile Statistics', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    if (profileData.stats) {
      Object.entries(profileData.stats).forEach(([key, value]) => {
        doc.text(`• ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`, margin, yPosition);
        yPosition += 6;
      });
    }
    yPosition += 10;

    // About Section
    if (profileData.about && profileData.about.length > 0) {
      doc.setFontSize(14);
      doc.text('About', margin, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      profileData.about.forEach(item => {
        const lines = doc.splitTextToSize(`• ${item}`, pageWidth - (margin * 2));
        lines.forEach(line => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, margin, yPosition);
          yPosition += 6;
        });
        yPosition += 2;
      });
      yPosition += 5;
    }

    // Guest Says Section
    if (profileData.guestSays) {
      doc.setFontSize(14);
      doc.text('Guest Description', margin, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      const guestLines = doc.splitTextToSize(profileData.guestSays, pageWidth - (margin * 2));
      guestLines.forEach(line => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });
      yPosition += 10;
    }

    // Interests Section
    if (profileData.interests && profileData.interests.length > 0) {
      doc.setFontSize(14);
      doc.text('Interests', margin, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.text(profileData.interests.join(', '), margin, yPosition, {
        maxWidth: pageWidth - (margin * 2)
      });
      yPosition += 15;
    }

    // Visited Places Section
    if (profileData.visitedPlaces && profileData.visitedPlaces.length > 0) {
      doc.setFontSize(14);
      doc.text('Recently Visited Places', margin, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      profileData.visitedPlaces.slice(0, 10).forEach((place, index) => {
        const text = `• ${place.placeName} (${place.monthYear})`;
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(text, margin, yPosition);
        yPosition += 6;
      });
      yPosition += 10;
    }

    // Reviews Section
    if (profileData.reviews && profileData.reviews.length > 0) {
      doc.setFontSize(14);
      doc.text('Recent Reviews', margin, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      profileData.reviews.slice(0, 5).forEach((review, index) => {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFont(undefined, 'bold');
        doc.text(`${review.reviewer} - ${review.date}`, margin, yPosition);
        yPosition += 6;

        doc.setFont(undefined, 'normal');
        const reviewLines = doc.splitTextToSize(review.content, pageWidth - (margin * 2));
        reviewLines.forEach(line => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, margin, yPosition);
          yPosition += 6;
        });
        yPosition += 5;
      });
    }

    // Footer
    const finalY = Math.min(yPosition + 20, 280);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Profile URL: ${profileData.profileUrl}`, margin, finalY);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, finalY + 5);
    doc.text(`Verified: ${profileData.verified ? 'Yes' : 'No'}`, margin, finalY + 10);

    // Save PDF
    const filename = `Airbnb_Persona_${profileData.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    doc.save(filename);

    console.log('✅ Persona PDF exported:', filename);
    return true;

  } catch (error) {
    console.error('❌ PDF export failed:', error);
    throw error;
  }
}


// Helper functions (kept from your previous code)
function scrapeCurrentPlaces() {
  const results = [];
  const placeElements = document.querySelectorAll('div.c14tdjhp[title]');
  placeElements.forEach(el => {
    const placeNameElem = el.querySelector('div[id^="caption"]');
    const dateElem = el.querySelector('span[id^="subtitle"]');
    if (placeNameElem && dateElem) {
      results.push({
        placeName: placeNameElem.textContent.trim(),
        monthYear: dateElem.textContent.trim()
      });
    }
  });
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
  const aboutElements = document.querySelectorAll('.rx7n8c4');
  aboutElements.forEach(el => {
    const text = el.querySelector('.i87tibg')?.textContent.trim();
    if (text) aboutItems.push(text);
  });
  return aboutItems;
}

function scrapeReviews() {
  const reviews = [];
  const reviewElements = document.querySelectorAll('.c1mr303f');
  reviewElements.forEach(el => {
    const reviewer = el.querySelector('.t1n02t28')?.textContent.trim();
    const date = el.querySelector('.d1rm4ilz')?.textContent.trim();
    const content = el.querySelector('.c1op3f1i div')?.textContent.trim();
    if (reviewer && content) {
      reviews.push({ reviewer, date, content });
    }
  });
  return reviews;
}
