console.log('PDF Generator script loaded');

// Get the data from storage
chrome.storage.local.get(['pdfData', 'pdfIsEnhanced', 'lastEnhancedData'], async function(result) {
    console.log('Storage results:', result);
    const statusEl = document.getElementById('status');    
    
    if (!result.pdfData) {
        const errorMsg = 'Error: No data available for PDF generation';
        console.error(errorMsg, result);
        statusEl.textContent = errorMsg;
        statusEl.className = 'status error';
        chrome.runtime.sendMessage({
            action: "pdfGenerationFailed",
            message: errorMsg
        });
        return;
    }
    
    try {
        statusEl.textContent = 'Creating PDF document...';
        console.log('Starting PDF creation with data:', result.pdfData);
        
        // Get enhanced data if needed
        let enhancedData = null;
        if (result.pdfIsEnhanced) {
            enhancedData = result.lastEnhancedData;
            console.log('Enhanced data found:', enhancedData);
        }
        
        // Create the PDF with enhanced data if available
        const filename = await createPDF(result.pdfData, result.pdfIsEnhanced, enhancedData);
        
        statusEl.textContent = 'PDF created successfully! Download should start automatically.';
        statusEl.className = 'status success';
        console.log('PDF created successfully:', filename);
        
        // Notify the background script
        chrome.runtime.sendMessage({
            action: "pdfGenerationComplete",
            filename: filename
        });
        
        // Close the tab after a short delay
        setTimeout(() => {
            window.close();
        }, 2000);
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        statusEl.textContent = 'Error: ' + error.message;
        statusEl.className = 'status error';
        
        chrome.runtime.sendMessage({
            action: "pdfGenerationFailed",
            message: error.message
        });
        
        setTimeout(() => {
            window.close();
        }, 5000);
    }
});

