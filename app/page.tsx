"use client";
import React, { useState } from "react";
import Image from "next/image";
import logo from "../images/church_logo.svg";
import Bubble from "./components/Bubble";
import LoadingBubble from "./components/LoadingBubble";
import PromptSuggestionRow from "./components/PromptSuggestionRow";
import { Message } from "@/interface/type";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
  };

  const handlePrompt = async (prompt: string) => {
    const msg = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: prompt,
    };
    setMessages((prevMessages : Message[]) => [...prevMessages, msg]);

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: [...messages, msg] }),
      });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is undefined');
      }
      const decoder = new TextDecoder();

      const aiMessage = {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        content: "",
      };
      setMessages((prevMessages: Message[]) => [...prevMessages, aiMessage]);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                setMessages(prevMessages => 
                  prevMessages.map(msg => 
                    msg.id === aiMessage.id 
                      ? { ...msg, content: data.text }
                      : msg
                  )
                );
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
      setErrorMessage("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: input,
    };

    setMessages((prevMessages: Message[]) => [...prevMessages, userMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errorData = await response.json();
          console.log("Error Response:", errorData);
          setErrorMessage(errorData.error || "An unexpected error occurred");
          return;
        }
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is undefined');
      }
      const decoder = new TextDecoder();

      // Create a placeholder for the AI message
      const aiMessage = {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        content: "",
      };
      setMessages((prevMessages: Message[]) => [...prevMessages, aiMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                setMessages(prevMessages => 
                  prevMessages.map(msg => 
                    msg.id === aiMessage.id 
                      ? { ...msg, content: data.text }
                      : msg
                  )
                );
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }

        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.log("Error fetching AI response:", error);
      setErrorMessage("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
      setInput(""); // Clear the input field
    }
  };

  return (
    <main>
      <Image src={logo} alt="Church Logo" width={180} height={38} />
      <section className={messages.length === 0 ? "" : "populate"}>
        {messages.length === 0 ? (
          <>
            <p className="starter-text">
              The Place where you can query about the Church Handbook of Instructions for Elders Quorum.
            </p>
            <br />
            <PromptSuggestionRow onPromptClick={handlePrompt} />
          </>
        ) : (
          <>
            {messages.map((message, index) => (
              <Bubble key={`message-${index}`} message={message} />
            ))}
            {isLoading && <LoadingBubble />}
          </>
        )}
        {errorMessage && <div className="error-message">{errorMessage}</div>}
      </section>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          onChange={handleInputChange}
          value={input}
          className="question-box"
          placeholder="Ask me something about the handbook..."
        />
        <input type="submit" value="Submit" />
      </form>
      <style jsx>{`
        .error-message {
          color: red;
          font-weight: bold;
          margin-top: 10px;
        }
      `}</style>
    </main>
  );
}
