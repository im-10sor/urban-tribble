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
    return JSON.parse(response);
  } catch (e) {
    // If GPT didn't return valid JSON, try to extract JSON from the response
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/{[\s\S]*}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('GPT did not return valid JSON');
    }
  }
}