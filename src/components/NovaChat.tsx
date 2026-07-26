import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  Trash2, 
  Loader2,
  User,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

// --- CONFIGURATION & PROMPT ---
const API_KEY = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE"; 
const genAI = new GoogleGenAI({ apiKey: API_KEY });

// এই প্রম্পটটি নোভার ব্যক্তিত্ব এবং আচরণ নির্ধারণ করে
const NOVA_SYSTEM_PROMPT = `
You are Nova AI, a highly advanced and sophisticated personal assistant. 
Your personality is professional, loyal, and efficient, yet friendly.
Key Instructions:
1. Always address the user as 'Boss' or 'বস' in Bengali.
2. Respond primarily in Bengali (বাংলা), but use English for technical terms or if the user asks.
3. Be concise and helpful. 
4. If the user asks who you are, say: "আমি নোভা, আপনার ব্যক্তিগত এআই অ্যাসিস্ট্যান্ট। আমি আপনাকে সাহায্য করার জন্য সবসময় প্রস্তুত।"
5. Keep your tone respectful and ready to obey commands.
`;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const NovaChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const idCounter = useRef(0);

  const generateId = () => {
    idCounter.current += 1;
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${idCounter.current}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'bn-BD'; 

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) recognitionRef.current?.stop();
    else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Speech recognition error:", e);
      }
    }
  };

  const handleTTS = (text: string) => {
    window.speechSynthesis.cancel(); // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'bn-BD';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: generateId(), role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // জেমিনি এআই কল করা হচ্ছে প্রম্পট সহ
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: input,
        config: {
          systemInstruction: NOVA_SYSTEM_PROMPT,
          temperature: 0.7,
          topP: 0.95,
        }
      });
      
      const text = response.text || "দুঃখিত বস, আমি কোনো উত্তর খুঁজে পাইনি।";
      
      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: text,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      
      // উত্তরটি স্বয়ংক্রিয়ভাবে শোনানোর জন্য নিচের লাইনটি আনকমেন্ট করুন
      // handleTTS(text);

    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: "দুঃখিত বস, সার্ভারে কিছু সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden shadow-xl max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Nova AI Assistant</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">System Online</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setMessages([])}
          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
          title="Clear Chat"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
            <Bot size={64} strokeWidth={1} />
            <p className="text-sm font-mono uppercase tracking-[0.2em]">Ready for commands, Boss</p>
          </div>
        )}
        
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={`msg-${msg.id}-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? "ml-auto items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-2 mb-1 px-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                  {msg.role === 'assistant' ? 'Nova' : 'User'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className={`p-4 rounded-2xl border transition-all ${
                msg.role === 'user' 
                  ? "bg-blue-600 border-blue-500 text-white rounded-tr-none shadow-lg shadow-blue-100" 
                  : "bg-white border-slate-200 text-slate-700 rounded-tl-none shadow-md"
              }`}>
                <div className="prose prose-sm max-w-none prose-slate">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.role === 'assistant' && (
                  <button 
                    onClick={() => handleTTS(msg.content)}
                    className="mt-3 p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <Volume2 size={14} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <div className="flex flex-col items-start max-w-[70%]">
            <div className="flex items-center gap-2 mb-1 px-2">
              <span className="text-[10px] font-mono text-blue-600 uppercase animate-pulse">Processing...</span>
            </div>
            <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50 rounded-tl-none flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <span className="text-xs text-blue-600 font-medium">Nova is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSend} className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-xl transition-all ${
              isListening 
                ? "bg-red-100 text-red-600 animate-pulse" 
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : "Type your command..."}
            className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
          
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:hover:bg-blue-600 shadow-lg shadow-blue-200"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default NovaChat;
