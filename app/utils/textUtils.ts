/**
 * Utility functions for text processing
 */

/**
 * Detects and cleans up repetitive text in a string
 * @param text The input text to clean
 * @returns Cleaned text with repetitions removed
 */
export function cleanRepetitiveText(text: string): string {
  if (!text || text.length < 10) return text;
  
  // Special case: Check for the pattern "tell me about X, company details." repeated multiple times
  // This handles the specific example in the issue
  const tellMeAboutPattern = /(tell me about [^,.]+, company details\.?\s*){2,}/gi;
  if (tellMeAboutPattern.test(text)) {
    const match = text.match(/(tell me about [^,.]+, company details\.?)/i);
    if (match && match[1]) {
      console.log("Detected 'tell me about X, company details' pattern repeated multiple times");
      text = match[1];
      return text;
    }
  }
  
  // Check for repeated sentences (common in copy-paste errors)
  // This pattern looks for sentences ending with period, question mark, or exclamation mark
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length >= 2) {
    const sentenceCounts: { [key: string]: number } = {};
    
    // Count occurrences of each sentence
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      sentenceCounts[trimmedSentence] = (sentenceCounts[trimmedSentence] || 0) + 1;
    }
    
    // Find sentences repeated more than twice
    for (const [sentence, count] of Object.entries(sentenceCounts)) {
      if (count > 2 && sentence.length > 10) { // Only consider substantial sentences
        console.log(`Detected repetitive sentence: "${sentence.substring(0, 30)}..." repeated ${count} times`);
        
        // Replace with just one instance of the sentence
        const escapedSentence = escapeRegExp(sentence);
        const regex = new RegExp(`(${escapedSentence}\\s*){2,}`, 'gi');
        text = text.replace(regex, `${sentence} `);
      }
    }
  }
  
  // First, check for exact repeated phrases (3 or more words)
  const words = text.split(/\s+/);
  if (words.length >= 6) { // Need at least 6 words to have a meaningful repetition
    // Try different phrase lengths
    for (let phraseLength = 3; phraseLength <= Math.min(10, Math.floor(words.length / 2)); phraseLength++) {
      const phrases: { [key: string]: number } = {};
      
      // Count occurrences of each phrase
      for (let i = 0; i <= words.length - phraseLength; i++) {
        const phrase = words.slice(i, i + phraseLength).join(' ');
        phrases[phrase] = (phrases[phrase] || 0) + 1;
      }
      
      // Find the most repeated phrase
      let mostRepeatedPhrase = '';
      let maxCount = 0;
      
      for (const [phrase, count] of Object.entries(phrases)) {
        if (count > maxCount && count >= 3) { // At least 3 repetitions
          mostRepeatedPhrase = phrase;
          maxCount = count;
        }
      }
      
      // If we found a significantly repeated phrase, clean it up
      if (maxCount >= 3) {
        console.log(`Detected repetitive phrase: "${mostRepeatedPhrase}" repeated ${maxCount} times`);
        
        // Replace with just one or two instances of the phrase
        const regex = new RegExp(`(${escapeRegExp(mostRepeatedPhrase)}\\s*){3,}`, 'gi');
        text = text.replace(regex, `${mostRepeatedPhrase} `);
        
        // Check if we still have repetitions after this cleanup
        if (text.length > 1000) {
          return cleanRepetitiveText(text); // Recursive call to handle nested repetitions
        }
        
        return text;
      }
    }
  }
  
  // Check for character-level repetition (like "aaaaaaaa")
  const charRepRegex = /(.)\1{10,}/g;
  text = text.replace(charRepRegex, '$1$1$1');
  
  // Check for word-level repetition (like "word word word word")
  const wordRepRegex = /\b(\w+)(\s+\1){3,}\b/g;
  text = text.replace(wordRepRegex, '$1 $1');
  
  return text;
}

/**
 * Escape special characters for use in a regular expression
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}