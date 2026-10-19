import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  Paperclip, 
  FileSpreadsheet, 
  X, 
  Maximize2, 
  Minimize2, 
  Trash2, 
  Copy, 
  Check, 
  FileText, 
  Layers, 
  ChevronRight,
  Database,
  ArrowDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Order, UploadedDataset, AIAgentMessage } from '../types';
import type { ReadyGoodItem } from '../services/readyGoodsService';
import type { ReadyStockItem } from '../services/readyStockService';
import type { ReceivableItem } from '../services/receivableListService';
import { askAIAgent, type PlantAllData } from '../services/geminiService';

interface AIAgentChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  readyGoods?: ReadyGoodItem[];
  readyStock?: ReadyStockItem[];
  receivables?: ReceivableItem[];
  kpis?: any;
}

const DEFAULT_INITIAL_MESSAGE: AIAgentMessage = {
  id: 'welcome-msg',
  author: 'ai',
  content: `Hi! How can I help you with your production orders or files today?`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export const AIAgentChatDrawer: React.FC<AIAgentChatDrawerProps> = ({
  isOpen,
  onClose,
  orders,
  readyGoods = [],
  readyStock = [],
  receivables = [],
  kpis
}) => {
  const [messages, setMessages] = useState<AIAgentMessage[]>([DEFAULT_INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadedDataset, setUploadedDataset] = useState<UploadedDataset | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isLoading]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Process and parse uploaded file (Excel, CSV, JSON, TXT)
  const processUploadedFile = async (file: File) => {
    try {
      setIsLoading(true);
      const fileName = file.name;
      const fileSize = file.size;
      const ext = fileName.split('.').pop()?.toLowerCase();

      let rowCount = 0;
      let columns: string[] = [];
      let previewRows: Record<string, any>[] = [];
      let summary = '';

      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        rowCount = json.length;
        if (json.length > 0) {
          columns = Object.keys(json[0]);
          previewRows = json.slice(0, 150); // Keep 150 representative rows
        }
        summary = `Sheet "${sheetName}" with ${rowCount} rows and ${columns.length} columns: ${columns.slice(0, 6).join(', ')}`;
      } else if (ext === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          rowCount = parsed.length;
          columns = parsed.length > 0 && typeof parsed[0] === 'object' ? Object.keys(parsed[0]) : ['Value'];
          previewRows = parsed.slice(0, 150);
        } else {
          rowCount = 1;
          columns = Object.keys(parsed);
          previewRows = [parsed];
        }
        summary = `JSON dataset with ${rowCount} records.`;
      } else {
        // Plain text / log file
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        rowCount = lines.length;
        columns = ['LineText'];
        previewRows = lines.slice(0, 100).map((line, idx) => ({ lineNo: idx + 1, content: line }));
        summary = `Plain text file with ${rowCount} lines.`;
      }

      const dataset: UploadedDataset = {
        fileName,
        fileSize,
        rowCount,
        columns,
        summary,
        previewRows,
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setUploadedDataset(dataset);

      // Add system confirmation message in chat
      const confirmMsg: AIAgentMessage = {
        id: `upload-${Date.now()}`,
        author: 'ai',
        content: `Uploaded **${fileName}** (${rowCount} rows). What would you like to know about it?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, confirmMsg]);
    } catch (err: any) {
      console.error('Error parsing uploaded file:', err);
      const errMsg: AIAgentMessage = {
        id: `err-${Date.now()}`,
        author: 'ai',
        content: `Could not parse **${file.name}**. Please verify it is a valid Excel or CSV file.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: AIAgentMessage = {
      id: `user-${Date.now()}`,
      author: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const plantData: PlantAllData = {
        orders,
        readyGoods,
        readyStock,
        receivables,
        kpis
      };

      const response = await askAIAgent(query, messages, plantData, uploadedDataset);

      const aiMsg: AIAgentMessage = {
        id: `ai-${Date.now()}`,
        author: 'ai',
        content: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourcesCited: response.sources,
        suggestedFollowups: response.followups
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Error in AI Agent chat:', err);
      const errorMsg: AIAgentMessage = {
        id: `err-${Date.now()}`,
        author: 'ai',
        content: `I encountered an unexpected issue processing your request. Based on current records, you have ${orders.length} orders tracked in PMS. Please try asking about a specific OPF number or stage bottleneck.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourcesCited: ['Plant Data Fallback']
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear current AI Agent conversation history?')) {
      setMessages([DEFAULT_INITIAL_MESSAGE]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex justify-end">
      {/* Backdrop (visible only when expanded or on mobile) */}
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 pointer-events-auto ${
          isExpanded ? 'opacity-100' : 'opacity-0 md:hidden'
        }`}
        onClick={onClose}
      />

      {/* Floating / Docked Chat Panel */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative pointer-events-auto bg-white flex flex-col h-full shadow-2xl border-l border-slate-200 transition-all duration-300 ease-in-out ${
          isExpanded 
            ? 'w-full md:w-[850px] max-w-full' 
            : 'w-full md:w-[480px] max-w-full'
        }`}
      >
        {/* DRAG OVERLAY */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-indigo-600/90 backdrop-blur-xs flex flex-col items-center justify-center text-white p-6 text-center animate-fade-in">
            <FileSpreadsheet className="w-16 h-16 mb-4 animate-bounce" />
            <h3 className="text-xl font-semibold mb-1">Drop your file here</h3>
            <p className="text-sm text-indigo-100 max-w-sm">
              Supports Excel (.xlsx, .xls), CSV, JSON, and text datasets. The AI will analyze and ground answers in your uploaded data.
            </p>
          </div>
        )}

        {/* 1. HEADER */}
        <header className="px-5 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm text-slate-900 leading-tight">Operations Assistant</h2>
              <p className="text-[13px] text-slate-500 leading-tight">Ask questions about orders or files</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClearHistory}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Clear Conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="hidden md:flex p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 2. ATTACHED FILE STATUS (ONLY WHEN FILE IS UPLOADED) */}
        {uploadedDataset && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[13px] text-slate-700 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate font-medium">{uploadedDataset.fileName}</span>
              <span className="text-slate-500 text-[13px] shrink-0">({uploadedDataset.rowCount} rows)</span>
            </div>
            <button
              onClick={() => setUploadedDataset(null)}
              className="text-[13px] text-slate-500 hover:text-rose-600 p-1 rounded cursor-pointer"
              title="Remove file"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processUploadedFile(e.target.files[0]);
            }
          }}
        />

        {/* 3. MESSAGES SCROLL AREA */}
        <main className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.author === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-end gap-2 max-w-[90%]">
                {msg.author === 'ai' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 mb-1 shadow-2xs">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div 
                  className={`rounded-2xl p-3.5 text-[13px] leading-relaxed shadow-2xs relative group ${
                    msg.author === 'user'
                      ? 'bg-slate-900 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  {/* Copy button */}
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className={`absolute top-2 right-2 p-1 rounded-md transition-opacity opacity-0 group-hover:opacity-100 ${
                      msg.author === 'user' 
                        ? 'text-slate-500 hover:text-white hover:bg-slate-800' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    title="Copy message"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>

                  <div className="prose prose-xs max-w-none prose-slate whitespace-pre-wrap leading-relaxed pr-5">
                    {msg.content}
                  </div>

                  <div className={`text-[13px] mt-1.5 font-medium ${msg.author === 'user' ? 'text-slate-500' : 'text-slate-500'}`}>
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Thinking / Loading Indicator */}
          {isLoading && (
            <div className="flex items-start gap-2 max-w-[80%]">
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 shadow-2xs">
                <div className="flex items-center space-x-1.5 py-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

        {/* 4. FOOTER / INPUT */}
        <footer className="p-3.5 border-t border-slate-200 bg-white shrink-0">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-400 transition-all shadow-2xs"
          >
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask a question (e.g. an order number, or what is holding up production)..."
              className="w-full bg-transparent text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none resize-none px-1 py-0.5"
              disabled={isLoading}
            />

            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 px-2 py-1 rounded-md transition-colors cursor-pointer"
                  title="Attach Excel or CSV file"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Attach file</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 disabled:opacity-30 text-white rounded-lg text-[13px] font-semibold shadow-2xs transition-all cursor-pointer shrink-0"
              >
                <span>Send</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </form>
        </footer>
      </div>
    </div>
  );
};
