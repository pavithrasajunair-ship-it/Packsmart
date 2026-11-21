import React, { useMemo } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookmarkPlus,
  Brain,
  CheckCircle2,
  Copy,
  History,
  Star,
  TrendingUp,
} from 'lucide-react';
import type { PackingList } from '../types';
import { computePackingInsights, extractMemoryInsights } from '../utils/packingEngine';
import { ProgressRing } from '../components/ui/ProgressRing';

interface HistoryInsightsScreenProps {
  lists: PackingList[];
  onBack: () => void;
  onOpenList: (listId: string, subTab?: 'checklist' | 'memory') => void;
  onDuplicateList: (listId: string) => void;
  onSaveAsTemplate: (list: PackingList) => void;
}

export const HistoryInsightsScreen: React.FC<HistoryInsightsScreenProps> = ({
  lists,
  onBack,
  onOpenList,
  onDuplicateList,
  onSaveAsTemplate,
}) => {
  const insights = useMemo(() => computePackingInsights(lists), [lists]);
  const memory = useMemo(() => extractMemoryInsights(lists), [lists]);
  const reviewedTrips = useMemo(
    () => lists.filter((l) => Boolean(l.postTripMemory)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [lists]
  );
  const completedLists = useMemo(
    () => lists.filter((l) => l.completed).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [lists]
  );

  return (
    <div className="space-y-6 pb-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-2xl text-[#111834] dark:text-white hover:bg-[#EDEAE3] dark:hover:bg-[#1B2344]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#111834] dark:text-white tracking-tight">
            Post-Trip Memory & Insights
          </h1>
          <p className="text-xs text-[#646B84] dark:text-[#9AA3C2]">
            What PackSmart learned from your past trips to make every future trip lighter and smarter
          </p>
        </div>
      </div>

      {/* Top Insight KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#131A33] rounded-3xl p-4 border border-[#E6E2DA] dark:border-[#242E52] flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-[#646B84] dark:text-[#9AA3C2]">Overall Packed</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-[#111834] dark:text-white mt-0.5">
              {insights.overallCompletion}%
            </p>
          </div>
          <ProgressRing percent={insights.overallCompletion} size={44} strokeWidth={4} progressColor="#0F968C" showLabel={false} />
        </div>

        <div className="bg-white dark:bg-[#131A33] rounded-3xl p-4 border border-[#E6E2DA] dark:border-[#242E52]">
          <p className="text-xs text-[#646B84] dark:text-[#9AA3C2]">Memory Reviews</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#5645D2] dark:text-[#A799FF] mt-0.5">
            {memory.totalReviews}
          </p>
          <p className="text-[11px] text-[#0F968C] dark:text-[#2AB5A8] font-medium mt-0.5">
            active learning loops
          </p>
        </div>

        <div className="bg-white dark:bg-[#131A33] rounded-3xl p-4 border border-[#E6E2DA] dark:border-[#242E52]">
          <p className="text-xs text-[#646B84] dark:text-[#9AA3C2]">Auto-Prioritized</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#111834] dark:text-white mt-0.5">
            {memory.frequentlyForgotten.length}
          </p>
          <p className="text-[11px] text-[#646B84] dark:text-[#9AA3C2] mt-0.5">
            past forgotten items
          </p>
        </div>

        <div className="bg-white dark:bg-[#131A33] rounded-3xl p-4 border border-[#E6E2DA] dark:border-[#242E52]">
          <p className="text-xs text-[#646B84] dark:text-[#9AA3C2]">Bulk Flagged</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#111834] dark:text-white mt-0.5">
            {memory.frequentlyUnused.length}
          </p>
          <p className="text-[11px] text-[#646B84] dark:text-[#9AA3C2] mt-0.5">
            unused items spotted
          </p>
        </div>
      </div>

      {/* Post-Trip Memory Intelligence Panel */}
      <section className="rounded-3xl bg-[#111834] text-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#2AB5A8]" />
          <h2 className="font-display text-lg font-bold">Active Learning from Past Trips</h2>
        </div>

        {memory.totalReviews === 0 ? (
          <p className="text-xs text-white/75">
            No post-trip memory reviews recorded yet. Open any trip and visit its "Memory" tab after returning to teach PackSmart what you forgot or left unused.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/10 space-y-2">
              <p className="text-xs font-bold text-[#D1C9FF]">Auto-Prioritized on New Trips (Forgotten Before)</p>
              {memory.frequentlyForgotten.length === 0 ? (
                <p className="text-xs text-white/60">No forgotten items logged.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {memory.frequentlyForgotten.map((f) => (
                    <li key={f.name} className="flex items-center justify-between">
                      <span>{f.name}</span>
                      <span className="font-mono text-[#2AB5A8] tabular-nums">{f.count}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-white/10 space-y-2">
              <p className="text-xs font-bold text-[#FCD34D]">Flagged in Suitcase Optimizer (Packed & Unused)</p>
              {memory.frequentlyUnused.length === 0 ? (
                <p className="text-xs text-white/60">No unused items logged.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {memory.frequentlyUnused.map((u) => (
                    <li key={u.name} className="flex items-center justify-between">
                      <span>{u.name}</span>
                      <span className="font-mono text-[#FCD34D] tabular-nums">{u.count}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Recorded Post-Trip Reviews */}
      {reviewedTrips.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-[#111834] dark:text-white">
            Trip Reflection Notes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewedTrips.map((trip) => {
              const mem = trip.postTripMemory!;
              return (
                <div
                  key={trip.id}
                  className="bg-white dark:bg-[#131A33] rounded-3xl p-5 border border-[#E6E2DA] dark:border-[#242E52] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[#5645D2] dark:text-[#A799FF]">
                        {trip.destination || trip.tripType} · Reviewed {mem.completedAt}
                      </p>
                      <h3 className="font-display text-base font-bold text-[#111834] dark:text-white">
                        {trip.title}
                      </h3>
                    </div>
                    <span className="flex items-center gap-1 font-mono text-xs font-bold text-[#D97706]">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {mem.tripRating}/5
                    </span>
                  </div>

                  {mem.packDifferentlyNote && (
                    <p className="text-xs text-[#353C54] dark:text-[#D5DBEE] leading-relaxed italic">
                      "{mem.packDifferentlyNote}"
                    </p>
                  )}

                  <div className="text-xs text-[#646B84] dark:text-[#9AA3C2] space-y-1">
                    {mem.forgotItems.length > 0 && (
                      <p>Forgot: {mem.forgotItems.join(', ')}</p>
                    )}
                    {mem.unusedItems.length > 0 && (
                      <p>Unused: {mem.unusedItems.join(', ')}</p>
                    )}
                    {mem.wishedItems.length > 0 && (
                      <p>Wished I had: {mem.wishedItems.join(', ')}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenList(trip.id, 'memory')}
                    className="min-h-[38px] px-3.5 rounded-xl bg-[#F4F2FF] dark:bg-[#1B2344] text-[#5645D2] dark:text-[#BDB2FF] text-xs font-semibold"
                  >
                    Edit Trip Memory
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Incomplete Categories & Commonly Unpacked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white dark:bg-[#131A33] rounded-3xl p-5 border border-[#E6E2DA] dark:border-[#242E52] space-y-3.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#6E5DE7]" />
            <h2 className="font-display text-base font-bold text-[#111834] dark:text-white">
              Category Packing Completion
            </h2>
          </div>

          {insights.incompleteCategories.length === 0 ? (
            <p className="text-xs text-[#0F968C] dark:text-[#2AB5A8] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>All categories across your trips are 100% packed!</span>
            </p>
          ) : (
            <div className="space-y-3">
              {insights.incompleteCategories.slice(0, 6).map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#111834] dark:text-white">{cat.category}</span>
                    <span className="font-mono tabular-nums text-[#646B84] dark:text-[#9AA3C2]">
                      {cat.packed}/{cat.total} ({cat.rate}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#ECE8E0] dark:bg-[#1E2747] overflow-hidden">
                    <div className="h-full bg-[#6E5DE7] rounded-full" style={{ width: `${cat.rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-[#131A33] rounded-3xl p-5 border border-[#E6E2DA] dark:border-[#242E52] space-y-3.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
            <h2 className="font-display text-base font-bold text-[#111834] dark:text-white">
              Currently Unpacked Across Trips
            </h2>
          </div>

          {insights.commonlyForgotten.length === 0 ? (
            <p className="text-xs text-[#646B84] dark:text-[#9AA3C2]">No pending unpacked items right now.</p>
          ) : (
            <div className="divide-y divide-[#F0EDE7] dark:divide-[#202948]">
              {insights.commonlyForgotten.map((entry) => (
                <div key={entry.name} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-[#111834] dark:text-[#F4F3EF] truncate">{entry.name}</span>
                  <span className="font-mono text-xs text-[#B45309] dark:text-[#FBBF24] tabular-nums shrink-0">
                    {entry.count} trip{entry.count === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Completed Trip Archive */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#0F968C]" />
          <h2 className="font-display text-lg font-bold text-[#111834] dark:text-white">
            Completed Trips Archive
          </h2>
        </div>

        {completedLists.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] p-6 text-center">
            <p className="text-sm font-semibold text-[#111834] dark:text-white">No archived trips yet</p>
            <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-1">
              Mark a trip done or save a Post-Trip Memory to archive it here for easy reuse.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedLists.map((list) => (
              <div
                key={list.id}
                className="rounded-3xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] p-5 space-y-3.5"
              >
                <div>
                  <p className="text-xs font-semibold text-[#0F968C] dark:text-[#2AB5A8]">
                    Completed {list.completedAt || list.endDate} · {list.tripType}
                  </p>
                  <h3 className="font-display text-base font-bold text-[#111834] dark:text-white truncate mt-0.5">
                    {list.title}
                  </h3>
                  <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-0.5">
                    {list.destination || 'Local'} · {list.items.length} items
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#F1EFEA] dark:border-[#202948]">
                  <button
                    type="button"
                    onClick={() => onDuplicateList(list.id)}
                    className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#111834] dark:bg-[#6E5DE7] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Reuse Trip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSaveAsTemplate(list)}
                    className="min-h-[42px] px-3.5 rounded-xl bg-[#F4F2FF] dark:bg-[#1B2344] text-[#5645D2] dark:text-[#BDB2FF] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Save Template</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