// PDF creation function
async function createPDF(data, isEnhanced = false, enhancedData = null) {
    return new Promise((resolve, reject) => {
        try {
            console.log('Creating PDF with data:', { data, isEnhanced, enhancedData });
            
            // Check if jsPDF is available
            if (typeof jspdf === 'undefined') {
                throw new Error('jsPDF library not loaded');
            }
            
            // Use the jsPDF from the imported library
            const doc = new jspdf.jsPDF();
            const config = {
                margin: 20,
                headerHeight: 60,
                maxY: 270,
                fontSize: { title: 24, heading: 14, body: 10, small: 8 },
                colors: { 
                    airbnbRed: [255, 90, 95], 
                    black: [0, 0, 0], 
                    white: [255, 255, 255], 
                    gray: [100, 100, 100] 
                }
            };

            const pageWidth = doc.internal.pageSize.getWidth();
            let yPosition = config.margin;

            // Add Airbnb-style header
            doc.setFillColor(...config.colors.airbnbRed);
            doc.rect(0, 0, pageWidth, config.headerHeight, 'F');

            doc.setFontSize(config.fontSize.title);
            doc.setTextColor(...config.colors.white);
            doc.text('Airbnb Guest Persona', pageWidth / 2, 35, { align: 'center' });

            // Reset text color
            doc.setTextColor(...config.colors.black);
            yPosition = 70;

            // Profile Header Section - with fallbacks
            doc.setFontSize(18);
            doc.text(data.name || 'Unknown Guest', config.margin, yPosition);
            yPosition += 10;

            doc.setFontSize(12);
            doc.setTextColor(...config.colors.gray);
            doc.text(`📍 ${data.location || 'Location not specified'}`, config.margin, yPosition);
            yPosition += 15;

            // Stats Section
            doc.setFontSize(14);
            doc.setTextColor(...config.colors.black);
            doc.text('Profile Statistics', config.margin, yPosition);
            yPosition += 10;

            doc.setFontSize(10);
            if (data.stats) {
                Object.entries(data.stats).forEach(([key, value]) => {
                    yPosition = checkPageBreak(doc, yPosition, config);
                    doc.text(`• ${formatKey(key)}: ${value}`, config.margin, yPosition);
                    yPosition += 6;
                });
            }
            yPosition += 10;

            // About Section
            if (data.about && data.about.length > 0) {
                yPosition = checkPageBreak(doc, yPosition, config, 15);
                doc.setFontSize(14);
                doc.text('About', config.margin, yPosition);
                yPosition += 10;

                doc.setFontSize(10);
                data.about.forEach(item => {
                    const lines = doc.splitTextToSize(`• ${item}`, pageWidth - (config.margin * 2));
                    lines.forEach(line => {
                        yPosition = checkPageBreak(doc, yPosition, config);
                        doc.text(line, config.margin, yPosition);
                        yPosition += 6;
                    });
                    yPosition += 2;
                });
                yPosition += 5;
            }

            // Guest Says Section
            if (data.guestSays) {
                yPosition = checkPageBreak(doc, yPosition, config, 15);
                doc.setFontSize(14);
                doc.text('Guest Description', config.margin, yPosition);
                yPosition += 10;

                doc.setFontSize(10);
                const guestLines = doc.splitTextToSize(data.guestSays, pageWidth - (config.margin * 2));
                guestLines.forEach(line => {
                    yPosition = checkPageBreak(doc, yPosition, config);
                    doc.text(line, config.margin, yPosition);
                    yPosition += 6;
                });
                yPosition += 10;
            }

            // Enhanced Persona Section (if applicable)
            if (isEnhanced && enhancedData) {
                yPosition = checkPageBreak(doc, yPosition, config, 20);
                doc.setFontSize(16);
                doc.setTextColor(...config.colors.airbnbRed);
                doc.text('AI Persona Analysis', config.margin, yPosition);
                yPosition += 12;
                
                doc.setFontSize(10);
                doc.setTextColor(...config.colors.black);
                
                const persona = enhancedData;
                const personaFields = [
                    { key: 'personaName', label: 'Persona' },
                    { key: 'demographics', label: 'Demographics' },
                    { key: 'psychologicalProfile', label: 'Psychological Profile' },
                    { key: 'emotionalDrivers', label: 'Emotional Drivers' },
                    { key: 'painPoints', label: 'Pain Points' },
                    { key: 'travelBehavior', label: 'Travel Behavior' },
                    { key: 'customerValue', label: 'Customer Value' },
                    { key: 'marketingRecommendations', label: 'Marketing Recommendations' },
                    { key: 'communicationStyle', label: 'Communication Style' }
                ];
                
                personaFields.forEach(field => {
                    if (persona[field.key]) {
                        yPosition = checkPageBreak(doc, yPosition, config, 15);
                        doc.setFontSize(12);
                        doc.text(field.label, config.margin, yPosition);
                        yPosition += 8;
                        
                        doc.setFontSize(10);
                        const value = typeof persona[field.key] === 'string' ? 
                                     persona[field.key] : 
                                     JSON.stringify(persona[field.key], null, 2);
                        
                        const lines = doc.splitTextToSize(value, pageWidth - (config.margin * 2));
                        lines.forEach(line => {
                            yPosition = checkPageBreak(doc, yPosition, config);
                            doc.text(line, config.margin, yPosition);
                            yPosition += 6;
                        });
                        yPosition += 5;
                    }
                });
            }

            // Reviews Section
            if (data.reviews && data.reviews.length > 0) {
                yPosition = checkPageBreak(doc, yPosition, config, 20);
                doc.setFontSize(14);
                doc.text('Recent Reviews', config.margin, yPosition);
                yPosition += 10;

                doc.setFontSize(10);
                data.reviews.slice(0, 5).forEach(review => {
                    yPosition = checkPageBreak(doc, yPosition, config, 20);
                    
                    doc.setFont(undefined, 'bold');
                    doc.text(`${review.reviewer || 'Anonymous'} - ${review.date || 'Unknown date'}`, config.margin, yPosition);
                    yPosition += 6;
                    
                    doc.setFont(undefined, 'normal');
                    const reviewLines = doc.splitTextToSize(review.content || 'No content', pageWidth - (config.margin * 2));
                    reviewLines.forEach(line => {
                        yPosition = checkPageBreak(doc, yPosition, config);
                        doc.text(line, config.margin, yPosition);
                        yPosition += 6;
                    });
                    yPosition += 8;
                });
            }

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(...config.colors.gray);
            const footerY = doc.internal.pageSize.getHeight() - 10;
            doc.text(`Generated by AirPersona Extension • ${new Date().toLocaleDateString()} • ${window.location.href}`, pageWidth / 2, footerY, { align: 'center' });

            // Generate filename and download
            const filename = `Airbnb_${isEnhanced ? 'Persona' : 'Profile'}_${(data.name || 'Guest').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            const pdfBlob = doc.output('blob');
            
            chrome.downloads.download({
                url: URL.createObjectURL(pdfBlob),
                filename: filename,
                saveAs: false
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(new Error('Download failed: ' + chrome.runtime.lastError.message));
                } else {
                    resolve(filename);
                }
            });
            
        } catch (error) {
            console.error('Error in createPDF:', error);
            reject(error);
        }
    });
}

// Helper functions
function checkPageBreak(doc, yPosition, config, minSpace = 10) {
    if (yPosition > config.maxY - minSpace) {
        doc.addPage();
        return config.margin;
    }
    return yPosition;
}

function formatKey(key) {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace(/_/g, ' ');
}