import StreamingAvatar, {
  ConnectionQuality,
  StreamingEvents,
  StreamingTalkingMessageEvent,
  UserTalkingMessageEvent,
  TaskType,
  TaskMode,
} from "@heygen/streaming-avatar";
import React, { useRef, useState } from "react";

export enum StreamingAvatarSessionState {
  INACTIVE = "inactive",
  CONNECTING = "connecting",
  CONNECTED = "connected",
}

export enum MessageSender {
  CLIENT = "CLIENT",
  AVATAR = "AVATAR",
}

export interface Message {
  id: string;
  sender: MessageSender;
  content: string;
}

type StreamingAvatarContextProps = {
  avatarRef: React.MutableRefObject<StreamingAvatar | null>;
  basePath?: string;

  isMuted: boolean;
  setIsMuted: (isMuted: boolean) => void;
  isVoiceChatLoading: boolean;
  setIsVoiceChatLoading: (isVoiceChatLoading: boolean) => void;
  isVoiceChatActive: boolean;
  setIsVoiceChatActive: (isVoiceChatActive: boolean) => void;

  sessionState: StreamingAvatarSessionState;
  setSessionState: (sessionState: StreamingAvatarSessionState) => void;
  stream: MediaStream | null;
  setStream: (stream: MediaStream | null) => void;

  messages: Message[];
  clearMessages: () => void;
  handleUserTalkingMessage: ({
    detail,
  }: {
    detail: UserTalkingMessageEvent;
  }) => void;
  handleStreamingTalkingMessage: ({
    detail,
  }: {
    detail: StreamingTalkingMessageEvent;
  }) => void;
  handleEndMessage: (event?: any) => void;

  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
  isUserTalking: boolean;
  setIsUserTalking: (isUserTalking: boolean) => void;
  isAvatarTalking: boolean;
  setIsAvatarTalking: (isAvatarTalking: boolean) => void;

  connectionQuality: ConnectionQuality;
  setConnectionQuality: (connectionQuality: ConnectionQuality) => void;
};

const StreamingAvatarContext = React.createContext<StreamingAvatarContextProps>(
  {
    avatarRef: { current: null },
    isMuted: true,
    setIsMuted: () => {},
    isVoiceChatLoading: false,
    setIsVoiceChatLoading: () => {},
    sessionState: StreamingAvatarSessionState.INACTIVE,
    setSessionState: () => {},
    isVoiceChatActive: false,
    setIsVoiceChatActive: () => {},
    stream: null,
    setStream: () => {},
    messages: [],
    clearMessages: () => {},
    handleUserTalkingMessage: () => {},
    handleStreamingTalkingMessage: () => {},
    handleEndMessage: () => {},
    isListening: false,
    setIsListening: () => {},
    isUserTalking: false,
    setIsUserTalking: () => {},
    isAvatarTalking: false,
    setIsAvatarTalking: () => {},
    connectionQuality: ConnectionQuality.UNKNOWN,
    setConnectionQuality: () => {},
  },
);

const useStreamingAvatarSessionState = () => {
  const [sessionState, setSessionState] = useState(
    StreamingAvatarSessionState.INACTIVE,
  );
  const [stream, setStream] = useState<MediaStream | null>(null);

  return {
    sessionState,
    setSessionState,
    stream,
    setStream,
  };
};

const useStreamingAvatarVoiceChatState = () => {
  const [isMuted, setIsMuted] = useState(true);
  const [isVoiceChatLoading, setIsVoiceChatLoading] = useState(false);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);

  return {
    isMuted,
    setIsMuted,
    isVoiceChatLoading,
    setIsVoiceChatLoading,
    isVoiceChatActive,
    setIsVoiceChatActive,
  };
};

