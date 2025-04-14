import { useState } from 'react';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface UseChatProps {
  onResponse?: (response: string) => Promise<void>;
  model?: 'claude-3-7-sonnet-20250219' | 'gemini-2.5-pro-exp-03-25' | 'gemini-2.0-flash';
}

export function useChat({ onResponse, model = 'gemini-2.5-pro-exp-03-25' }: UseChatProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (content: string) => {
    setIsLoading(true);
    try {
      // Add user message
      const userMessage: Message = { role: 'user', content };
      setMessages(prev => [...prev, userMessage]);

      // Prepare conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // Add the new user message to history
      conversationHistory.push({
        role: 'user',
        content
      });

      console.log(`Sending chat request with model: ${model}`);

      // Get AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory,
          model
        }),
      });

      const data = await response.json().catch(e => {
        console.error("Error parsing JSON response:", e);
        throw new Error("Failed to parse response from server");
      });

      if (!response.ok) {
        const errorMsg = data.error || `Server error: ${response.status}`;
        console.error("API error:", errorMsg);
        throw new Error(errorMsg);
      }

      console.log("Received API response:", data);

      // Check for our new response format first
      if (data && data.success && data.message && typeof data.message.content === 'string') {
        const aiMessage: Message = { role: 'ai', content: data.message.content };
        setMessages(prev => [...prev, aiMessage]);

        // Call the onResponse callback if provided
        if (onResponse) {
          await onResponse(data.message.content);
        }

        return data.message.content;
      }
      // Fallback to check for old response format
      else if (data && typeof data === 'object' && 'response' in data) {
        const aiMessage: Message = { role: 'ai', content: data.response as string };
        setMessages(prev => [...prev, aiMessage]);

        // Call the onResponse callback if provided
        if (onResponse) {
          await onResponse(data.response as string);
        }

        return data.response;
      }
      // Neither format matched
      else {
        console.error("Invalid response format:", data);
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `I apologize, but I encountered an error: ${errorMessage}. Please try again.`
      }]);

      throw error; // Re-throw to allow handling by the component
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    sendMessage,
    isLoading
  };
} 