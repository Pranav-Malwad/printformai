import { useCallback } from "react";

import { useStreamingAvatarContext } from "./context";

export const useConversationState = () => {
  const { avatarRef, isAvatarTalking, isUserTalking, isListening } =
    useStreamingAvatarContext();

  const startListening = useCallback(() => {
    if (!avatarRef.current) return;
    try {
      // Wrap in a promise to handle both synchronous and asynchronous errors
      Promise.resolve(avatarRef.current.startListening())
        .catch(error => {
          // Handle any promise rejection
          console.warn("Error starting listening, this is usually not critical:", error);
          // Continue execution, as this error is not critical
        });
    } catch (error) {
      // This catches synchronous errors
      console.warn("Error starting listening, this is usually not critical:", error);
      // Continue execution, as this error is not critical
    }
  }, [avatarRef]);

  const stopListening = useCallback(() => {
    if (!avatarRef.current) return;
    try {
      // Wrap in a promise to handle both synchronous and asynchronous errors
      Promise.resolve(avatarRef.current.stopListening())
        .catch(error => {
          // Check if this is the known 400 error for stop_listening
          if (error?.status === 400 && error?.url?.includes("stop_listening")) {
            // Silently ignore this specific error - it's expected and doesn't affect functionality
            return;
          }
          console.warn("Error stopping listening, this is usually not critical:", error);
          // Continue execution, as this error is not critical
        });
    } catch (error) {
      // This catches synchronous errors
      console.warn("Error stopping listening, this is usually not critical:", error);
      // Continue execution, as this error is not critical
    }
  }, [avatarRef]);

  return {
    isAvatarListening: isListening,
    startListening,
    stopListening,
    isUserTalking,
    isAvatarTalking,
  };
};