const useStreamingAvatarMessageState = (avatarRef: React.MutableRefObject<StreamingAvatar | null>) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const currentSenderRef = useRef<MessageSender | null>(null);
  
  // Add a ref to track the last message to prevent duplicates
  const lastMessageRef = useRef<{content: string, timestamp: number} | null>(null);

  const handleUserTalkingMessage = ({
    detail,
  }: {
    detail: UserTalkingMessageEvent;
  }) => {
    // Log the received user message for debugging
    console.log("Received user talking message:", detail.message);
    
    // Skip empty messages or messages that are just whitespace
    if (!detail.message || detail.message.trim() === '') {
      return;
    }
    
    // Clean up the incoming message fragment
    let messageFragment = detail.message.trim();
    
    // Check for repeated phrases like "What is printform What is printform"
    const repeatedPhraseRegex = /(.{5,}?)\s+\1(\s+\1)*/gi;
    if (repeatedPhraseRegex.test(messageFragment)) {
      const originalMessage = messageFragment;
      messageFragment = messageFragment.replace(repeatedPhraseRegex, "$1");
      console.log("Cleaned up repetitive phrases in user input:", 
        `Original: "${originalMessage}" -> Cleaned: "${messageFragment}"`);
    }
    
    // Check if this is a continuation of the current message
    if (currentSenderRef.current === MessageSender.CLIENT) {
      // Check for repetitive fragments that might be speech recognition errors
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.sender !== MessageSender.CLIENT) return prev;
        
        // Check if this fragment is already at the end of the last message
        // This happens sometimes with speech recognition
        if (lastMessage.content.endsWith(messageFragment)) {
          console.log("Skipping duplicate speech fragment:", messageFragment);
          return prev; // Skip this fragment as it's already in the message
        }
        
        // Check if this is a repetition of the entire message
        if (lastMessage.content.includes(messageFragment) && messageFragment.length > 5) {
          console.log("Skipping repetitive speech fragment:", messageFragment);
          return prev; // Skip this fragment as it's a repetition
        }
        
        return prev;
      });
      
      setMessages((prev) => {
        if (prev.length === 0) {
          // If somehow there are no messages, create a new one
          return [{
            id: Date.now().toString(),
            sender: MessageSender.CLIENT,
            content: messageFragment,
          }];
        }
        
        // Update the last message with the new content
        // Add proper spacing between speech fragments
        const prevContent = prev[prev.length - 1].content;
        const needsSpace = prevContent.length > 0 && 
                          !prevContent.endsWith(" ") && 
                          !prevContent.endsWith(".") && 
                          !prevContent.endsWith("?") && 
                          !prevContent.endsWith("!");
        
        // If the previous content doesn't end with space or punctuation, add a space
        const separator = needsSpace ? " " : "";
        
        // Check if adding this fragment would create a repetition
        const potentialNewContent = prevContent + separator + messageFragment;
        const hasRepetition = /(.{10,})\s+\1/i.test(potentialNewContent);
        
        if (hasRepetition) {
          console.log("Detected repetition in combined message, using only the first part");
          return prev; // Keep the existing message without adding the repetitive part
        }
        
        return [
          ...prev.slice(0, -1),
          {
            ...prev[prev.length - 1],
            content: potentialNewContent,
          },
        ];
      });
    } else {
      // This is a new message from the user
      currentSenderRef.current = MessageSender.CLIENT;
      
      // Add the new message to the history
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: MessageSender.CLIENT,
          content: messageFragment,
        },
      ]);
      
      console.log("Added new user message to history:", messageFragment);
    }
  };

  const handleStreamingTalkingMessage = ({
    detail,
  }: {
    detail: StreamingTalkingMessageEvent;
  }) => {
    // Enhanced duplicate detection
    const now = Date.now();
    
    // Check for exact duplicates (same content within 2 seconds)
    const isExactDuplicate = lastMessageRef.current && 
                        lastMessageRef.current.content === detail.message && 
                        now - lastMessageRef.current.timestamp < 2000;
    
    if (isExactDuplicate) {
      console.log("Detected exact duplicate message, ignoring:", detail.message.substring(0, 30));
      return; // Skip adding duplicate messages
    }
    
    // Check for similar content (to prevent multiple "What is printform" type messages)
    const isSimilarContent = lastMessageRef.current && 
                            lastMessageRef.current.content.includes(detail.message) &&
                            now - lastMessageRef.current.timestamp < 3000;
                            
    if (isSimilarContent) {
      console.log("Detected similar content, ignoring:", detail.message.substring(0, 30));
      return; // Skip adding similar messages in quick succession
    }
    
    // Update the last message ref
    lastMessageRef.current = {
      content: detail.message,
      timestamp: now
    };
    
    // Clean up any repetitive phrases in the message
    let cleanedMessage = detail.message;
    
    // Check for repeated phrases like "What is printform What is printform"
    const repeatedPhraseRegex = /(.{5,}?)\s+\1(\s+\1)*/gi;
    if (repeatedPhraseRegex.test(cleanedMessage)) {
      cleanedMessage = cleanedMessage.replace(repeatedPhraseRegex, "$1");
      console.log("Cleaned up repetitive phrases:", 
        `Original: "${detail.message}" -> Cleaned: "${cleanedMessage}"`);
    }
    
    if (currentSenderRef.current === MessageSender.AVATAR) {
      setMessages((prev) => {
        if (prev.length === 0) {
          // If somehow there are no messages, create a new one
          return [{
            id: Date.now().toString(),
            sender: MessageSender.AVATAR,
            content: cleanedMessage,
          }];
        }
        
        return [
          ...prev.slice(0, -1),
          {
            ...prev[prev.length - 1],
            content: prev[prev.length - 1].content + cleanedMessage,
          },
        ];
      });
    } else {
      currentSenderRef.current = MessageSender.AVATAR;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: MessageSender.AVATAR,
          content: cleanedMessage,
        },
      ]);
    }
  };

  // Function to send a message to OpenAI and get a response
  const sendMessageToOpenAI = async (message: string) => {
    if (!message || message.trim() === '') return;
    
    try {
      console.log('Sending voice chat message to OpenAI API:', message);
      
      // Call the OpenAI API
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question: message,
          useRAG: true // Enable RAG by default
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', errorText);
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.error('Error from OpenAI API:', data.error);
        throw new Error(data.error);
      }
      
      // Use the AI response for the avatar to speak
      console.log('AI Response for voice chat:', data.answer);
      
      // Add a small delay to ensure the user's message is fully processed
      setTimeout(() => {
        // Add the AI response to the message history
        currentSenderRef.current = MessageSender.AVATAR;
        
        // Trigger the streaming talking message event
        const taskId = `avatar-${Date.now()}`;
        
        // Add AI message to the message history directly
        handleStreamingTalkingMessage({
          detail: {
            message: data.answer,
            type: StreamingEvents.AVATAR_TALKING_MESSAGE,
            task_id: taskId,
          },
        });
        
        // End AI message
        handleEndMessage({
          detail: {
            type: StreamingEvents.AVATAR_END_MESSAGE,
            task_id: taskId,
          },
        });
        
        // Speak the message through the avatar WITHOUT adding to message history again
        // This is the key fix - we're using the avatar's speak method directly
        // instead of going through sendMessage which would add the message again
        if (avatarRef.current) {
          avatarRef.current.speak({
            text: data.answer,
            taskType: TaskType.REPEAT,
            taskMode: TaskMode.ASYNC,
          });
        }
      }, 500);
      
    } catch (error) {
      console.error('Error sending voice chat message to OpenAI:', error);
      
      // Handle error by having the avatar speak an error message
      setTimeout(() => {
        // Add the error message to the message history
        currentSenderRef.current = MessageSender.AVATAR;
        
        // Trigger the streaming talking message event
        const taskId = `avatar-${Date.now()}`;
        const errorMessage = "Sorry, I couldn't connect to my AI brain. Please try again.";
        
        // Add error message to the message history directly
        handleStreamingTalkingMessage({
          detail: {
            message: errorMessage,
            type: StreamingEvents.AVATAR_TALKING_MESSAGE,
            task_id: taskId,
          },
        });
        
        // End error message
        handleEndMessage({
          detail: {
            type: StreamingEvents.AVATAR_END_MESSAGE,
            task_id: taskId,
          },
        });
        
        // Speak the error message through the avatar WITHOUT adding to message history again
        if (avatarRef.current) {
          avatarRef.current.speak({
            text: errorMessage,
            taskType: TaskType.REPEAT,
            taskMode: TaskMode.ASYNC,
          });
        }
      }, 500);
    }
  };

  const handleEndMessage = (event?: any) => {
    // When a message ends, clean up any potential issues with the last message
    if (currentSenderRef.current === MessageSender.CLIENT) {
      let finalUserMessage = '';
      
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.sender !== MessageSender.CLIENT) return prev;
        
        // Clean up the message content
        let cleanedContent = lastMessage.content;
        
        // Special case 1: Check for the exact pattern from the example
        // "tell me about printform.tell me about printform.tell me about printform..."
        if (cleanedContent.includes("tell me about printform")) {
          const exactPattern = /(tell me about printform)[.!?]?/gi;
          const matches = cleanedContent.match(exactPattern);
          if (matches && matches.length > 1) {
            console.log(`Found ${matches.length} instances of "tell me about printform"`);
            cleanedContent = "tell me about printform";
          }
        }
        
        // Special case 2: Check for the pattern "tell me about X" repeated multiple times
        // This is a common pattern with speech recognition issues
        const tellMeAboutRegex = /(tell me about [^.!?]+)[.!?]?\s*(tell me about)/gi;
        if (tellMeAboutRegex.test(cleanedContent)) {
          cleanedContent = cleanedContent.replace(tellMeAboutRegex, "$1. ");
        }
        
        // 1. Fix repeated phrases without spaces (e.g., "tell me about printform.tell me about printform")
        const repeatedPhraseRegex = /(.{10,}?)[.!?]\s*\1/g;
        while (repeatedPhraseRegex.test(cleanedContent)) {
          cleanedContent = cleanedContent.replace(repeatedPhraseRegex, "$1.");
        }
        
        // 2. Add proper sentence spacing
        cleanedContent = cleanedContent.replace(/([.!?])\s*([A-Za-z])/g, "$1 $2");
        
        // 3. Remove excessive punctuation
        cleanedContent = cleanedContent.replace(/([.!?]){2,}/g, "$1");
        
        // 4. Check for the entire message being repeated multiple times
        // This can happen with longer speech recognition sessions
        if (cleanedContent.length > 20) {
          const words = cleanedContent.split(/\s+/);
          if (words.length >= 8) {
            // Try to find if the entire message is just a repetition of the first half
            const halfLength = Math.floor(words.length / 2);
            const firstHalf = words.slice(0, halfLength).join(' ');
            const secondHalf = words.slice(halfLength).join(' ');
            
            // If the second half starts with the same content as the first half
            if (secondHalf.startsWith(firstHalf.substring(0, Math.min(firstHalf.length, 20)))) {
              console.log("Detected entire message repetition");
              cleanedContent = firstHalf;
            }
          }
        }
        
        // Store the final cleaned message for sending to OpenAI
        finalUserMessage = cleanedContent;
        
        // 5. If content is unchanged, return the original messages
        if (cleanedContent === lastMessage.content) {
          finalUserMessage = lastMessage.content;
          return prev;
        }
        
        console.log("Cleaned up user message:", 
          `Original: "${lastMessage.content}" -> Cleaned: "${cleanedContent}"`);
        
        // Return messages with the cleaned content
        return [
          ...prev.slice(0, -1),
          {
            ...lastMessage,
            content: cleanedContent,
          },
        ];
      });
      
      // Check if this is a USER_END_MESSAGE event from voice chat
      if (event?.detail?.type === StreamingEvents.USER_END_MESSAGE && finalUserMessage) {
        console.log("Voice chat message ended, sending to OpenAI:", finalUserMessage);
        
        // Send the message to OpenAI
        sendMessageToOpenAI(finalUserMessage);
      }
    }
    
    // Reset the current sender
    currentSenderRef.current = null;
  };

  return {
    messages,
    clearMessages: () => {
      setMessages([]);
      currentSenderRef.current = null;
      lastMessageRef.current = null; // Also reset the last message ref
    },
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
  };
};

