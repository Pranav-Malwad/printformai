import { TaskType, TaskMode, StreamingEvents } from "@heygen/streaming-avatar";
import React, { useCallback, useEffect, useState } from "react";
import { usePrevious } from "ahooks";

import { Select } from "../Select";
import { Button } from "../Button";
import { SendIcon, LoadingIcon } from "../Icons";
import { useTextChat } from "../logic/useTextChat";
import { Input } from "../Input";
import { useConversationState } from "../logic/useConversationState";
import { MessageSender, useStreamingAvatarContext } from "../logic/context";
import { containsCommand, processUserMessage } from "@/app/utils/commandPrompting";
import { cleanRepetitiveText } from "@/app/utils/textUtils";

export const TextInput: React.FC = () => {
  const { sendMessage, sendMessageSync, repeatMessage, repeatMessageSync } =
    useTextChat();
  const { startListening, stopListening } = useConversationState();
  const { messages, handleUserTalkingMessage, handleStreamingTalkingMessage, handleEndMessage } = useStreamingAvatarContext();
  
  // Log the current messages for debugging
  useEffect(() => {
    console.log("Current messages count:", messages.length);
  }, [messages.length]);
  const [taskType, setTaskType] = useState<TaskType>(TaskType.TALK);
  const [taskMode, setTaskMode] = useState<TaskMode>(TaskMode.ASYNC);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Always use OpenAI Assistant by default and hide the option
  const [useAI] = useState(true);
  // Show debug by default but hide the option
  const [showDebug] = useState(true);
  // Hide commands by default and hide the option
  const [showCommands] = useState(false);
  const [debugResponse, setDebugResponse] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Store the thread ID for conversation continuity
  const [threadId, setThreadId] = useState<string | null>(null);

  // Helper function to add messages to the conversation history
  const addUserMessage = useCallback((text: string) => {
    const taskId = `user-${Date.now()}`;
    
    // Add user message
    handleUserTalkingMessage({
      detail: {
        message: text,
        type: StreamingEvents.USER_TALKING_MESSAGE,
        task_id: taskId,
      },
    });
    
    // End user message
    handleEndMessage({
      detail: {
        type: StreamingEvents.USER_END_MESSAGE,
        task_id: taskId,
      },
    });
  }, [handleUserTalkingMessage, handleEndMessage]);

  const addAIMessage = useCallback((text: string) => {
    const taskId = `avatar-${Date.now()}`;
    
    // Add AI message
    handleStreamingTalkingMessage({
      detail: {
        message: text,
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
  }, [handleStreamingTalkingMessage, handleEndMessage]);

  const handleSend = useCallback(async () => {
    if (message.trim() === "") {
      return;
    }

    // Clean up any repetitive text in the message
    const cleanedMessage = cleanRepetitiveText(message);
    
    // Log if message was cleaned
    if (cleanedMessage !== message) {
      console.log("Cleaned repetitive text in message:", 
        `Original (${message.length} chars) -> Cleaned (${cleanedMessage.length} chars)`);
      
      // If the message was significantly shortened, add a notification
      if (message.length > cleanedMessage.length * 2) {
        // Add a small delay to ensure this message appears after the user's message
        setTimeout(() => {
          addAIMessage("I noticed your message contained repetitive text, so I've simplified it to process your request more effectively.");
        }, 500);
      }
    }
    
    setIsLoading(true);
    
    try {
      // Add user message to conversation history - use the original message for display
      addUserMessage(message);
      
      // Check if the message is a command
      if (containsCommand(cleanedMessage)) {
        try {
          // Process the command
          const commandResponse = await processUserMessage(cleanedMessage);
          
          if (commandResponse) {
            // Store the response for debugging
            setDebugResponse(commandResponse);
            
            // Just speak the message and let the SDK events handle adding it to history
            if (taskMode === TaskMode.SYNC) {
              await repeatMessageSync(commandResponse, true);
            } else {
              repeatMessage(commandResponse, true);
            }
            
            // Add a small delay before adding the message to history to avoid race conditions
            setTimeout(() => {
              // Check if the message was added by the SDK events
              const messageExists = messages.some(msg => 
                msg.sender === MessageSender.AVATAR && 
                msg.content === commandResponse
              );
              
              // If not, add it manually
              if (!messageExists) {
                console.log("Command response not added by SDK events, adding manually");
                addAIMessage(commandResponse);
              }
            }, 500);
            
            setIsLoading(false);
            setMessage("");
            return;
          }
        } catch (commandError) {
          console.error('Error processing command:', commandError);
          // Continue with normal processing if command fails
        }
      }
      
      if (useAI) {
        try {
          // Get response from OpenAI Assistant API
          console.log('Sending request to OpenAI API with thread ID:', threadId);
          const response = await fetch('/api/openai', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              question: cleanedMessage,
              useRAG: true, // Enable RAG by default
              threadId: threadId // Pass the thread ID if we have one
            }),
          });
          
          // Clear any previous error
          setErrorMessage(null);
          
          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              errorData = { error: errorText };
            }
            
            console.error('API error:', errorData);
            console.error('API response status:', response.status);
            console.error('API response headers:', Object.fromEntries([...response.headers.entries()]));
            
            // For Netlify 502 errors, try the fallback API
            if (response.status === 502) {
              console.error('Netlify 502 Bad Gateway error detected, trying fallback API');
              
              try {
                // Try the fallback API
                const fallbackResponse = await fetch('/api/openai/fallback', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ 
                    question: cleanedMessage
                  }),
                });
                
                if (fallbackResponse.ok) {
                  const fallbackData = await fallbackResponse.json();
                  console.log('Fallback API succeeded:', fallbackData);
                  
                  // Return the fallback data to be processed
                  return fallbackData;
                } else {
                  console.error('Fallback API also failed:', await fallbackResponse.text());
                }
              } catch (fallbackError) {
                console.error('Error calling fallback API:', fallbackError);
              }
              
              // If fallback also failed, throw the original error
              throw new Error('The server encountered a temporary error (502 Bad Gateway). This typically happens when the request takes too long to process. Please try again with a shorter question.');
            }
            
            throw new Error(errorData.error || `API returned status ${response.status}`);
          }
          
          // Get the data from the response or use the fallback data if it was returned
          const data = await response.json();
          
          // Check if this is fallback data returned from the 502 error handler
          const isFallbackData = data.fallback === true;
          
          if (data.error && !isFallbackData) {
            console.error('Error from OpenAI API:', data.error);
            
            // Store the error message for display
            setErrorMessage(data.error);
            
            // If reset is required, reset the conversation
            if (data.resetRequired) {
              console.log('Reset required, will reset conversation on next message');
            }
            
            throw new Error(data.error);
          }
          
          // If this is fallback data, log it
          if (isFallbackData) {
            console.log('Using fallback response data');
          } 
          
          // Use the AI response for the avatar to speak
          console.log('AI Response:', data.answer);
          
          // Store the thread ID for future requests
          if (data.threadId) {
            console.log('Storing thread ID for conversation continuity:', data.threadId);
            setThreadId(data.threadId);
          }
          
          // Store the response for debugging
          setDebugResponse(data.answer);
          
          // Always use REPEAT task type for AI responses to ensure the avatar speaks exactly what the AI said
          try {
            console.log(`Avatar speaking AI response (${data.answer.length} chars) using ${TaskType.REPEAT} mode`);
            
            // We have two options:
            // 1. Add the message to history and then speak it with skipMessageHistory=true
            // 2. Speak it without adding to history and let the SDK events handle it
            
            // First add the message to the history
            addAIMessage(data.answer);
            
            // Then make the avatar speak it
            console.log("Making avatar speak the response");
            
            // Add a small delay to ensure the message is added to history first
            setTimeout(() => {
              try {
                // Use REPEAT task type to ensure exact wording
                if (taskMode === TaskMode.SYNC) {
                  repeatMessageSync(data.answer, true)
                    .catch(err => console.error("Error in repeatMessageSync:", err));
                } else {
                  repeatMessage(data.answer, true);
                }
                console.log("Avatar speaking command sent successfully");
              } catch (speakError) {
                console.error("Error making avatar speak:", speakError);
              }
            }, 300);
          } catch (speechError) {
            console.error("Error making avatar speak:", speechError);
            // If there's an error with the avatar speaking, manually add the message to the UI
            addAIMessage("I'm having trouble speaking right now, but here's my response: " + data.answer);
          }
        } catch (apiError: any) {
          console.error('Error with OpenAI API:', apiError);
          
          // Set error message if not already set
          if (!errorMessage) {
            setErrorMessage(apiError.message || "An error occurred with the AI service");
          }
          
          // Create a user-friendly error message
          let userErrorMessage = "Sorry, I couldn't connect to my AI brain.";
          
          if (apiError.message?.includes("timed out") || apiError.message?.includes("timeout")) {
            userErrorMessage = "Sorry, the AI service is taking too long to respond. Please try again with a simpler question or try again later.";
          } else if (apiError.message?.includes("rate limit")) {
            userErrorMessage = "Sorry, the AI service is currently experiencing high demand. Please try again in a few minutes.";
          }
          
          // First add the error message to the history
          addAIMessage(userErrorMessage);
          
          // Then make the avatar speak it
          console.log("Making avatar speak the error message");
          
          try {
            // Add a small delay to ensure the message is added to history first
            setTimeout(() => {
              try {
                // Use REPEAT task type to ensure exact wording
                if (taskMode === TaskMode.SYNC) {
                  repeatMessageSync(userErrorMessage, true)
                    .catch(err => console.error("Error in repeatMessageSync:", err));
                } else {
                  repeatMessage(userErrorMessage, true);
                }
                console.log("Avatar speaking error message sent successfully");
              } catch (speakError) {
                console.error("Error making avatar speak error message:", speakError);
              }
            }, 300);
          } catch (speechError) {
            console.error("Error making avatar speak error message:", speechError);
            // If speaking fails, add the message directly
            const fallbackErrorMessage = "Sorry, I'm having trouble responding right now. Please try again.";
            addAIMessage(fallbackErrorMessage);
          }
        }
      } else {
        // Use regular message without AI
        if (taskType === TaskType.TALK) {
          taskMode === TaskMode.SYNC
            ? await sendMessageSync(cleanedMessage)
            : sendMessage(cleanedMessage);
        } else {
          taskMode === TaskMode.SYNC
            ? await repeatMessageSync(cleanedMessage)
            : repeatMessage(cleanedMessage);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
      setMessage("");
    }
  }, [
    taskType,
    taskMode,
    message,
    sendMessage,
    sendMessageSync,
    repeatMessage,
    repeatMessageSync,
    useAI,
    addUserMessage,
    addAIMessage,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !isLoading) {
        handleSend();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSend, isLoading]);

  const previousText = usePrevious(message);

  useEffect(() => {
    // Only attempt to control listening state if the avatar is active
    // This prevents errors when the avatar is not fully initialized
    try {
      if (!previousText && message) {
        // User started typing, try to start listening
        startListening();
      } else if (previousText && !message) {
        // User cleared input, try to stop listening
        stopListening();
      }
    } catch (error) {
      console.warn("Error managing listening state:", error);
      // Non-critical error, continue execution
    }
  }, [message, previousText, startListening, stopListening]);

  // Function to reset the conversation thread
  const resetConversation = useCallback(async () => {
    if (!useAI) return;
    
    setIsLoading(true);
    // Clear any previous error
    setErrorMessage(null);
    // Clear the thread ID to start a new conversation
    setThreadId(null);
    
    try {
      console.log('Resetting conversation thread...');
      // Call the API to reset the thread
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question: "Hello, let's start a new conversation.", 
          resetThread: true 
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }
        
        console.error('API error during reset:', errorData);
        throw new Error(errorData.error || `API returned status ${response.status}`);
      }
      
      const resetMessage = "Conversation has been reset. How can I help you?";
      
      // Make the avatar speak the reset message and let the SDK events handle adding it to history
      try {
        repeatMessage(resetMessage, true);
        
        // Add a small delay before adding the message to history to avoid race conditions
        setTimeout(() => {
          // Check if the message was added by the SDK events
          const messageExists = messages.some(msg => 
            msg.sender === MessageSender.AVATAR && 
            msg.content === resetMessage
          );
          
          // If not, add it manually
          if (!messageExists) {
            console.log("Reset message not added by SDK events, adding manually");
            addAIMessage(resetMessage);
          }
        }, 500);
      } catch (speechError) {
        console.error("Error making avatar speak reset message:", speechError);
        // If speaking fails, add the message directly
        addAIMessage(resetMessage);
      }
      
    } catch (error: any) {
      console.error('Error resetting conversation:', error);
      
      // Set error message
      setErrorMessage(error.message || "Failed to reset conversation");
      
      const errorResetMessage = "Sorry, I couldn't reset our conversation. Let's continue from where we left off.";
      
      // Try to speak the message and let the SDK events handle adding it to history
      try {
        repeatMessage(errorResetMessage, true);
        
        // Add a small delay before adding the message to history to avoid race conditions
        setTimeout(() => {
          // Check if the message was added by the SDK events
          const messageExists = messages.some(msg => 
            msg.sender === MessageSender.AVATAR && 
            msg.content === errorResetMessage
          );
          
          // If not, add it manually
          if (!messageExists) {
            console.log("Error reset message not added by SDK events, adding manually");
            addAIMessage(errorResetMessage);
          }
        }, 500);
      } catch (speechError) {
        console.error("Error making avatar speak error message:", speechError);
        // If speaking fails, add the message directly
        addAIMessage(errorResetMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [useAI, addAIMessage, setIsLoading, repeatMessage, setErrorMessage]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-row gap-2 items-center justify-end">
        <div className="flex flex-row gap-2">
          <Button 
            onClick={resetConversation} 
            disabled={isLoading}
            className="text-xs py-1"
          >
            Reset Conversation
          </Button>
        </div>
      </div>
      
      {errorMessage && (
        <div className="w-full p-3 bg-red-900 rounded-lg mb-2 text-xs text-white">
          <h4 className="font-medium mb-1">Error:</h4>
          <p>{errorMessage}</p>
          <button 
            onClick={() => setErrorMessage(null)} 
            className="mt-2 px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-xs"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {showDebug && debugResponse && (
        <div className="w-full p-2 bg-zinc-800/50 border border-zinc-700 rounded-lg mb-2 text-xs text-zinc-400 overflow-auto max-h-[100px]">
          <details>
            <summary className="cursor-pointer hover:text-white">API Response (click to expand)</summary>
            <pre className="whitespace-pre-wrap mt-2 pl-2 border-l-2 border-zinc-700">{debugResponse}</pre>
          </details>
        </div>
      )}
      
      {showCommands && (
        <div className="w-full p-3 bg-zinc-800 rounded-lg mb-2 text-xs text-white overflow-auto max-h-[250px]">
          <h4 className="font-medium mb-2">Available Commands:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="p-2 bg-zinc-700 rounded">
              <strong>/material [name=material_name]</strong>
              <p>Look up information about a specific material</p>
              <em className="text-gray-400">Example: /material name=aluminum</em>
            </div>
            <div className="p-2 bg-zinc-700 rounded">
              <strong>/process [name=process_name]</strong>
              <p>Check details about a manufacturing process</p>
              <em className="text-gray-400">Example: /process name=cnc</em>
            </div>
            <div className="p-2 bg-zinc-700 rounded">
              <strong>/time [process=name] [quantity=num] [complexity=level]</strong>
              <p>Estimate production time</p>
              <em className="text-gray-400">Example: /time process=injection quantity=1000 complexity=medium</em>
            </div>
            <div className="p-2 bg-zinc-700 rounded">
              <strong>/cost [process=name] [quantity=num] [material=name]</strong>
              <p>Calculate estimated cost</p>
              <em className="text-gray-400">Example: /cost process=cnc quantity=10 material=steel</em>
            </div>
            <div className="p-2 bg-zinc-700 rounded">
              <strong>/troubleshoot [issue=description]</strong>
              <p>Get troubleshooting steps for common issues</p>
              <em className="text-gray-400">Example: /troubleshoot issue=warping</em>
            </div>
            <div className="p-2 bg-zinc-700 rounded">
              <strong>/explain [process=name]</strong>
              <p>Get detailed explanation of a process</p>
              <em className="text-gray-400">Example: /explain process=injection molding</em>
            </div>
            <div className="p-2 bg-zinc-700 rounded">
              <strong>/compare [method1=name] [method2=name]</strong>
              <p>Compare two manufacturing methods</p>
              <em className="text-gray-400">Example: /compare method1=cnc method2=3dprinting</em>
            </div>
            <div className="p-2 bg-zinc-700 rounded">
              <strong>/resource [topic=name]</strong>
              <p>Find resources about a specific topic</p>
              <em className="text-gray-400">Example: /resource topic=design guidelines</em>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-row gap-2 items-end w-full">
        <Input
          className="flex-grow"
          placeholder="Type your message here..."
          value={message}
          onChange={setMessage}
          disabled={isLoading}
        />
        <Button className="!p-2" onClick={handleSend} disabled={isLoading}>
          {isLoading ? <LoadingIcon size={20} /> : <SendIcon size={20} />}
        </Button>
      </div>
    </div>
  );
};
