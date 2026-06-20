import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, User, ArrowRight, Paperclip, Check, Trash2, MessageSquare, Plus, Menu } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: string; // ISO string for sorting recency
}

export function ChatAIView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dynamic Sidebar Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load chats from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('arcania_chats');
    if (saved) {
      try {
        const parsed: ChatSession[] = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          // Load the first (most recent) saved session automatically
          setCurrentSessionId(parsed[0].id);
          const withDateObjects = parsed[0].messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
          setMessages(withDateObjects);
        }
      } catch (err) {
        console.error("Error parsing stored chat sessions:", err);
      }
    }
  }, []);

  // Save utility sorting by recency
  const saveSessions = (updatedSessions: ChatSession[]) => {
    const sorted = [...updatedSessions].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    localStorage.setItem('arcania_chats', JSON.stringify(sorted));
    setSessions(sorted);
  };

  // Send handler with dynamic session tracking and title generation
  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    if (!textToSend) setInput('');
    setAttachedFileName(null); // Reset attachment after sending

    // Add User Message
    const userMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: query,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    // Track active session updates
    let activeId = currentSessionId;
    let fallbackSessions = [...sessions];

    if (!activeId) {
      // First message defines the session title
      activeId = "sess_" + Date.now().toString();
      setCurrentSessionId(activeId);

      const computedTitle = query.length > 22 ? query.substring(0, 20) + "..." : query;
      const newSession: ChatSession = {
        id: activeId,
        title: computedTitle,
        messages: [userMsg],
        timestamp: new Date().toISOString()
      };
      fallbackSessions = [newSession, ...fallbackSessions];
    } else {
      // Update existing session
      const targetSess = fallbackSessions.find(s => s.id === activeId);
      if (targetSess) {
        // If the session was previously cleared or empty, give it a title now
        const isFirstMessage = targetSess.messages.length === 0;
        const computedTitle = isFirstMessage 
          ? (query.length > 22 ? query.substring(0, 20) + "..." : query) 
          : targetSess.title;

        const updatedSess = {
          ...targetSess,
          title: computedTitle,
          messages: [...targetSess.messages, userMsg],
          timestamp: new Date().toISOString()
        };
        fallbackSessions = [updatedSess, ...fallbackSessions.filter(s => s.id !== activeId)];
      } else {
        // Fallback case (if state gets cleared but currentSessionId was set)
        const computedTitle = query.length > 22 ? query.substring(0, 20) + "..." : query;
        const newSession: ChatSession = {
          id: activeId,
          title: computedTitle,
          messages: [userMsg],
          timestamp: new Date().toISOString()
        };
        fallbackSessions = [newSession, ...fallbackSessions];
      }
    }

    saveSessions(fallbackSessions);

    try {
      // Fetch response from server-side Route
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error("Mainframe failed to respond correctly.");
      }

      const data = await response.json();
      const assistantMsg: Message = {
        id: Math.random().toString(),
        role: 'assistant',
        content: data.text || "An unexpected silent error registered. The node is secure, but return data was lost.",
        timestamp: new Date()
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Save updated messages into localstorage correctly
      const reLoadedSessions = JSON.parse(localStorage.getItem('arcania_chats') || '[]');
      const finalSessions = reLoadedSessions.map((s: ChatSession) => {
        if (s.id === activeId) {
          return {
            ...s,
            messages: finalMessages,
            // Keep timestamp updated so it stays near the top if active
            timestamp: new Date().toISOString()
          };
        }
        return s;
      });
      saveSessions(finalSessions);

    } catch (err: any) {
      console.error(err);
      // Fallback response to keep chat interactive
      const assistantMsg: Message = {
        id: Math.random().toString(),
        role: 'assistant',
        content: "🚨 **Error in Arcania Grid**: I was unable to compile a reply due to connection disruption in our server nodes. Please check if your dev server remains active.",
        timestamp: new Date()
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      const reLoadedSessions = JSON.parse(localStorage.getItem('arcania_chats') || '[]');
      const finalSessions = reLoadedSessions.map((s: ChatSession) => {
        if (s.id === activeId) {
          return {
            ...s,
            messages: finalMessages,
            timestamp: new Date().toISOString()
          };
        }
        return s;
      });
      saveSessions(finalSessions);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setAttachedFileName(null);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFileName(e.target.files[0].name);
    }
  };

  // Helper to render simple inline formatting (like bold, lists, and headers)
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, blockIdx) => {
      // Check for lists
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        const text = line.trim().substring(2);
        return (
          <li key={blockIdx} className="ml-5 list-disc my-1 text-white font-sans font-medium text-[14px]">
            {renderInlineText(text)}
          </li>
        );
      }
      // Check for nested subheaders
      if (line.trim().startsWith('### ')) {
        return (
          <h4 key={blockIdx} className="text-xs font-bold uppercase tracking-wider text-purple-300 mt-3 mb-1 font-serif">
            {line.trim().substring(4)}
          </h4>
        );
      }
      if (line.trim().startsWith('## ')) {
        return (
          <h3 key={blockIdx} className="text-sm font-extrabold uppercase tracking-widest text-[#fff] mt-3 mb-1.5 font-serif">
            {line.trim().substring(3)}
          </h3>
        );
      }
      // Standard line
      return (
        <p key={blockIdx} className="my-1 leading-relaxed text-white/90 font-sans font-medium text-[14px]">
          {renderInlineText(line)}
        </p>
      );
    });
  };

  // Quick inline formatter for **bold** text
  const renderInlineText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={partIdx} className="font-extrabold text-[#fff]">
            {part.substring(2, part.length - 2)}
          </strong>
        );
      }
      return part;
    });
  };

  // Entrance Framer Motion variants
  const titleVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const subtitleVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { delay: 0.25, duration: 0.8, ease: "easeOut" } }
  };

  const boxesContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.45
      }
    }
  };

  const boxItemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } }
  };

  const inputVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { delay: 0.95, duration: 0.8, ease: "easeOut" } }
  };

  const buttonsVariants = {
    hidden: { opacity: 0, x: 15 },
    visible: { opacity: 1, x: 0, transition: { delay: 1.1, duration: 0.8, ease: "easeOut" } }
  };

  return (
    <div 
      className="relative w-full h-screen pt-24 pb-6 px-4 md:px-8 flex flex-col md:flex-row gap-6 overflow-hidden select-none"
      style={{
        backgroundImage: "url('/media/arcaniabg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* High-fidelity subtle background overlay */}
      <div className="absolute inset-0 bg-[#050e18]/20 pointer-events-none z-0" />

      {/* Floating Sidebar close to the left edge - Collage interactive drawer */}
      <div 
        onClick={() => {
          if (!isDrawerOpen) {
            setIsDrawerOpen(true);
          }
        }}
        className={`absolute left-0 top-[110px] bottom-6 w-[220px] flex flex-col rounded-r-[24px] p-4 justify-between transition-all duration-300 bg-[#536d88]/70 border-y border-r border-white/10 text-white/90 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] min-h-0 z-20 ${
          isDrawerOpen 
            ? 'translate-x-0' 
            : '-translate-x-[185px] cursor-pointer hover:bg-[#536d88]/80'
        }`}
      >
        {/* Decorative Toggle Handle on the outer right edge */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDrawerOpen(!isDrawerOpen);
          }}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-[#536d88] hover:bg-[#627d9a] border border-white/20 rounded-r-xl flex items-center justify-center text-white cursor-pointer shadow-md select-none transition-all active:scale-95 z-30"
          title={isDrawerOpen ? "Close History" : "Open History"}
        >
          <span className="text-[10px] font-bold font-mono">
            {isDrawerOpen ? "◀" : "▶"}
          </span>
        </button>

        {/* Full layout fades in/out beautifully based on open state to prevent vertical distortion of text */}
        <div className={`flex flex-col h-full w-full transition-opacity duration-300 ${
          isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          {/* Top pin: New Chat button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearChat();
            }}
            className="w-full py-2 px-3 rounded-full font-serif text-[11px] font-bold uppercase tracking-widest text-center border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-[#f5f5f7] transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shadow"
          >
            <Plus size={12} />
            <span>New chat</span>
          </button>

          {/* Chat Sessions History list */}
          <div className="flex-1 overflow-y-auto mt-5 space-y-2 pr-1 scrollbar-hide py-1">
            {sessions.length === 0 ? (
              <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest text-center py-6">
                No active logs
              </div>
            ) : (
              sessions.map((sess) => {
                const isActive = sess.id === currentSessionId;
                return (
                  <div
                    key={sess.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentSessionId(sess.id);
                      const withDates = sess.messages.map(m => ({
                        ...m,
                        timestamp: new Date(m.timestamp)
                      }));
                      setMessages(withDates);
                    }}
                    className={`group w-full py-2.5 px-3 rounded-xl border flex items-center justify-between text-left cursor-pointer transition-all ${
                      isActive
                        ? 'bg-white/15 border-white/25 text-white shadow-inner font-extrabold shadow-black/10'
                        : 'bg-white/[0.02] border-white/5 text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MessageSquare size={12} className={isActive ? "text-cyan-300" : "text-white/30"} />
                      <span className="text-[11px] font-serif truncate tracking-wide leading-tight select-none">
                        {sess.title}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = sessions.filter(s => s.id !== sess.id);
                        saveSessions(updated);
                        if (currentSessionId === sess.id) {
                          if (updated.length > 0) {
                            setCurrentSessionId(updated[0].id);
                            setMessages(updated[0].messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
                          } else {
                            clearChat();
                          }
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-white/40 hover:text-red-400 transition-all cursor-pointer"
                      title="Delete chat"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom segment status */}
          <div className="pt-2.5 mt-2 border-t border-white/10 flex items-center justify-between opacity-50 font-mono text-[8px] tracking-widest uppercase font-bold shrink-0">
            <span>ARCANIA HISTORY</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Primary Content workspace always centered */}
      <div className="flex-1 flex flex-col h-full justify-center items-center min-h-0 relative z-10 w-full">
        
        {/* Thread list scrollport */}
        <div className="w-full max-w-[500px] flex-1 overflow-y-auto pr-1 mb-4 space-y-4 scrollbar-hide min-h-0 flex flex-col justify-start">
          
          <AnimatePresence mode="wait">
            {messages.length === 0 ? (
              // UI matches exactly: Title, Subtitle, presets grid
              <div className="my-auto flex flex-col items-center justify-center py-2 w-full">
                
                {/* Title and Subtitle */}
                <motion.h1 
                  variants={titleVariants}
                  initial="hidden"
                  animate="visible"
                  className="text-3xl md:text-[38px] font-serif uppercase text-white tracking-[0.08em] leading-none text-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] select-none"
                >
                  ARCANIA IS HERE!
                </motion.h1>
                <motion.p 
                  variants={subtitleVariants}
                  initial="hidden"
                  animate="visible"
                  className="text-white/80 font-serif text-center mt-1.5 text-sm md:text-base font-normal tracking-wide"
                >
                  What can I help with?
                </motion.p>

                {/* 3 small rounded boxes in one horizontal row directly above input */}
                <motion.div 
                  variants={boxesContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-6 grid grid-cols-3 gap-2.5 w-full shrink-0"
                >
                  {/* Card 1: 📊 statistics */}
                  <motion.button
                    variants={boxItemVariants}
                    onClick={() => handleSend("top performing NFT today...")}
                    className="h-[70px] rounded-[20px] bg-[#536d88]/80 hover:bg-[#536d88]/95 border border-white/10 transition-all duration-300 flex items-center justify-center group cursor-pointer shadow-lg active:scale-95 relative overflow-hidden backdrop-blur-md"
                  >
                    <div className="text-2xl sm:text-3xl group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] select-none">
                      📊
                    </div>
                  </motion.button>

                  {/* Card 2: 💎 premium */}
                  <motion.button
                    variants={boxItemVariants}
                    onClick={() => handleSend("list my Drips NFTs at floor.")}
                    className="h-[70px] rounded-[20px] bg-[#536d88]/80 hover:bg-[#536d88]/95 border border-white/10 transition-all duration-300 flex items-center justify-center group cursor-pointer shadow-lg active:scale-95 relative overflow-hidden backdrop-blur-md"
                  >
                    <div className="text-2xl sm:text-3xl group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] select-none">
                      💎
                    </div>
                  </motion.button>

                  {/* Card 3: 📢 announcements */}
                  <motion.button
                    variants={boxItemVariants}
                    onClick={() => handleSend("what is the hot NFT collection trend for this week?")}
                    className="h-[70px] rounded-[20px] bg-[#536d88]/80 hover:bg-[#536d88]/95 border border-white/10 transition-all duration-300 flex items-center justify-center group cursor-pointer shadow-lg active:scale-95 relative overflow-hidden backdrop-blur-md"
                  >
                    <div className="text-2xl sm:text-3xl group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] select-none">
                      📢
                    </div>
                  </motion.button>
                </motion.div>

                {/* Spacing dummy to push elements beautifully above middle */}
                <div className="h-6" />

              </div>
            ) : (
              // Message History List styled perfectly
              <div className="space-y-4 pt-2 w-full">
                {messages.map((m) => {
                  const isAI = m.role === 'assistant';
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${isAI ? 'justify-start' : 'justify-end'}`}
                    >
                      {isAI && (
                        /* Arcania Gate Signet */
                        <div className="w-9 h-9 rounded-full bg-black border border-white/15 flex items-center justify-center shrink-0 shadow-lg select-none">
                          <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 21V11a6 6 0 0112 0v10M9 21h6" />
                          </svg>
                        </div>
                      )}

                      {/* Speech bubble */}
                      <div className={`text-[14px] leading-relaxed border transition-all ${
                        isAI
                          ? 'bg-[#536d88]/70 border-2 border-purple-500 rounded-[24px] p-4 text-white w-full shadow-[0_10px_25px_rgba(139,92,246,0.12)]'
                          : 'bg-[#536d88]/85 hover:bg-[#536d88]/95 text-white border border-white/10 px-4 py-2 rounded-[20px]'
                      }`}>
                        <div className="prose prose-invert prose-sm max-w-none">
                          {renderMessageContent(m.content)}
                        </div>
                      </div>

                      {!isAI && (
                        <div className="w-9 h-9 rounded-full bg-slate-700/80 border border-white/10 flex items-center justify-center shrink-0 shadow-lg select-none">
                          <User size={15} className="text-white" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-9 h-9 rounded-full bg-black border border-white/15 flex items-center justify-center shrink-0 shadow-lg select-none">
                      <svg className="w-4.5 h-4.5 text-white animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 21V11a6 6 0 0112 0v10M9 21h6" />
                      </svg>
                    </div>
                    <div className="rounded-[24px] bg-[#536d88]/70 border border-white/10 px-4 py-2.5 text-xs font-mono tracking-wider text-purple-300 font-bold flex items-center gap-2 backdrop-blur-md">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500"></span>
                      </span>
                      <span>Arcania intelligence synthesizing...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Action Input Card block and Vertical Mode selector side-by-side */}
        <div className="w-full max-w-[500px] flex flex-col gap-2.5 shrink-0">
          
          <div className="flex gap-2.5 w-full items-stretch">
            
            {/* Input Console matching exact shape & color of reference UI */}
            <motion.div 
              variants={inputVariants}
              initial="hidden"
              animate="visible"
              className="flex-1 flex flex-col justify-between p-3.5 h-[115px] rounded-[24px] bg-[#536d88]/80 border border-white/10 focus-within:border-white/25 focus-within:ring-1 focus-within:ring-white/10 shadow-xl backdrop-blur-xl transition-all duration-300 relative focus-within:shadow-[0_0_15px_rgba(255,255,255,0.08)]"
            >
              {/* Textarea Input styling */}
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={mode === 'chat' ? "top performing NFT today..." : "Query Arcania Agent core triggers..."}
                className="w-full bg-transparent text-[14px] font-sans font-normal text-white placeholder-white/25 focus:outline-none resize-none border-0 p-0 leading-tight overflow-y-auto scrollbar-hide"
              />

              {/* Bottom bar of console */}
              <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                
                {/* Attach file label and trigger button */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 py-1 px-3 rounded-full text-[10px] font-bold font-sans bg-[#1a2f44]/60 hover:bg-[#1a2f44]/80 text-white/95 cursor-pointer hover:text-white transition-all shadow-inner border border-white/5 select-none active:scale-95">
                    <Paperclip size={10} className="text-white" />
                    <span>Attach file</span>
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>

                  {attachedFileName && (
                    <span className="text-[10px] font-mono text-purple-300 flex items-center gap-1 bg-[#536d88]/30 py-0.5 px-2 rounded-full border border-white/5">
                      <Check size={9} className="text-purple-300" />
                      {attachedFileName.length > 12 ? attachedFileName.substring(0, 10) + '...' : attachedFileName}
                    </span>
                  )}
                </div>

                {/* Submission circle with right-pointing arrow */}
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className="w-7 h-7 rounded-full bg-transparent hover:bg-white/5 text-white border border-white/20 hover:border-white/40 flex items-center justify-center cursor-pointer transition-all active:scale-95 disabled:opacity-20 disabled:scale-100"
                >
                  <ArrowRight size={13} className="text-white" />
                </button>
              </div>

            </motion.div>

            {/* Mode selection buttons stacked vertically with exact tight bounds and custom selected glow */}
            <motion.div 
              variants={buttonsVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-1.5 justify-between w-[95px] shrink-0"
            >
              <button
                type="button"
                onClick={() => setMode('chat')}
                className={`flex-1 flex items-center justify-center rounded-[18px] font-serif text-[12px] tracking-[0.12em] font-bold uppercase transition-all duration-300 cursor-pointer border ${
                  mode === 'chat'
                    ? 'bg-[#536d88] border-white/25 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)] glow-light'
                    : 'bg-[#536d88]/40 border-transparent text-white/35 hover:text-white/60'
                }`}
              >
                CHAT
              </button>
              
              <button
                type="button"
                onClick={() => setMode('agent')}
                className={`flex-1 flex items-center justify-center rounded-[18px] font-serif text-[12px] tracking-[0.12em] font-bold uppercase transition-all duration-300 cursor-pointer border ${
                  mode === 'agent'
                    ? 'bg-[#536d88] border-white/25 text-white shadow-[0_0_15px_rgba(255,255,255,0.15)] glow-light'
                    : 'bg-[#536d88]/40 border-transparent text-white/35 hover:text-white/60'
                }`}
              >
                AGENT
              </button>
            </motion.div>
          </div>

        </div>

      </div>
    </div>
  );
}
