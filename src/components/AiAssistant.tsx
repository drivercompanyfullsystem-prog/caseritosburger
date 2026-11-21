'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { Product } from '../types';

interface AiAssistantProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  sender: 'ai' | 'user';
  text: string;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ products, isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: '¡Hola! 🍔 Soy **CaceriBot IA**, tu asistente de **Caseritos Burguer**.\n\n¿Buscas una recomendación según tu presupuesto, antojo o cantidad de personas? ¡Pregúntame lo que quieras!',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMsg: Message = { sender: 'user', text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          menuContext: products,
        }),
      });

      const data = await res.json();
      const aiReply: Message = {
        sender: 'ai',
        text: data.reply || 'Disculpa, no pude procesar tu solicitud.',
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: 'Ocurrió un error al conectar con CaceriBot. Por favor intenta de nuevo en unos instantes.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const presetQuestions = [
    '🍔 Recomiéndame un combo para 2',
    '🥓 Opciones con extra panceta/bacon',
    '💰 Tengo 50.000 Gs, ¿qué me alcanza?',
    '🍟 ¿Qué guarnición es la más pedida?',
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="relative bg-zinc-950 border border-purple-500/30 rounded-t-3xl sm:rounded-3xl max-w-lg w-full h-[85vh] sm:h-[600px] text-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-gradient-to-r from-purple-950/40 via-zinc-900 to-orange-950/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-orange-500 flex items-center justify-center shadow-lg shadow-purple-900/30">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base">CaceriBot IA</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Gemini API
                </span>
              </div>
              <p className="text-xs text-zinc-400">Recomendaciones & Asistente de Menú</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-orange-600/30 border border-orange-500/40 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-orange-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-tr-none'
                    : 'bg-zinc-900/90 border border-zinc-800 text-zinc-200 rounded-tl-none shadow-sm'
                }`}
              >
                {msg.text}
              </div>
              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-zinc-400" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center space-x-2 text-zinc-400 text-xs py-2">
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
              <span>CaceriBot está pensando tu recomendación...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/50 flex gap-2 overflow-x-auto no-scrollbar">
          {presetQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(q)}
              className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition flex-shrink-0"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center space-x-2">
          <input
            type="text"
            placeholder="Pregúntale a CaceriBot sobre el menú..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-purple-500 text-white placeholder-zinc-500"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading}
            className="p-3 rounded-xl bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-500 hover:to-orange-500 text-white disabled:opacity-50 transition shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
