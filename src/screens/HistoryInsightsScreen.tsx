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
          className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-2xl text-[#0A0A0A] dark:text-white hover:bg-[#FBFAF8] dark:hover:bg-[#FBFAF80f]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0A0A0A] dark:text-white tracking-tight">
            Post-Trip Memory & Insights
          </h1>
          <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">
            What PackSmart learned from your past trips to make every future trip lighter and smarter
          </p>
        </div>
      </div>

      {/* Top Insight KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-4 border border-[#0A0A0A1f] dark:border-[#FBFAF824] flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">Overall Packed</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-[#0A0A0A] dark:text-white mt-0.5">
              {insights.overallCompletion}%
            </p>
          </div>
          <ProgressRing percent={insights.overallCompletion} size={44} strokeWidth={4} progressColor="#BCD2CF" showLabel={false} />
        </div>

        <div className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-4 border border-[#0A0A0A1f] dark:border-[#FBFAF824]">
          <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">Memory Reviews</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#0A0A0A] dark:text-[#D5DCD9] mt-0.5">
            {memory.totalReviews}
          </p>
          <p className="text-[11px] text-[#0A0A0A] dark:text-[#FBFAF8] font-medium mt-0.5">
            active learning loops
          </p>
        </div>

        <div className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-4 border border-[#0A0A0A1f] dark:border-[#FBFAF824]">
          <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">Auto-Prioritized</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#0A0A0A] dark:text-white mt-0.5">
            {memory.frequentlyForgotten.length}
          </p>
          <p className="text-[11px] text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mt-0.5">
            past forgotten items
          </p>
        </div>

        <div className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-4 border border-[#0A0A0A1f] dark:border-[#FBFAF824]">
          <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">Bulk Flagged</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#0A0A0A] dark:text-white mt-0.5">
            {memory.frequentlyUnused.length}
          </p>
          <p className="text-[11px] text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mt-0.5">
            unused items spotted
          </p>
        </div>
      </div>

      {/* Post-Trip Memory Intelligence Panel */}
      <section className="rounded-3xl bg-[#0B3B40] text-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#0A0A0A]" />
          <h2 className="font-display text-lg font-bold">Active Learning from Past Trips</h2>
        </div>

        {memory.totalReviews === 0 ? (
          <p className="text-xs text-white/75">
            No post-trip memory reviews recorded yet. Open any trip and visit its "Memory" tab after returning to teach PackSmart what you forgot or left unused.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/10 space-y-2">
              <p className="text-xs font-bold text-[#D5DCD9]">Auto-Prioritized on New Trips (Forgotten Before)</p>
              {memory.frequentlyForgotten.length === 0 ? (
                <p className="text-xs text-white/60">No forgotten items logged.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {memory.frequentlyForgotten.map((f) => (
                    <li key={f.name} className="flex items-center justify-between">
                      <span>{f.name}</span>
                      <span className="font-mono text-[#0A0A0A] tabular-nums">{f.count}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-white/10 space-y-2">
              <p className="text-xs font-bold text-[#0A0A0A]">Flagged in Suitcase Optimizer (Packed & Unused)</p>
              {memory.frequentlyUnused.length === 0 ? (
                <p className="text-xs text-white/60">No unused items logged.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {memory.frequentlyUnused.map((u) => (
                    <li key={u.name} className="flex items-center justify-between">
                      <span>{u.name}</span>
                      <span className="font-mono text-[#0A0A0A] tabular-nums">{u.count}×</span>
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
          <h2 className="font-display text-lg font-bold text-[#0A0A0A] dark:text-white">
            Trip Reflection Notes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewedTrips.map((trip) => {
              const mem = trip.postTripMemory!;
              return (
                <div
                  key={trip.id}
                  className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-5 border border-[#0A0A0A1f] dark:border-[#FBFAF824] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[#0A0A0A] dark:text-[#D5DCD9]">
                        {trip.destination || trip.tripType} · Reviewed {mem.completedAt}
                      </p>
                      <h3 className="font-display text-base font-bold text-[#0A0A0A] dark:text-white">
                        {trip.title}
                      </h3>
                    </div>
                    <span className="flex items-center gap-1 font-mono text-xs font-bold text-[#0A0A0A]">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {mem.tripRating}/5
                    </span>
                  </div>

                  {mem.packDifferentlyNote && (
                    <p className="text-xs text-[#0A0A0A] dark:text-[#FBFAF8] leading-relaxed italic">
                      "{mem.packDifferentlyNote}"
                    </p>
                  )}

                  <div className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] space-y-1">
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
                    className="min-h-[38px] px-3.5 rounded-xl bg-[#D5DCD966] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#D5DCD9] text-xs font-semibold"
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
        <section className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-5 border border-[#0A0A0A1f] dark:border-[#FBFAF824] space-y-3.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#0A0A0A]" />
            <h2 className="font-display text-base font-bold text-[#0A0A0A] dark:text-white">
              Category Packing Completion
            </h2>
          </div>

          {insights.incompleteCategories.length === 0 ? (
            <p className="text-xs text-[#0A0A0A] dark:text-[#FBFAF8] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>All categories across your trips are 100% packed!</span>
            </p>
          ) : (
            <div className="space-y-3">
              {insights.incompleteCategories.slice(0, 6).map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0A0A0A] dark:text-white">{cat.category}</span>
                    <span className="font-mono tabular-nums text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">
                      {cat.packed}/{cat.total} ({cat.rate}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#FBFAF8] dark:bg-[#FBFAF80f] overflow-hidden">
                    <div className="h-full bg-[#0B3B40] rounded-full" style={{ width: `${cat.rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-5 border border-[#0A0A0A1f] dark:border-[#FBFAF824] space-y-3.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#0A0A0A]" />
            <h2 className="font-display text-base font-bold text-[#0A0A0A] dark:text-white">
              Currently Unpacked Across Trips
            </h2>
          </div>

          {insights.commonlyForgotten.length === 0 ? (
            <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">No pending unpacked items right now.</p>
          ) : (
            <div className="divide-y divide-[#0A0A0A1f] dark:divide-[#FBFAF824]">
              {insights.commonlyForgotten.map((entry) => (
                <div key={entry.name} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-[#0A0A0A] dark:text-[#FBFAF8] truncate">{entry.name}</span>
                  <span className="font-mono text-xs text-[#0A0A0A] dark:text-[#E6DFD2] tabular-nums shrink-0">
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
          <History className="w-4 h-4 text-[#0A0A0A]" />
          <h2 className="font-display text-lg font-bold text-[#0A0A0A] dark:text-white">
            Completed Trips Archive
          </h2>
        </div>

        {completedLists.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] p-6 text-center">
            <p className="text-sm font-semibold text-[#0A0A0A] dark:text-white">No archived trips yet</p>
            <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mt-1">
              Mark a trip done or save a Post-Trip Memory to archive it here for easy reuse.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedLists.map((list) => (
              <div
                key={list.id}
                className="rounded-3xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] p-5 space-y-3.5"
              >
                <div>
                  <p className="text-xs font-semibold text-[#0A0A0A] dark:text-[#FBFAF8]">
                    Completed {list.completedAt || list.endDate} · {list.tripType}
                  </p>
                  <h3 className="font-display text-base font-bold text-[#0A0A0A] dark:text-white truncate mt-0.5">
                    {list.title}
                  </h3>
                  <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mt-0.5">
                    {list.destination || 'Local'} · {list.items.length} items
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#0A0A0A1f] dark:border-[#FBFAF824]">
                  <button
                    type="button"
                    onClick={() => onDuplicateList(list.id)}
                    className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Reuse Trip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSaveAsTemplate(list)}
                    className="min-h-[42px] px-3.5 rounded-xl bg-[#D5DCD966] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#D5DCD9] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
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
