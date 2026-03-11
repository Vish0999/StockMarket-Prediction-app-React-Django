import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Minimize2, Maximize2, Bot, User } from 'lucide-react';

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm your AutoVest Assistant. How can I help you with your portfolio today?", sender: 'bot' }
  ]);
  const messagesEndRef = useRef(null);
  const inactivityTimer = useRef(null);

  const resetChat = () => {
    setMessages([
      { id: 1, text: "Hello! I'm your AutoVest Assistant. How can I help you with your portfolio today?", sender: 'bot' }
    ]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();

    // Clear previous timer
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    // Set a new timer to reset the chat after 30 seconds of inactivity
    inactivityTimer.current = setTimeout(() => {
      resetChat();
    }, 30000); // 30 seconds

    // Cleanup on unmount
    return () => clearTimeout(inactivityTimer.current);

  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Simple bot logic - you can connect this to an actual API later
    setTimeout(() => {
      let botResponse = "I'm analyzing that for you. Currently, I can help you find stocks, check your portfolio, or analyze market trends.";
      
      const lowerInput = input.toLowerCase();
      if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
        botResponse = "Hi there! I'm your AutoVest Assistant. Ready to explore the financial markets today?";
      } else if (lowerInput.includes('gold')) {
        botResponse = "The current gold market is showing stability. You can view the live Gold & Silver prices and historical trends in our dedicated 'Gold/Silver' section for precise, real-time data.";
      } else if (lowerInput.includes('portfolio')) {
        botResponse = "Your personal portfolio is organized under the 'My Portfolio' tab. There, you can see your holdings, buy prices, and total gains/losses.";
      } else if (lowerInput.includes('search') || lowerInput.includes('stock') || lowerInput.includes('detail')) {
        botResponse = "To view detailed analytics for any stock, please use our 'Market Explorer'. It provides real-time yfinance data, including price trends, fair value estimates, and discount opportunities.";
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, text: botResponse, sender: 'bot' }]);
    }, 1000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-['Poppins',sans-serif]">
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-2xl hover:bg-indigo-500 transition-all hover:scale-110 active:scale-95"
        >
          <MessageSquare size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`flex flex-col bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl transition-all duration-300 ${isMinimized ? 'h-16 w-64' : 'h-[500px] w-80 md:w-96'}`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                <Bot size={18} className="text-white" />
              </div>
              <span className="font-bold text-white text-sm">AutoVest AI</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <button onClick={() => setIsMinimized(!isMinimized)} className="hover:text-white transition-colors">
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
              <button onClick={() => setIsOpen(false)} className="hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                      msg.sender === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white/5 text-slate-200 border border-white/5 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-white/5 rounded-b-2xl flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask something..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 transition-colors shrink-0"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}