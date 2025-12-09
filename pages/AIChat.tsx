import React, { useState, useRef, useEffect } from 'react';
import { getGeminiChat } from '../lib/gemini';
import { NeonButton, GlassCard } from '../components/UI';
import { Bot, Send, Sparkles } from 'lucide-react';
import { Chat, GenerateContentResponse } from '@google/genai';

interface AIMessage {
  role: 'user' | 'model';
  text: string;
}

export const AIChatPage = () => {
  const [messages, setMessages] = useState<AIMessage[]>([
    { role: 'model', text: "Greetings, human! I am Giggle AI. How can I assist your digital existence today? 🤖✨" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatSession = useRef<Chat | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatSession.current = getGeminiChat();
    return () => { chatSession.current = null; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatSession.current) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const result: GenerateContentResponse = await chatSession.current.sendMessage({
        message: userMsg
      });
      const responseText = result.text || "I'm having trouble processing that thought.";
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Error: Neural link disconnected." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-neon-purple to-neon-blue flex items-center justify-center shadow-lg">
          <Bot className="text-white w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">Giggle AI</h1>
          <p className="text-neon-blue text-sm flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Gemini 2.5 Flash Connected
          </p>
        </div>
      </div>

      <GlassCard className="flex-1 flex flex-col overflow-hidden !p-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] p-4 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-neon-purple/20 border border-neon-purple/30 text-white rounded-tr-none' 
                    : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none'
                }`}
              >
                <p className="leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none flex gap-1 items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-black/20 border-t border-white/5">
          <form onSubmit={handleSend} className="relative">
            <input 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask Giggle AI anything..."
              className="w-full bg-slate-900 border border-white/10 rounded-xl py-4 pl-4 pr-16 text-white focus:border-neon-blue focus:outline-none transition-colors"
            />
            <button 
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 top-2 bottom-2 aspect-square bg-neon-blue/20 hover:bg-neon-blue/40 text-neon-blue rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </GlassCard>
    </div>
  );
};
