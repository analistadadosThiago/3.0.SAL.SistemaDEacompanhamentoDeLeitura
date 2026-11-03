import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { supabase } from '../supabaseClient';
import { MetricasPrincipais } from '../types';
import { 
  Brain, Loader2, Send, AlertCircle, 
  RefreshCw, Terminal, Search, User, Bot, 
  Cpu, Globe, Zap, MessageSquare, ArrowRight,
  ShieldCheck, Database, Layers, Code2
} from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const AnalistaIA: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [metricas, setMetricas] = useState<MetricasPrincipais | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useSearch, setUseSearch] = useState(false);
  
  const chatRef = useRef<Chat | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    "Resuma os principais impedimentos do mês",
    "Analise a produtividade rural vs urbana",
    "Identifique anomalias de faturamento",
    "Plano de ação para redução de impedimentos"
  ];

  const systemInstruction = `
VOCÊ É O "SAL_BRAIN" - NÚCLEO DE INTELIGÊNCIA DO SISTEMA DE ANÁLISE DE LEITURA.
FOCO: Diagnóstico técnico de indicadores de campo (UL, Matrícula, Razão de Impedimento).
ESTILO: Engenheiro sênior, direto, usa terminologia de BI e Utilities.
Sempre formate dados em tabelas markdown. Seja analítico e rigoroso com os números fornecidos.
`;

  const fetchMetricas = async () => {
    try {
      const { data, error } = await supabase.rpc('get_dashboard_filtrado', { p_ano: null, p_mes: null, p_rz: null });
      if (data && data.metricas) setMetricas(data.metricas);
    } catch (err) { console.error(err); }
  };

  const initChat = () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    chatRef.current = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction,
        tools: useSearch ? [{ googleSearch: {} }] : undefined
      }
    });
  };

  useEffect(() => {
    fetchMetricas();
    initChat();
  }, [useSearch]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const handleSendMessage = async (text?: string) => {
    const userText = text || inputValue;
    if (!userText.trim() || loading) return;

    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true); setError(null);

    try {
      if (!chatRef.current) initChat();
      const prompt = messages.length === 0 
        ? `ESTADO ATUAL DO SISTEMA SAL:\nCarga: ${metricas?.total_leituras}\nImpedimentos: ${metricas?.nao_realizadas}\nEfetividade: ${metricas?.realizadas}\nÍndice Geral: ${metricas?.perc_impedimentos}%\n\nUSER_QUERY: ${userText}`
        : userText;

      const result = await chatRef.current!.sendMessage({ message: prompt });
      setMessages(prev => [...prev, { role: 'model', text: result.text || "Critical Logic Failure: Null response." }]);
    } catch (err: any) { 
      setError("Conexão neural interrompida. Reinicie o núcleo."); 
      console.error(err);
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-10">
      {/* AI HEADER */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-400 to-emerald-400 group-hover:h-1.5 transition-all"></div>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-[#020617] rounded-2xl flex items-center justify-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/10 animate-[pulse_3s_infinite]"></div>
            <Brain className="w-9 h-9 text-blue-400 relative z-10" />
            <div className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full border border-white"></div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">SAL_BRAIN Engine</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-blue-500" /> GEMINI_V3_PREVIEW
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setUseSearch(!useSearch)} 
             className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${useSearch ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
           >
             <Globe className="w-3.5 h-3.5" /> Web Intelligence: {useSearch ? 'ON' : 'OFF'}
           </button>
           <button onClick={() => { setMessages([]); initChat(); }} className="p-2.5 text-slate-400 hover:text-red-600 bg-slate-50 rounded-xl transition-all border border-slate-200">
             <RefreshCw className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* CHAT INTERFACE */}
      <div className="bg-[#020617] rounded-[3.5rem] border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col h-[750px] relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        
        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar relative z-10" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-10 animate-fade-in">
              <div className="space-y-4">
                <div className="w-20 h-20 bg-blue-500/5 rounded-full border border-blue-500/10 flex items-center justify-center mx-auto relative group">
                   <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping group-hover:animate-none"></div>
                   <Terminal className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-white font-black text-2xl uppercase tracking-tighter italic">Inicializando Núcleo de Auditoria</h3>
                <p className="text-white/30 text-[9px] max-w-sm mx-auto uppercase tracking-widest font-bold leading-relaxed">Sincronizado com o banco de dados principal. Processamento de indicadores operacionais disponível.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-6">
                 {quickPrompts.map((q, i) => (
                   <button key={i} onClick={() => handleSendMessage(q)} className="p-5 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black text-white/50 uppercase text-left hover:bg-blue-600 hover:text-white transition-all flex items-center justify-between group backdrop-blur-md">
                     {q} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                   </button>
                 ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`max-w-[85%] flex gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xl ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-800 border border-white/10'}`}>
                    {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div className={`p-8 rounded-[2.5rem] text-sm leading-relaxed shadow-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none font-mono'}`}>
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
               <div className="bg-white/5 p-8 rounded-[2.5rem] rounded-tl-none border border-white/10 flex items-center gap-4">
                 <div className="flex gap-1.5">
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                 </div>
                 <span className="text-[10px] font-black text-blue-400/50 uppercase tracking-[0.3em] ml-2">Neural_Processing...</span>
               </div>
            </div>
          )}
        </div>

        <div className="p-10 bg-black/40 border-t border-white/5 backdrop-blur-3xl relative z-20">
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative max-w-4xl mx-auto group">
            <input 
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Digite sua dúvida técnica ou peça uma análise de carga..."
              className="w-full bg-white/5 border border-white/10 rounded-3xl py-6 pl-10 pr-24 text-white font-medium outline-none focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:text-white/20 shadow-2xl"
            />
            <button type="submit" disabled={loading || !inputValue.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-500 disabled:opacity-30 transition-all shadow-xl shadow-blue-500/20 active:scale-95">
              <Send className="w-6 h-6" />
            </button>
          </form>
          <div className="flex justify-center gap-10 mt-8">
             <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.25em] flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5"/> Security: SSL_AES_256</span>
             <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.25em] flex items-center gap-2"><Database className="w-3.5 h-3.5"/> Sync: Live_Database</span>
             <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.25em] flex items-center gap-2"><Layers className="w-3.5 h-3.5"/> Mode: Technical_Audit</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalistaIA;