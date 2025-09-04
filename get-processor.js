function createGPTPrompt(profileData) {
  return `
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
}

function parseGPTResponse(response) {
    try {
        // Try to find a JSON block first
        const jsonMatch = response.match(/{[\s\S]*}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        console.error("Failed to parse extracted JSON", e);
    }
    // If that fails, try parsing the whole thing (in case it's a raw JSON response)
    try {
        return JSON.parse(response);
    } catch (e) {
         throw new Error('GPT did not return valid JSON');
    }
}