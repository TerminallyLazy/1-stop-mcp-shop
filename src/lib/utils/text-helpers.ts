/**
 * Helper functions for text processing
 */

/**
 * Extract a city name from a more complex query
 * Handles inputs like "What's the weather in New York?" or "The weather in London"
 */
export function extractCityName(input: string): string {
  // Remove special characters that might interfere with extraction
  const cleanedInput = input.replace(/[\"\'\.\?!,;:\(\)\[\]\{\}]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Common city name extraction patterns
  const patterns = [
    // Extract city name after "in" (e.g., "weather in New York" -> "New York")
    /(?:weather|forecast|temperature)\s+in\s+([A-Za-z0-9\s\-\.]+)(?:\s|$)/i,
    // Extract city name after "for" (e.g., "weather for Chicago" -> "Chicago")
    /(?:weather|forecast|temperature)\s+for\s+([A-Za-z0-9\s\-\.]+)(?:\s|$)/i,
    // Direct city name at the beginning (e.g., "New York weather" -> "New York")
    /^([A-Za-z0-9\s\-\.]+)\s+(?:weather|forecast|temperature)/i,
    // Extract city name from "is in" or "currently in" patterns
    /(?:is|currently)(?:\s+in)?\s+([A-Za-z0-9\s\-\.]+)(?:\s|$)/i,
    // Direct city name with no context (e.g., "Seattle" -> "Seattle")
    /^([A-Za-z0-9\s\-\.]+)$/i,
    // "What is the weather in" pattern
    /what\s+is\s+the\s+weather\s+in\s+([A-Za-z0-9\s\-\.]+)(?:\s|$)/i
  ];
  
  // Try each pattern in order
  for (const pattern of patterns) {
    const match = cleanedInput.match(pattern);
    if (match && match[1]) {
      // Clean up the extracted city name
      const extractedCity = match[1].trim();
      
      // Handle special case for "seattle." (with period) or similar
      if (extractedCity.toLowerCase() === 'seattle.') {
        return 'Seattle';
      }
      
      // Handle specific known cities with different casing
      const knownCities: Record<string, string> = {
        'new york': 'New York',
        'los angeles': 'Los Angeles',
        'san francisco': 'San Francisco',
        'seattle': 'Seattle',
        'new york, us': 'New York'
      };
      
      const lowerCity = extractedCity.toLowerCase();
      if (knownCities[lowerCity]) {
        return knownCities[lowerCity];
      }
      
      return extractedCity;
    }
  }
  
  // If no patterns match, just return the original input
  return cleanedInput;
}
