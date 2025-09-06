// openai-pdf-generator.js
async function generatePDFWithOpenAI(profileData, enhancedData = null) {
  try {
    // Get auth token
    const data = await chrome.storage.local.get(['authToken']);
    if (!data.authToken) {
      throw new Error('Not authenticated');
    }

    // Call backend for PDF content
    const response = await fetch('https://bnb-ai-backend.onrender.com/api/generate-pdf-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.authToken}`
      },
      body: JSON.stringify({
        profileData: profileData,
        enhancedData: enhancedData
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF content');
    }

    const result = await response.json();

    if (result.success) {
      // Create PDF from the generated content
      await createPDFFromContent(result.pdfContent, profileData.name, enhancedData !== null);
      return true;
    } else {
      throw new Error('PDF content generation failed');
    }

  } catch (error) {
    console.error('OpenAI PDF generation error:', error);
    throw error;
  }
}

async function createPDFFromContent(content, name, isEnhanced) {
  return new Promise((resolve, reject) => {
    try {
      // Check if jsPDF is available
      if (typeof jspdf === 'undefined') {
        throw new Error('jsPDF library not loaded');
      }

      const doc = new jspdf.jsPDF();
      
      // Set up PDF
      doc.setFontSize(16);
      doc.text(`Airbnb Guest Persona - ${name}`, 105, 15, { align: 'center' });
      
      // Add content
      const lines = doc.splitTextToSize(content, 180);
      let yPosition = 30;
      
      doc.setFontSize(10);
      lines.forEach(line => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, 15, yPosition);
        yPosition += 7;
      });
      
      // Generate filename and download
      const filename = `Airbnb_${isEnhanced ? 'Persona' : 'Profile'}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const pdfBlob = doc.output('blob');
      
      chrome.downloads.download({
        url: URL.createObjectURL(pdfBlob),
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Download failed'));
        } else {
          resolve(filename);
        }
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generatePDFWithOpenAI, createPDFFromContent };
}