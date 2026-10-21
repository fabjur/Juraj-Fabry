import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { 
  Bot, 
  Send, 
  Trash2, 
  Sparkles, 
  User, 
  Copy, 
  Check, 
  Cpu, 
  Zap, 
  BrainCircuit, 
  Store, 
  ArrowRight
} from 'lucide-react';
import { 
  CHAT_ROLES, 
  type ChatModel, 
  type ChatMessage, 
  type ChatRoleDefinition, 
  sendChatMessage 
} from '../services/chatService';
import type { ImageState } from '../hooks/useImageAnalysis';
import type { Analysis } from '../types';

interface ChatPanelProps {
  activeImages?: ImageState[];
  activeAnalysis?: Analysis | null;
  onNavigateToView?: (view: any) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  activeImages = [],
  activeAnalysis = null
}) => {
  const { t } = useTranslation();

  // Selected Role & Model
  const [selectedRoleId, setSelectedRoleId] = useState<string>('auditor');
  const [selectedModel, setSelectedModel] = useState<ChatModel>('gemini-3.8-flash');
  const [includeAnalysisContext, setIncludeAnalysisContext] = useState<boolean>(true);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('salesapp_gemini_chat_history');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return [];
  });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentRole = useMemo<ChatRoleDefinition>(() => {
    return CHAT_ROLES.find(r => r.id === selectedRoleId) || CHAT_ROLES[0];
  }, [selectedRoleId]);

  // When switching roles, recommend the optimal model for that role
  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    const roleDef = CHAT_ROLES.find(r => r.id === roleId);
    if (roleDef) {
      setSelectedModel(roleDef.recommendedModel);
    }
  };

  // Build analysis summary context
  const analysisContextText = useMemo(() => {
    if (!includeAnalysisContext) return '';

    const storeName = activeAnalysis?.store?.name || 
      activeImages[0]?.analysisResult?.storeInfo?.chain || 
      'Neznáma predajňa';

    const totalImages = activeImages.length;
    let totalFacings = 0;
    const productNames = new Set<string>();
    let promoCount = 0;

    activeImages.forEach(img => {
      const prods = img.analysisResult?.products || [];
      totalFacings += prods.length;
      prods.forEach(p => {
        if (p.name) productNames.add(p.name);
        if (p.prices?.some(pr => pr.type === 'PROMO')) promoCount++;
      });
    });

    const sampleProducts = Array.from(productNames).slice(0, 15).join(', ');

    return `
- Názov aktívnej analýzy: ${activeAnalysis?.name || 'Aktuálna analýza'}
- Predajňa / Reťazec: ${storeName}
- Počet analyzovaných fotografií: ${totalImages}
- Celkový počet detegovaných facingov: ${totalFacings}
- Počet unikátnych produktov: ${productNames.size}
- Zistené promo akcie: ${promoCount}
- Vzorka identifikovaných produktov: ${sampleProducts || 'Žiadne produkty zatiaľ'}
    `.trim();
  }, [includeAnalysisContext, activeAnalysis, activeImages]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('salesapp_gemini_chat_history', JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Scroll to bottom on message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setErrorMessage(null);
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputValue('');
    setIsLoading(true);

    try {
      const reply = await sendChatMessage({
        message: text,
        history: messages, // pass prior turns
        model: selectedModel,
        systemInstruction: currentRole.systemInstruction,
        analysisContext: includeAnalysisContext ? analysisContextText : undefined
      });

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        role: 'model',
        text: reply,
        timestamp: new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel,
        roleName: currentRole.name
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Gemini chat error:', err);
      setErrorMessage(err?.message || 'Nepodarilo sa získať odpoveď od Gemini API. Skontrolujte internetové pripojenie alebo skúste iný model.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Naozaj chcete zmazať celú históriu konverzácie?')) {
      setMessages([]);
      localStorage.removeItem('salesapp_gemini_chat_history');
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
      
      {/* 🟢 TOP CONTROLS & HEADER */}
      <div className="flex-shrink-0 bg-zinc-50/80 backdrop-blur-md border-b border-zinc-200/70 p-4 lg:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Bot Identity & Role Tag */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-lime-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-lime-500/20">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Gemini AI Asistent</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-lime-100 text-lime-800 border border-lime-200/60">
                Multi-Turn Chat
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {currentRole.name} • <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{currentRole.tagline}</span>
            </p>
          </div>
        </div>

        {/* Right: Model Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Model Switcher */}
          <div className="flex items-center bg-white dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <button
              onClick={() => setSelectedModel('gemini-3.8-flash')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedModel === 'gemini-3.8-flash'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="gemini-3.8-flash: Všeobecné maloobchodné úlohy a analýza"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>3.8 Flash</span>
              <span className="hidden sm:inline text-[9px] opacity-70 font-normal">všeobecný</span>
            </button>

            <button
              onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedModel === 'gemini-3.1-pro-preview'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="gemini-3.1-pro-preview: Komplexné matematické a planogramové úlohy"
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>3.1 Pro</span>
              <span className="hidden sm:inline text-[9px] opacity-80 font-normal">komplexný</span>
            </button>

            <button
              onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedModel === 'gemini-3.1-flash-lite'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="gemini-3.1-flash-lite: Blesková rýchlosť a stručné odpovede"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>3.1 Lite</span>
              <span className="hidden sm:inline text-[9px] opacity-80 font-normal">rýchly</span>
            </button>
          </div>

          {/* Clear Button */}
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
              title={t('clearConversation') || 'Zmazať konverzáciu'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 🧭 ROLE SELECTION STRIP & CONTEXT TOGGLE */}
      <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* Role Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mr-1 flex-shrink-0">
            {t('assistantRole') || 'Rola asistenta:'}
          </span>
          {CHAT_ROLES.map(role => (
            <button
              key={role.id}
              onClick={() => handleRoleChange(role.id)}
              className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all text-xs cursor-pointer ${
                selectedRoleId === role.id
                  ? 'bg-lime-600 text-white shadow-2xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900'
              }`}
            >
              {role.name}
            </button>
          ))}
        </div>

        {/* Live Analysis Context Switch */}
        {activeImages.length > 0 && (
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 select-none ml-auto">
            <input 
              type="checkbox" 
              checked={includeAnalysisContext} 
              onChange={e => setIncludeAnalysisContext(e.target.checked)}
              className="w-4 h-4 rounded text-lime-600 focus:ring-lime-500 accent-lime-600 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-zinc-400" />
              Prepojené s aktívnou analýzou ({activeImages.length} fotiek)
            </span>
          </label>
        )}
      </div>

      {/* 💬 SCROLLABLE CONVERSATION THREAD */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 custom-scrollbar bg-gradient-to-b from-zinc-50/40 via-white to-zinc-50/20">
        
        {/* Empty State with Starter Prompts */}
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto py-8 text-center flex flex-col items-center justify-center animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-lime-100 text-lime-700 flex items-center justify-center mb-4 shadow-sm border border-lime-200/60">
              <Sparkles className="w-8 h-8" />
            </div>
            
            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-2">
              Ako vám môžem pomôcť s analýzou predajne?
            </h3>
            
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-8 leading-relaxed">
              Zvoľte si špecializovanú rolu a model vyššie. Gemini má k dispozícii kontext vašich zoskenovaných produktov, cien a regálov.
            </p>

            {/* Quick Starters */}
            <div className="w-full text-left space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2">
                Odporúčané otázky pre rolu: <strong className="text-zinc-700 dark:text-zinc-300">{currentRole.name}</strong>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentRole.starterPrompts.map((starter, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(starter)}
                    className="p-3 bg-white dark:bg-zinc-900 hover:bg-lime-50/60 rounded-2xl border border-zinc-200/90 hover:border-lime-300 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 transition-all shadow-2xs group flex items-start justify-between gap-2"
                  >
                    <span>{starter}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-lime-600 flex-shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-xs text-xs font-black ${
                    isUser
                      ? 'bg-zinc-900 text-white'
                      : 'bg-gradient-to-tr from-lime-600 to-emerald-500 text-white'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble Card */}
                <div
                  className={`relative group rounded-3xl p-4 text-sm leading-relaxed shadow-xs transition-all ${
                    isUser
                      ? 'bg-zinc-900 text-white rounded-tr-xs'
                      : 'bg-white border border-zinc-200/80 text-zinc-800 rounded-tl-xs shadow-zinc-200/30'
                  }`}
                >
                  {/* Header in Assistant Message */}
                  {!isUser && (
                    <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-zinc-100 text-[11px] font-bold text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-lime-600" />
                        <span className="text-zinc-700 dark:text-zinc-300">{msg.roleName || currentRole.name}</span>
                        {msg.modelUsed && (
                          <span className="px-1.5 py-0.2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[9px] font-mono text-zinc-600 dark:text-zinc-400">
                            {msg.modelUsed}
                          </span>
                        )}
                      </div>
                      <span>{msg.timestamp}</span>
                    </div>
                  )}

                  {/* Body Text */}
                  <div className="whitespace-pre-wrap font-sans text-sm select-text">
                    {msg.text}
                  </div>

                  {/* Footer / Copy Action */}
                  <div className="flex items-center justify-between pt-2 mt-1 text-[10px] opacity-75">
                    {isUser && <span className="text-zinc-400 text-right w-full">{msg.timestamp}</span>}
                    {!isUser && (
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => handleCopyText(msg.id, msg.text)}
                          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Kopírovať odpoveď"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Skopírované</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Kopírovať</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3.5 max-w-2xl mr-auto animate-fade-in">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-lime-600 to-emerald-500 text-white flex-shrink-0 flex items-center justify-center shadow-xs animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl rounded-tl-xs p-4 shadow-xs text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-3">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 rounded-full bg-lime-600 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-lime-600 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-lime-600 animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </span>
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                Gemini premýšľa ({selectedModel})...
              </span>
            </div>
          </div>
        )}

        {/* Error banner */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center justify-between gap-3">
            <span>{errorMessage}</span>
            <button
              onClick={() => handleSendMessage()}
              className="px-3 py-1 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
            >
              Skúsiť znova
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ✍️ BOTTOM INPUT BAR */}
      <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-t border-zinc-200/70 p-4 lg:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-3 bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 focus-within:border-lime-500 focus-within:ring-2 focus-within:ring-lime-100 transition-all shadow-inner"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Opýtajte sa na čokoľvek ohľadom regálov, cien, SOS... (Enter odošle)`}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 p-2 custom-scrollbar max-h-32"
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-3 bg-lime-600 hover:bg-lime-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl transition-all shadow-md active:scale-95 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
            title="Odoslať správu"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between pt-2 px-1 text-[10px] text-zinc-400">
          <span>
            Model: <strong className="text-zinc-600 dark:text-zinc-400">{selectedModel}</strong> • Rola: <strong className="text-zinc-600 dark:text-zinc-400">{currentRole.name}</strong>
          </span>
          <span>Shift + Enter pre nový riadok</span>
        </div>
      </div>

    </div>
  );
};
