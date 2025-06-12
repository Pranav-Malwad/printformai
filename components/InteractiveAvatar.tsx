import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  ElevenLabsModel,
  TaskType,
  TaskMode,
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { Button } from "./Button";
import { AvatarConfig } from "./AvatarConfig";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { useVoiceChat } from "./logic/useVoiceChat";
import { useTextChat } from "./logic/useTextChat";
import { StreamingAvatarProvider, StreamingAvatarSessionState, useStreamingAvatarContext } from "./logic";
import { LoadingIcon } from "./Icons";
import ErrorBoundary from "./ErrorBoundary";
import { MessageHistory } from "./AvatarSession/MessageHistory";

import { AVATARS } from "@/app/lib/constants";

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.Low,
  avatarName: AVATARS[0].avatar_id,
  knowledgeId: undefined,
  voice: {
    rate: 1.5,
    emotion: VoiceEmotion.EXCITED,
    model: ElevenLabsModel.eleven_flash_v2_5,
  },
  language: "en",
  voiceChatTransport: VoiceChatTransport.WEBSOCKET,
  sttSettings: {
    provider: STTProvider.DEEPGRAM,
  },
};

function InteractiveAvatar() {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
    useStreamingAvatarSession();
  const { setSessionState } = useStreamingAvatarContext();
  const { startVoiceChat } = useVoiceChat();
  const { sendMessage, repeatMessage } = useTextChat(); // Get the sendMessage and repeatMessage functions from useTextChat hook

  const [config, setConfig] = useState<StartAvatarRequest>(DEFAULT_CONFIG);

  const mediaStream = useRef<HTMLVideoElement>(null);

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      console.log("Access Token:", token); // Log the token to verify

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      throw error;
    }
  }

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    try {
      console.log("Starting avatar session with voice chat:", isVoiceChat);
      const newToken = await fetchAccessToken();
      const avatar = initAvatar(newToken);

      // Set up minimal event listeners - only what's needed
      avatar.on(StreamingEvents.STREAM_READY, () => {
        console.log("Avatar stream is ready");
      });
      
      // Enhanced error handling for all types of errors
      avatar.on("error", (event: any) => {
        // Completely suppress DataChannel errors as they're not affecting functionality
        if (event?.detail?.message && (
            event.detail.message.includes("DataChannel") || 
            event.detail.message.includes("Unknown DataChannel error") ||
            (event.detail.status === 400 && event.detail.url && event.detail.url.includes("stop_listening"))
        )) {
          // Don't log these errors at all - they're expected and don't affect functionality
          return;
        } else {
          console.error("Avatar error:", event?.detail);
        }
      });

      // Configure the session
      const sessionConfig = {...config};
      if (!isVoiceChat) {
        // Disable speech-to-text for text chat mode
        sessionConfig.sttSettings = undefined;
      }

      // Start the avatar
      await startAvatar(sessionConfig);

      // Start voice chat if needed
      if (isVoiceChat) {
        console.log("Initializing voice chat mode");
        try {
          // Start voice chat with microphone unmuted
          await startVoiceChat(false);
          console.log("Voice chat initialized successfully");
        } catch (voiceChatError) {
          console.error("Error initializing voice chat:", voiceChatError);
        }
      }
      
      console.log("Avatar session started successfully");
      
      // Get the actual avatar name from the selected avatar
      const selectedAvatar = AVATARS.find(avatar => avatar.avatar_id === config.avatarName);
      const avatarName = selectedAvatar ? selectedAvatar.name : "Assistant";
      
      // Define the greeting message with the actual avatar name
      const greetingMessage = `Hello! My name is ${avatarName}. I'm a PrintForm AI agent here to assist you. How can I help you today?`;
      
      // Try to speak directly using the avatar reference - this is our primary approach
      try {
        console.log("Attempting direct speak method...");
        
        // Direct call to speak method as soon as the session is ready
        avatar.speak({
          text: greetingMessage,
          taskType: TaskType.REPEAT,
          taskMode: TaskMode.ASYNC,
        });
        
        // Set a flag in sessionStorage to indicate we've already greeted the user
        sessionStorage.setItem('greetingAttempted', 'true');
        console.log("Direct greeting method executed successfully");
      } catch (speakError) {
        console.warn("Error with direct speak method:", speakError);
        
        // Only use the setTimeout approach if the direct method fails
        setTimeout(() => {
          // Check if we've already attempted a greeting
          if (sessionStorage.getItem('greetingAttempted') !== 'true') {
            console.log("Attempting to send greeting message via sendMessage...");
            sendMessage(greetingMessage);
            sessionStorage.setItem('greetingAttempted', 'true');
          }
        }, 2000);
      }
    } catch (error) {
      console.error("Error starting avatar session:", error);
      
      // Show a user-friendly error message
      alert("There was an error starting the avatar session. Please try again.");
      
      // Reset the session state to inactive so the user can try again
      setSessionState(StreamingAvatarSessionState.INACTIVE);
    }
  });

  useUnmount(() => {
    // Clear the greeting flag when unmounting
    sessionStorage.removeItem('greetingAttempted');
    handleStopAvatar();
  });
  
  // Reset greeting flag when stopping the avatar
  const handleStopAvatar = () => {
    console.log("Stopping avatar and clearing greeting flag");
    sessionStorage.removeItem('greetingAttempted');
    stopAvatar();
  };
  
  // Share the handleStopAvatar function with child components
  useEffect(() => {
    // Set a global function that can be called from other components
    window.handleAvatarStop = handleStopAvatar;
    
    // Clean up when unmounting
    return () => {
      delete window.handleAvatarStop;
    };
  }, []);

  // Add global error handler to suppress DataChannel errors
  useEffect(() => {
    // Store the original console.error
    const originalConsoleError = console.error;
    
    // Override console.error to filter out DataChannel errors
    console.error = function(...args) {
      // Check if this is a DataChannel error
      const errorString = args.join(' ');
      if (errorString.includes('Unknown DataChannel error') || 
          errorString.includes('DataChannel')) {
        // Suppress the error
        return;
      }
      
      // Pass through all other errors to the original console.error
      originalConsoleError.apply(console, args);
    };
    
    // Restore original on cleanup
    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
      };
    }
  }, [mediaStream, stream]);
  
  // Add an effect to ensure the greeting is spoken when the session is connected
  // but only as a fallback if previous attempts failed
  useEffect(() => {
    // Only run this when the session state changes to CONNECTED
    if (sessionState === StreamingAvatarSessionState.CONNECTED) {
      // Create a function to attempt the greeting only if not already done
      const attemptGreeting = () => {
        // Check if we've already attempted a greeting
        if (sessionStorage.getItem('greetingAttempted') !== 'true') {
          // Get the actual avatar name from the selected avatar
          const selectedAvatar = AVATARS.find(avatar => avatar.avatar_id === config.avatarName);
          const avatarName = selectedAvatar ? selectedAvatar.name : "Assistant";
          
          // Define the greeting message with the actual avatar name
          const greetingMessage = `Hello! My name is ${avatarName}. I'm a PrintForm AI agent here to assist you. How can I help you today?`;
          console.log("Attempting greeting from useEffect as final fallback...");
          
          // Try repeatMessage as a last resort
          try {
            repeatMessage(greetingMessage);
            sessionStorage.setItem('greetingAttempted', 'true');
          } catch (error) {
            console.warn("Error with repeatMessage, trying sendMessage:", error);
            try {
              // Fall back to sendMessage
              sendMessage(greetingMessage);
              sessionStorage.setItem('greetingAttempted', 'true');
            } catch (sendError) {
              console.warn("Error with sendMessage:", sendError);
            }
          }
        } else {
          console.log("Greeting already attempted, skipping useEffect greeting");
        }
      };
      
      // Wait a bit longer for the session to be fully ready (after other attempts)
      const greetingTimer = setTimeout(attemptGreeting, 3000);
      
      // Clean up the timer if the component unmounts
      return () => clearTimeout(greetingTimer);
    }
  }, [sessionState, sendMessage, repeatMessage]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col rounded-xl bg-zinc-900 overflow-hidden">
        <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
          {sessionState !== StreamingAvatarSessionState.INACTIVE ? (
            <AvatarVideo ref={mediaStream} />
          ) : (
            <AvatarConfig config={config} onConfigChange={setConfig} />
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full">
          {sessionState === StreamingAvatarSessionState.CONNECTED ? (
            <AvatarControls />
          ) : sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <div className="flex flex-row gap-4">
              <Button onClick={() => startSessionV2(true)}>
                Start Voice Chat
              </Button>
              <Button onClick={() => startSessionV2(false)}>
                Start Text Chat
              </Button>
            </div>
          ) : (
            <LoadingIcon />
          )}
        </div>
      </div>
      {sessionState === StreamingAvatarSessionState.CONNECTED && (
        <MessageHistory />
      )}
    </div>
  );
}

export default function InteractiveAvatarWrapper() {
  return (
    <ErrorBoundary>
      <StreamingAvatarProvider basePath={process.env.NEXT_PUBLIC_BASE_API_URL}>
        <InteractiveAvatar />
      </StreamingAvatarProvider>
    </ErrorBoundary>
  );
}
