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
       console.log('Raw data URL type:', typeof url);
console.log('Raw data URL value:', url);
    chrome.downloads.download({
      url: url,
      filename: rawFilename,
      saveAs: false
    });
    
      
    
    // Send to webhook
    await sendToWebhook(profileData, 'raw');
    
    // Process with GPT if requested
    if (processWithGPT) {
      const gptProcessed = await processWithGPT(profileData);
      
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
        
        // Send to webhook
        await sendToWebhook(gptProcessed, 'processed');
        
        // Notify popup
        chrome.runtime.sendMessage({action: "gptProcessingComplete"});
      }
    } else {
      // Notify popup
      chrome.runtime.sendMessage({action: "scrapingComplete"});
    }
  } catch (error) {
    console.error('Error processing profile data:', error);
    chrome.runtime.sendMessage({action: "error", message: error.message});
  }
}

async function processWithGPT(profileData) {
  try {
    // Get API key from storage
    const data = await chrome.storage.sync.get(['openaiKey']);
    if (!data.openaiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    // Prepare prompt for GPT
    const prompt = `
Create a business-oriented, emotionally driven persona based on this Airbnb guest profile data:

${JSON.stringify(profileData, null, 2)}

Please analyze this profile and create a comprehensive persona that includes:
1. A catchy persona name that reflects their personality
2. Demographic information (inferred or explicit)
3. Psychological profile (travel motivations, values, preferences)
4. Emotional drivers and pain points
5. Travel behavior patterns
6. Potential value as a customer
7. Marketing approach recommendations
8. Communication style preferences

Format the response as a JSON object with these fields. Be insightful and business-focused.
`;
    
    // Call GPT API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a marketing analyst specializing in creating customer personas from data. Provide detailed, business-focused insights in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      throw new Error(`GPT API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    const gptResponse = result.choices[0].message.content;
    
    // Parse the JSON response from GPT
    try {
      return JSON.parse(gptResponse);
    } catch (e) {
      // If GPT didn't return valid JSON, try to extract JSON from the response
      const jsonMatch = gptResponse.match(/```json\n([\s\S]*?)\n```/) || gptResponse.match(/{[\s\S]*}/);
      if (jsonMatch && jsonMatch[0]) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('GPT did not return valid JSON');
      }
    }
  } catch (error) {
    console.error('Error processing with GPT:', error);
    throw error;
  }
}