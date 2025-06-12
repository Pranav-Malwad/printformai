import StreamingAvatar, {
  ConnectionQuality,
  StartAvatarRequest,
  StreamingEvents,
} from "@heygen/streaming-avatar";
import { useCallback } from "react";

import {
  StreamingAvatarSessionState,
  useStreamingAvatarContext,
} from "./context";
import { useVoiceChat } from "./useVoiceChat";
import { useMessageHistory } from "./useMessageHistory";

export const useStreamingAvatarSession = () => {
  const {
    avatarRef,
    basePath,
    sessionState,
    setSessionState,
    stream,
    setStream,
    setIsListening,
    setIsUserTalking,
    setIsAvatarTalking,
    setConnectionQuality,
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
    clearMessages,
  } = useStreamingAvatarContext();
  const { stopVoiceChat } = useVoiceChat();

  useMessageHistory();

  const init = useCallback(
    (token: string) => {
      avatarRef.current = new StreamingAvatar({
        token,
        basePath: basePath,
      });

      return avatarRef.current;
    },
    [basePath, avatarRef],
  );

  const handleStream = useCallback(
    ({ detail }: { detail: MediaStream }) => {
      setStream(detail);
      setSessionState(StreamingAvatarSessionState.CONNECTED);
    },
    [setSessionState, setStream],
  );

  const stop = useCallback(async () => {
    try {
      // Remove event listeners
      if (avatarRef.current) {
        avatarRef.current.off(StreamingEvents.STREAM_READY, handleStream);
        avatarRef.current.off(StreamingEvents.STREAM_DISCONNECTED, stop);
      }
      
      // Clear UI state
      clearMessages();
      stopVoiceChat();
      setIsListening(false);
      setIsUserTalking(false);
      setIsAvatarTalking(false);
      setStream(null);
      
      // Stop the avatar
      if (avatarRef.current) {
        try {
          await avatarRef.current.stopAvatar();
        } catch (stopError) {
          console.warn("Error stopping avatar, continuing cleanup:", stopError);
          // Continue with cleanup even if stopping fails
        }
      }
    } catch (error) {
      console.error("Error during avatar session cleanup:", error);
    } finally {
      // Always set the session state to inactive, even if there were errors
      setSessionState(StreamingAvatarSessionState.INACTIVE);
    }
  }, [
    handleStream,
    setSessionState,
    setStream,
    avatarRef,
    setIsListening,
    stopVoiceChat,
    clearMessages,
    setIsUserTalking,
    setIsAvatarTalking,
  ]);

  const start = useCallback(
    async (config: StartAvatarRequest, token?: string) => {
      if (sessionState !== StreamingAvatarSessionState.INACTIVE) {
        throw new Error("There is already an active session");
      }

      if (!avatarRef.current) {
        if (!token) {
          throw new Error("Token is required");
        }
        init(token);
      }

      if (!avatarRef.current) {
        throw new Error("Avatar is not initialized");
      }

      setSessionState(StreamingAvatarSessionState.CONNECTING);
      avatarRef.current.on(StreamingEvents.STREAM_READY, handleStream);
      avatarRef.current.on(StreamingEvents.STREAM_DISCONNECTED, stop);
      avatarRef.current.on(
        StreamingEvents.CONNECTION_QUALITY_CHANGED,
        ({ detail }: { detail: ConnectionQuality }) =>
          setConnectionQuality(detail),
      );
      
      // Enhanced error handling for WebRTC data channel errors and other issues
      avatarRef.current.on("error", (event: any) => {
        // Completely suppress DataChannel errors as they're not affecting functionality
        if (event?.detail?.message && (
            event.detail.message.includes("DataChannel") || 
            event.detail.message.includes("Unknown DataChannel error") ||
            (event.detail.status === 400 && event.detail.url && event.detail.url.includes("stop_listening"))
        )) {
          // Don't log these errors at all - they're expected and don't affect functionality
          return;
        } else {
          console.error("Critical avatar error in session:", event?.detail);
        }
      });
      
      // Set up minimal avatar talking events - only what's needed for the avatar to speak
      avatarRef.current.on(StreamingEvents.AVATAR_START_TALKING, () => {
        console.log("Avatar started talking");
        setIsAvatarTalking(true);
      });
      
      avatarRef.current.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        console.log("Avatar stopped talking");
        setIsAvatarTalking(false);
      });
      
      // Set up avatar talking message events to capture avatar responses
      avatarRef.current.on(
        StreamingEvents.AVATAR_TALKING_MESSAGE,
        handleStreamingTalkingMessage
      );
      
      // Set up minimal avatar message events
      avatarRef.current.on(
        StreamingEvents.AVATAR_END_MESSAGE,
        handleEndMessage
      );
      
      // Only set up voice chat events if needed
      if (config.voiceChatTransport) {
        console.log("Setting up voice chat events with message handling");
        avatarRef.current.on(StreamingEvents.USER_START, () => {
          setIsUserTalking(true);
        });
        
        avatarRef.current.on(StreamingEvents.USER_STOP, () => {
          setIsUserTalking(false);
        });
        
        // Add event listener for user voice messages
        avatarRef.current.on(
          StreamingEvents.USER_TALKING_MESSAGE,
          handleUserTalkingMessage
        );
        
        // Add event listener for user message end
        avatarRef.current.on(
          StreamingEvents.USER_END_MESSAGE,
          handleEndMessage
        );
        
        // Set listening state when voice chat is active
        setIsListening(true);
      }

      await avatarRef.current.createStartAvatar(config);

      return avatarRef.current;
    },
    [
      init,
      handleStream,
      stop,
      setSessionState,
      avatarRef,
      sessionState,
      setConnectionQuality,
      setIsUserTalking,
      handleUserTalkingMessage,
      handleStreamingTalkingMessage,
      handleEndMessage,
      setIsAvatarTalking,
      setIsListening, // Add setIsListening to the dependency array
    ],
  );

  // Log the current state for debugging
  console.log("Current session state:", {
    sessionState,
    isListening: useStreamingAvatarContext().isListening,
    isVoiceChatActive: useStreamingAvatarContext().isVoiceChatActive,
  });
  
  return {
    avatarRef,
    sessionState,
    stream,
    initAvatar: init,
    startAvatar: start,
    stopAvatar: stop,
  };
};
