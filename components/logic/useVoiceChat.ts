import { useCallback, useEffect, useRef } from "react";
import { StreamingEvents } from "@heygen/streaming-avatar";
import { useStreamingAvatarContext } from "./context";

// Define a custom speech recognition handler
const useSpeechRecognition = () => {
  // This function will be used to enhance speech recognition
  const enhanceSpeechRecognition = useCallback(() => {
    // Check if the browser supports the Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported in this browser');
      return null;
    }

    // Create a speech recognition instance
    // Use type assertion to help TypeScript understand the correct type
    const SpeechRecognitionConstructor = (window.SpeechRecognition || 
      window.webkitSpeechRecognition) as typeof SpeechRecognition;
    
    const recognition = new SpeechRecognitionConstructor();
    
    // Configure speech recognition
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    return recognition;
  }, []);

  return { enhanceSpeechRecognition };
};

// Define a list of keywords that should be recognized correctly
const IMPORTANT_KEYWORDS = [
  // Printform variations
  { heard: "print form", actual: "printform" },
  { heard: "print-form", actual: "printform" },
  { heard: "print forum", actual: "printform" },
  { heard: "print from", actual: "printform" },
  { heard: "print phone", actual: "printform" },
  { heard: "print for", actual: "printform" },
  { heard: "print farm", actual: "printform" },
  { heard: "prince form", actual: "printform" },
  { heard: "what is print form", actual: "what is printform" },
  { heard: "tell me about print form", actual: "tell me about printform" },
  
  // Manufacturing process variations
  { heard: "see and see", actual: "CNC" },
  { heard: "see and see machining", actual: "CNC machining" },
  { heard: "3-d printing", actual: "3D printing" },
  { heard: "three d printing", actual: "3D printing" },
  
  // Material variations
  { heard: "abs plastic", actual: "ABS" },
  { heard: "pla plastic", actual: "PLA" }
];