const useStreamingAvatarListeningState = () => {
  const [isListening, setIsListening] = useState(false);

  return { isListening, setIsListening };
};

const useStreamingAvatarTalkingState = () => {
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);

  return {
    isUserTalking,
    setIsUserTalking,
    isAvatarTalking,
    setIsAvatarTalking,
  };
};

const useStreamingAvatarConnectionQualityState = () => {
  const [connectionQuality, setConnectionQuality] = useState(
    ConnectionQuality.UNKNOWN,
  );

  return { connectionQuality, setConnectionQuality };
};

export const StreamingAvatarProvider = ({
  children,
  basePath,
}: {
  children: React.ReactNode;
  basePath?: string;
}) => {
  const avatarRef = React.useRef<StreamingAvatar>(null);
  const voiceChatState = useStreamingAvatarVoiceChatState();
  const sessionState = useStreamingAvatarSessionState();
  const messageState = useStreamingAvatarMessageState(avatarRef);
  const listeningState = useStreamingAvatarListeningState();
  const talkingState = useStreamingAvatarTalkingState();
  const connectionQualityState = useStreamingAvatarConnectionQualityState();

  return (
    <StreamingAvatarContext.Provider
      value={{
        avatarRef,
        basePath,
        ...voiceChatState,
        ...sessionState,
        ...messageState,
        ...listeningState,
        ...talkingState,
        ...connectionQualityState,
      }}
    >
      {children}
    </StreamingAvatarContext.Provider>
  );
};

export const useStreamingAvatarContext = () => {
  return React.useContext(StreamingAvatarContext);
};
