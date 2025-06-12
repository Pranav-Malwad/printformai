import { TaskMode, TaskType, StreamingEvents } from "@heygen/streaming-avatar";
import { useCallback } from "react";

import { useStreamingAvatarContext } from "./context";
import { MessageSender } from "./context";

export const useTextChat = () => {
  const { avatarRef, messages, handleStreamingTalkingMessage, handleEndMessage } = useStreamingAvatarContext();

  const sendMessage = useCallback(
    (message: string) => {
      if (!avatarRef.current) return;
      console.log("Avatar speaking:", message);
      
      // Manually trigger the streaming talking message event to update the UI
      handleStreamingTalkingMessage({
        detail: {
          message: message,
          isFinal: true,
          type: StreamingEvents.AVATAR_TALKING_MESSAGE,
          task_id: `avatar-${Date.now()}`
        }
      });
      
      // Speak the message through the avatar
      // Try with REPEAT task type which might be more reliable for simple messages
      avatarRef.current.speak({
        text: message,
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.ASYNC,
      });
      
      // Trigger the end message event to reset the current sender
      setTimeout(() => {
        handleEndMessage({
          detail: {
            type: StreamingEvents.AVATAR_END_MESSAGE,
            task_id: `avatar-${Date.now()}`
          }
        });
      }, 100);
    },
    [avatarRef, handleStreamingTalkingMessage, handleEndMessage],
  );

  const sendMessageSync = useCallback(
    async (message: string) => {
      if (!avatarRef.current) return;
      console.log("Avatar speaking sync:", message);
      
      // Manually trigger the streaming talking message event to update the UI
      handleStreamingTalkingMessage({
        detail: {
          message: message,
          isFinal: true,
          type: StreamingEvents.AVATAR_TALKING_MESSAGE,
          task_id: `avatar-${Date.now()}`
        }
      });
      
      // Speak the message through the avatar
      const result = await avatarRef.current?.speak({
        text: message,
        taskType: TaskType.TALK,
        taskMode: TaskMode.SYNC,
      });
      
      // Trigger the end message event to reset the current sender
      handleEndMessage({
        detail: {
          type: StreamingEvents.AVATAR_END_MESSAGE,
          task_id: `avatar-${Date.now()}`
        }
      });
      
      return result;
    },
    [avatarRef, handleStreamingTalkingMessage, handleEndMessage],
  );

  const repeatMessage = useCallback(
    (message: string, skipMessageHistory = false) => {
      if (!avatarRef.current) return;
      console.log("Avatar repeating:", message);
      
      // Only add to message history if not skipped
      if (!skipMessageHistory) {
        // Manually trigger the streaming talking message event to update the UI
        handleStreamingTalkingMessage({
          detail: {
            message: message,
            isFinal: true,
            type: StreamingEvents.AVATAR_TALKING_MESSAGE,
            task_id: `avatar-${Date.now()}`
          }
        });
        
        // Trigger the end message event to reset the current sender
        setTimeout(() => {
          handleEndMessage({
            detail: {
              type: StreamingEvents.AVATAR_END_MESSAGE,
              task_id: `avatar-${Date.now()}`
            }
          });
        }, 100);
      }
      
      // Speak the message through the avatar
      const result = avatarRef.current?.speak({
        text: message,
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.ASYNC,
      });
      
      return result;
    },
    [avatarRef, handleStreamingTalkingMessage, handleEndMessage],
  );

  const repeatMessageSync = useCallback(
    async (message: string, skipMessageHistory = false) => {
      if (!avatarRef.current) return;
      console.log("Avatar repeating sync:", message);
      
      // Only add to message history if not skipped
      if (!skipMessageHistory) {
        // Manually trigger the streaming talking message event to update the UI
        handleStreamingTalkingMessage({
          detail: {
            message: message,
            isFinal: true,
            type: StreamingEvents.AVATAR_TALKING_MESSAGE,
            task_id: `avatar-${Date.now()}`
          }
        });
      }
      
      // Speak the message through the avatar
      const result = await avatarRef.current?.speak({
        text: message,
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.SYNC,
      });
      
      // Only trigger end message if we added to history
      if (!skipMessageHistory) {
        // Trigger the end message event to reset the current sender
        handleEndMessage({
          detail: {
            type: StreamingEvents.AVATAR_END_MESSAGE,
            task_id: `avatar-${Date.now()}`
          }
        });
      }
      
      return result;
    },
    [avatarRef, handleStreamingTalkingMessage, handleEndMessage],
  );

  return {
    sendMessage,
    sendMessageSync,
    repeatMessage,
    repeatMessageSync,
  };
};