// Function to improve speech recognition by correcting common misrecognitions
const improveRecognition = (text: string): string => {
  let improvedText = text.toLowerCase();
  let originalText = text;
  let wasImproved = false;
  
  // First pass: Check for exact matches of misrecognized keywords
  IMPORTANT_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword.heard}\\b`, 'gi');
    if (regex.test(improvedText)) {
      improvedText = improvedText.replace(regex, keyword.actual);
      wasImproved = true;
    }
  });
  
  // Second pass: Check for partial matches if no exact matches were found
  if (!wasImproved) {
    // Check if the text contains any questions about printform
    if (improvedText.includes("what") && 
        (improvedText.includes("print") || improvedText.includes("form"))) {
      if (improvedText.includes("what is") || 
          improvedText.includes("what's") || 
          improvedText.includes("tell me about") || 
          improvedText.includes("explain")) {
        
        // If it looks like a question about printform, improve it
        if (improvedText.includes("print") && 
            (improvedText.includes("form") || 
             improvedText.includes("from") || 
             improvedText.includes("forum") || 
             improvedText.includes("for") || 
             improvedText.includes("farm"))) {
          
          // Replace the entire phrase with a well-formed question about printform
          if (improvedText.includes("what is") || improvedText.includes("what's")) {
            improvedText = "what is printform";
          } else if (improvedText.includes("tell me about")) {
            improvedText = "tell me about printform";
          } else {
            improvedText = "explain printform";
          }
          
          wasImproved = true;
        }
      }
    }
  }
  
  // If we made improvements, preserve the original capitalization pattern
  if (wasImproved) {
    // If the original text started with uppercase, make the improved text start with uppercase too
    if (/^[A-Z]/.test(originalText)) {
      improvedText = improvedText.charAt(0).toUpperCase() + improvedText.slice(1);
    }
    
    console.log(`Speech recognition improved: "${originalText}" → "${improvedText}"`);
  }
  
  return improvedText;
};

export const useVoiceChat = () => {
  const {
    avatarRef,
    isMuted,
    setIsMuted,
    isVoiceChatActive,
    setIsVoiceChatActive,
    isVoiceChatLoading,
    setIsVoiceChatLoading,
    handleUserTalkingMessage,
  } = useStreamingAvatarContext();
  
  const { enhanceSpeechRecognition } = useSpeechRecognition();
  const originalHandlerRef = useRef<any>(null);

  // Set up enhanced speech recognition and message interception when voice chat becomes active
  useEffect(() => {
    if (isVoiceChatActive && !isMuted && avatarRef.current) {
      console.log("Setting up enhanced voice recognition for keywords");
      
      // Store the original event handler reference
      if (!originalHandlerRef.current) {
        // Create our enhanced handler function
        const enhancedHandler = (event: any) => {
          // Improve the recognition by correcting common misrecognitions
          if (event?.detail?.message) {
            const originalMessage = event.detail.message;
            const improvedMessage = improveRecognition(originalMessage);
            
            // Special handling for printform-related queries
            const isPrintformQuery = 
              improvedMessage.toLowerCase().includes("printform") || 
              (improvedMessage.toLowerCase().includes("print") && 
               (improvedMessage.toLowerCase().includes("form") || 
                improvedMessage.toLowerCase().includes("from")));
            
            if (isPrintformQuery) {
              console.log("Detected printform-related query:", improvedMessage);
              
              // Ensure the message is clearly about printform
              if (!improvedMessage.toLowerCase().includes("printform")) {
                // If it contains print and form/from but not as a single word, fix it
                const fixedMessage = improvedMessage.replace(
                  /\b(print)\s+(form|from|forum|for|farm)\b/gi, 
                  "printform"
                );
                event.detail.message = fixedMessage;
                console.log(`Fixed printform query: "${originalMessage}" → "${fixedMessage}"`);
              } else {
                // Already contains "printform", just update the message
                event.detail.message = improvedMessage;
              }
            } else if (improvedMessage !== originalMessage) {
              // For non-printform queries that were improved
              console.log(`Speech recognition improved: "${originalMessage}" → "${improvedMessage}"`);
              event.detail.message = improvedMessage;
            }
          }
          
          // Call the context handler with the improved event
          handleUserTalkingMessage(event);
        };
        
        // Store our enhanced handler for cleanup
        originalHandlerRef.current = enhancedHandler;
        
        // Remove any existing handlers for this event
        // We need to pass both the event name and the handler function
        // If we don't have the original handler yet, we can pass handleUserTalkingMessage
        // which is the default handler from the context
        avatarRef.current.off(StreamingEvents.USER_TALKING_MESSAGE, handleUserTalkingMessage);
        
        // Add our enhanced handler
        avatarRef.current.on(StreamingEvents.USER_TALKING_MESSAGE, enhancedHandler);
        
        console.log("Enhanced voice recognition handler installed");
      }
    }
    
    // Cleanup function
    return () => {
      if (originalHandlerRef.current && avatarRef.current) {
        // Remove our enhanced handler
        avatarRef.current.off(StreamingEvents.USER_TALKING_MESSAGE, originalHandlerRef.current);
        
        // Add back a basic handler that uses the context function
        avatarRef.current.on(StreamingEvents.USER_TALKING_MESSAGE, handleUserTalkingMessage);
        
        console.log("Restored original voice recognition handler");
        
        // Clear the reference
        originalHandlerRef.current = null;
      }
    };
  }, [isVoiceChatActive, isMuted, avatarRef, enhanceSpeechRecognition, handleUserTalkingMessage, originalHandlerRef]);

  const startVoiceChat = useCallback(
    async (isInputAudioMuted?: boolean) => {
      if (!avatarRef.current) return;
      setIsVoiceChatLoading(true);
      
      try {
        console.log("Starting voice chat with settings:", { isInputAudioMuted });
        
        // Start voice chat with the avatar
        // Use type assertion to include useSilencePrompt parameter
        await avatarRef.current?.startVoiceChat({
          isInputAudioMuted,
          // @ts-ignore - Enable silence prompt to improve the experience (supported in API but not in types)
          useSilencePrompt: true
        } as any);
        
        console.log("Voice chat started successfully");
        
        // Ensure microphone is active if not muted
        if (!isInputAudioMuted) {
          console.log("Unmuting input audio");
          setTimeout(() => {
            avatarRef.current?.unmuteInputAudio();
          }, 500);
        }
        
        setIsVoiceChatActive(true);
        setIsMuted(!!isInputAudioMuted);
      } catch (error) {
        console.error("Error starting voice chat:", error);
      } finally {
        setIsVoiceChatLoading(false);
      }
    },
    [avatarRef, setIsMuted, setIsVoiceChatActive, setIsVoiceChatLoading],
  );

  const stopVoiceChat = useCallback(() => {
    if (!avatarRef.current) return;
    avatarRef.current?.closeVoiceChat();
    setIsVoiceChatActive(false);
    setIsMuted(true);
  }, [avatarRef, setIsMuted, setIsVoiceChatActive]);

  const muteInputAudio = useCallback(() => {
    if (!avatarRef.current) return;
    avatarRef.current?.muteInputAudio();
    setIsMuted(true);
  }, [avatarRef, setIsMuted]);

  const unmuteInputAudio = useCallback(() => {
    if (!avatarRef.current) return;
    avatarRef.current?.unmuteInputAudio();
    setIsMuted(false);
  }, [avatarRef, setIsMuted]);

  return {
    startVoiceChat,
    stopVoiceChat,
    muteInputAudio,
    unmuteInputAudio,
    isMuted,
    isVoiceChatActive,
    isVoiceChatLoading,
  };
};
