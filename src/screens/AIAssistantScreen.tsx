import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  WifiOff,
} from 'lucide-react';
import type { AIChatMessage, AISuggestedItem, PackingItem, PackingList } from '../types';
import {
  calculateTripDays,
  estimateItemVolumeLiters,
  generateOfflineAssistantAdvice,
} from '../utils/packingEngine';
import { uid } from '../utils/storage';

interface AIAssistantScreenProps {
  lists: PackingList[];
  initialListId?: string;
  messages: AIChatMessage[];
  isOnline: boolean;
  aiConfigured: boolean;
  onBack: () => void;
  onSaveMessages: (messages: AIChatMessage[]) => void;
  onAddItemToList: (listId: string, item: PackingItem) => boolean;
}

const PROMPT_SUGGESTIONS = [
  'What should I pack for five days in Kerala?',
  "I'm travelling during the monsoon. What should I carry?",
  'What essentials do I need for my first hostel stay?',
  'Create a minimalist packing list for a weekend trip.',
  'What am I likely to forget?',
];

export const AIAssistantScreen: React.FC<AIAssistantScreenProps> = ({
  lists,
  initialListId,
  messages,
  isOnline,
  aiConfigured,
  onBack,
  onSaveMessages,
  onAddItemToList,
}) => {
  const [selectedListId, setSelectedListId] = useState<string>(
    initialListId || lists.find((l) => !l.completed)?.id || lists[0]?.id || ''
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [statusNotice, setStatusNotice] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const activeList = useMemo(
    () => lists.find((l) => l.id === selectedListId) || null,
    [lists, selectedListId]
  );

  const sendQuestion = async (questionText: string) => {
    const clean = questionText.trim();
    if (!clean || loading) return;

    const userMsg: AIChatMessage = {
      id: uid('msg'),
      role: 'user',
      content: clean,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMsg];
    onSaveMessages(nextHistory);
    setInput('');
    setStatusNotice('');
    setLoading(true);

    try {
      let reply = '';
      let suggestedItems: AISuggestedItem[] = [];
      let forgottenAlerts: string[] = [];
      let source: 'gemini' | 'offline_rules' = 'offline_rules';

      if (isOnline && aiConfigured) {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: clean,
            listContext: activeList
              ? {
                  title: activeList.title,
                  destination: activeList.destination,
                  mode: activeList.mode,
                  days: calculateTripDays(activeList.startDate, activeList.endDate),
                  travellers: activeList.travellers,
                  weatherSummary: activeList.weather
                    ? `${activeList.weather.shortLocation}: ${activeList.weather.summary.avgLow}°C–${activeList.weather.summary.avgHigh}°C, ${activeList.weather.summary.maxRainChance}% rain chance, ${activeList.weather.summary.primaryCondition}`
                    : 'Not loaded',
                  existingItems: activeList.items.map((i) => i.name),
                }
              : undefined,
          }),
        });

        const data = await res.json();
        if (res.ok && data.source === 'gemini') {
          reply = data.reply;
          suggestedItems = Array.isArray(data.suggestedItems) ? data.suggestedItems : [];
          forgottenAlerts = Array.isArray(data.forgottenAlerts) ? data.forgottenAlerts : [];
          source = 'gemini';
        } else {
          setStatusNotice(
            data.error ||
              'Live PackSmart AI is temporarily unavailable. Showing Offline Smart Rules Advisor results instead.'
          );
          const fallback = generateOfflineAssistantAdvice(clean, activeList);
          reply = fallback.reply;
          suggestedItems = fallback.suggestedItems;
          forgottenAlerts = fallback.forgottenAlerts;
          source = 'offline_rules';
        }
      } else {
        const fallback = generateOfflineAssistantAdvice(clean, activeList);
        reply = fallback.reply;
        suggestedItems = fallback.suggestedItems;
        forgottenAlerts = fallback.forgottenAlerts;
        source = 'offline_rules';
      }

      const assistantMsg: AIChatMessage = {
        id: uid('msg'),
        role: 'assistant',
        content: reply,
        source,
        suggestedItems,
        forgottenAlerts,
        timestamp: new Date().toISOString(),
      };
      onSaveMessages([...nextHistory, assistantMsg]);
      window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch {
      setStatusNotice('Connection interrupted. Answered using the Offline Smart Rules Advisor.');
      const fallback = generateOfflineAssistantAdvice(clean, activeList);
      const assistantMsg: AIChatMessage = {
        id: uid('msg'),
        role: 'assistant',
        content: fallback.reply,
        source: 'offline_rules',
        suggestedItems: fallback.suggestedItems,
        forgottenAlerts: fallback.forgottenAlerts,
        timestamp: new Date().toISOString(),
      };
      onSaveMessages([...nextHistory, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuggestion = (sug: AISuggestedItem) => {
    if (!activeList) return;
    const key = `${activeList.id}:${sug.name.toLowerCase()}`;
    const cat = sug.category || 'Miscellaneous';
    const grams = Math.max(0, Number(sug.weightGrams) || 150);
    const added = onAddItemToList(activeList.id, {
      id: uid('ai-it'),
      name: sug.name,
      category: cat,
      quantity: Math.max(1, Number(sug.quantity) || 1),
      packed: false,
      weightGrams: grams,
      volumeLiters: estimateItemVolumeLiters(cat, grams),
      priority: 'Helpful',
      notes: sug.reason,
      aiRecommended: true,
      order: activeList.items.length,
    });
    if (added) {
      setAddedKeys((prev) => new Set(prev).add(key));
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#EAE6DE] dark:border-[#222B4C]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-2xl text-[#111834] dark:text-white hover:bg-[#EDEAE3] dark:hover:bg-[#1B2344]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-xl font-extrabold text-[#111834] dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6E5DE7]" />
              <span>PackSmart AI</span>
            </h1>
            <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] truncate">
              {isOnline && aiConfigured
                ? 'Live AI Assistant · Connected via server'
                : 'Offline Smart Rules Advisor · No cloud key active'}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => onSaveMessages([])}
            aria-label="Clear chat"
            className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-[#7D849E] hover:text-[#DC2626] flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Active List Context Selector */}
      <div className="py-3 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="ai-list-ctx" className="text-xs font-semibold text-[#646B84] dark:text-[#9AA3C2]">
          Tailor suggestions & add items to:
        </label>
        <select
          id="ai-list-ctx"
          value={selectedListId}
          onChange={(e) => setSelectedListId(e.target.value)}
          className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] text-xs font-semibold text-[#111834] dark:text-white max-w-[260px]"
        >
          {lists.length === 0 && <option value="">No packing lists yet</option>}
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title} ({l.items.length} items)
            </option>
          ))}
        </select>
      </div>

      {(!isOnline || !aiConfigured || statusNotice) && (
        <div className="mb-3 p-3 rounded-2xl bg-[#F4F2FF] dark:bg-[#191F40] border border-[#E2DCFF] dark:border-[#2C3566] text-xs text-[#3F4560] dark:text-[#C5CBE3] flex items-start gap-2">
          <WifiOff className="w-4 h-4 text-[#5645D2] dark:text-[#A799FF] shrink-0 mt-0.5" />
          <span>
            {statusNotice ||
              (!isOnline
                ? 'You are offline. PackSmart is running its local Smart Rules Advisor until connectivity returns.'
                : 'Cloud AI model key is not set on the server. Using PackSmart Offline Smart Rules Advisor for contextual suggestions.')}
          </span>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {messages.length === 0 ? (
          <div className="py-4 space-y-5">
            <div className="bg-white dark:bg-[#131A33] rounded-3xl p-5 border border-[#E6E2DA] dark:border-[#242E52]">
              <h2 className="font-display text-base font-bold text-[#111834] dark:text-white">
                Ask anything about what to pack
              </h2>
              <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-1 leading-relaxed">
                PackSmart checks your attached list to prevent duplicate suggestions, explains why each item matters, and lets you add recommendations in one tap.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#646B84] dark:text-[#9AA3C2]">
                Try asking:
              </p>
              <div className="flex flex-col gap-2">
                {PROMPT_SUGGESTIONS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendQuestion(prompt)}
                    className="min-h-[46px] px-4 py-3 rounded-2xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] hover:border-[#6E5DE7] text-left text-sm font-medium text-[#111834] dark:text-[#F4F3EF] transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-3xl px-4 py-3.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#111834] dark:bg-[#6E5DE7] text-white rounded-br-lg'
                    : 'bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] text-[#111834] dark:text-[#F4F3EF] rounded-bl-lg'
                }`}
              >
                {msg.role === 'assistant' && (
                  <p className="text-[11px] font-semibold text-[#5645D2] dark:text-[#A799FF] mb-1">
                    {msg.source === 'gemini' ? 'PackSmart AI · Gemini' : 'PackSmart · Offline Smart Rules Advisor'}
                  </p>
                )}
                <p>{msg.content}</p>

                {/* Suggested Items with 1-tap Add */}
                {msg.suggestedItems && msg.suggestedItems.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-[#EFECE6] dark:border-[#222B4C] space-y-2.5">
                    <p className="text-xs font-bold text-[#111834] dark:text-white">
                      Recommended Items
                    </p>
                    {msg.suggestedItems.map((sug) => {
                      const alreadyInList =
                        activeList?.items.some(
                          (i) => i.name.trim().toLowerCase() === sug.name.trim().toLowerCase()
                        ) || addedKeys.has(`${selectedListId}:${sug.name.toLowerCase()}`);

                      return (
                        <div
                          key={sug.name}
                          className="p-3 rounded-2xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#EAE6DE] dark:border-[#222B4C] flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#111834] dark:text-white">
                              {sug.name}{' '}
                              <span className="font-mono font-normal text-[#646B84]">×{sug.quantity}</span>
                            </p>
                            <p className="text-[11px] text-[#646B84] dark:text-[#9AA3C2] mt-0.5">
                              {sug.category} · {sug.reason}
                            </p>
                          </div>
                          {activeList && (
                            <button
                              type="button"
                              disabled={alreadyInList}
                              onClick={() => handleAddSuggestion(sug)}
                              className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                                alreadyInList
                                  ? 'bg-[#ECFDF5] dark:bg-[#123029] text-[#059669] dark:text-[#34D399]'
                                  : 'bg-[#111834] dark:bg-[#6E5DE7] text-white'
                              }`}
                            >
                              {alreadyInList ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Added</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Commonly Forgotten Alerts */}
                {msg.forgottenAlerts && msg.forgottenAlerts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#EFECE6] dark:border-[#222B4C] space-y-1.5">
                    <p className="text-xs font-bold text-[#B45309] dark:text-[#FBBF24] flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Easy to forget</span>
                    </p>
                    <ul className="space-y-1 text-xs text-[#505770] dark:text-[#B4BCD9]">
                      {msg.forgottenAlerts.map((alert) => (
                        <li key={alert}>• {alert}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#5645D2] dark:text-[#A799FF] px-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analyzing trip context & avoiding duplicates...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendQuestion(input);
        }}
        className="pt-2.5 border-t border-[#EAE6DE] dark:border-[#222B4C] flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask PackSmart AI about weather, hostel, or essentials..."
          aria-label="Ask PackSmart AI"
          className="flex-1 min-h-[48px] px-4 rounded-2xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] text-sm text-[#111834] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6E5DE7]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send question"
          className="min-h-[48px] min-w-[48px] rounded-2xl bg-[#111834] dark:bg-[#6E5DE7] text-white flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
