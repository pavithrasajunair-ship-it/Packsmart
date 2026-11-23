import React, { useMemo, useState } from 'react';
import {
  Brain,
  CalendarClock,
  ChevronRight,
  Copy,
  DoorClosed,
  History,
  Luggage,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import type { DocumentRecord, PackingList, TripType } from '../types';
import { daysUntilDate, evaluateTripDocumentReadiness } from '../utils/packingEngine';
import type { DetailSubTab } from './ListDetailScreen';
import { ProgressRing } from '../components/ui/ProgressRing';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface ListsScreenProps {
  lists: PackingList[];
  documents: DocumentRecord[];
  onOpenList: (listId: string, subTab?: DetailSubTab) => void;
  onDuplicateList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onOpenCreate: () => void;
  onOpenHistory: () => void;
}

const TRIP_FILTERS: Array<'All' | TripType> = ['All', 'Vacation', 'Business', 'Adventure', 'College', 'Family', 'Other'];

export const ListsScreen: React.FC<ListsScreenProps> = ({
  lists,
  documents,
  onOpenList,
  onDuplicateList,
  onDeleteList,
  onOpenCreate,
  onOpenHistory,
}) => {
  const [typeFilter, setTypeFilter] = useState<'All' | TripType>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'shared' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PackingList | null>(null);

  const filteredLists = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lists
      .filter((l) => {
        if (typeFilter !== 'All' && l.tripType !== typeFilter) return false;
        if (statusFilter === 'active' && l.completed) return false;
        if (statusFilter === 'completed' && !l.completed) return false;
        if (statusFilter === 'shared' && !l.isShared) return false;
        if (q) {
          return (
            l.title.toLowerCase().includes(q) ||
            l.destination.toLowerCase().includes(q) ||
            l.tripType.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [lists, typeFilter, statusFilter, search]);

  return (
    <div className="space-y-5 pb-8">
      {/* Header + Prominent New Trip CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0A0A0A] dark:text-white tracking-tight">
            My Trips
          </h1>
          <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mt-0.5 tabular-nums">
            {lists.filter((l) => !l.completed).length} upcoming · {lists.filter((l) => l.completed).length} completed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenHistory}
            className="min-h-[44px] px-3.5 rounded-2xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-xs font-semibold text-[#0A0A0A] dark:text-[#FBFAF8] flex items-center gap-1.5 whitespace-nowrap"
          >
            <History className="w-4 h-4 text-[#0A0A0A] dark:text-[#D5DCD9]" />
            <span>Memory</span>
          </button>
          <button
            type="button"
            onClick={onOpenCreate}
            className="min-h-[44px] px-4 rounded-2xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>New Trip</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#0A0A0A99] absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search destinations, trip names, or trip types..."
          aria-label="Search trips"
          className="w-full min-h-[46px] pl-11 pr-4 rounded-2xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-sm text-[#0A0A0A] dark:text-white"
        />
      </div>

      {/* Trip Type Filters */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {TRIP_FILTERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              typeFilter === t
                ? 'bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white'
                : 'bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-[#0A0A0Acc] dark:text-[#FBFAF8a8]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-5 text-xs font-semibold border-b border-[#0A0A0A1f] dark:border-[#FBFAF824]">
        {[
          { id: 'all', label: 'All Trips' },
          { id: 'active', label: 'Upcoming' },
          { id: 'shared', label: 'Group Trips' },
          { id: 'completed', label: 'Completed' },
        ].map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setStatusFilter(st.id as typeof statusFilter)}
            className={`pb-2.5 min-h-[40px] border-b-2 transition-colors whitespace-nowrap ${
              statusFilter === st.id
                ? 'border-[#0A0A0A73] text-[#0A0A0A] dark:text-white'
                : 'border-transparent text-[#0A0A0A99] hover:text-[#0A0A0A] dark:hover:text-white'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Trip Cards */}
      {filteredLists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLists.map((list) => {
            const packed = list.items.filter((i) => i.packed).length;
            const total = list.items.length;
            const pct = total > 0 ? Math.round((packed / total) * 100) : 0;
            const dLeft = daysUntilDate(list.startDate);
            const docStatus = evaluateTripDocumentReadiness(list, documents);

            return (
              <div
                key={list.id}
                className="rounded-3xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] p-4 flex flex-col justify-between gap-3.5"
              >
                <button
                  type="button"
                  onClick={() => onOpenList(list.id, 'checklist')}
                  className="flex items-center justify-between gap-3.5 text-left w-full"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <ProgressRing percent={pct} size={52} strokeWidth={4.5} progressColor="#BCD2CF" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#0A0A0A] dark:text-[#D5DCD9] truncate">
                        {list.tripType} · {list.destination || 'Local'}
                        {list.isSampleData ? ' · Sample' : ''}
                      </p>
                      <h2 className="font-display font-bold text-base text-[#0A0A0A] dark:text-white truncate">
                        {list.title}
                      </h2>
                      <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mt-0.5 font-mono tabular-nums">
                        {list.completed
                          ? `Completed ${list.completedAt || list.endDate}`
                          : dLeft < 0
                          ? 'In progress'
                          : dLeft === 0
                          ? 'Departs today'
                          : `${dLeft}d left`}{' '}
                        · {packed}/{total} packed · {docStatus.ready ? 'Docs OK' : docStatus.label}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#0A0A0A85] shrink-0" />
                </button>

                {/* Quick Module Jumps */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => onOpenList(list.id, 'suitcase')}
                    className="min-h-[34px] px-2.5 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-[11px] font-semibold text-[#0A0A0A] dark:text-[#FBFAF8] flex items-center gap-1 whitespace-nowrap"
                  >
                    <Luggage className="w-3.5 h-3.5 text-[#0A0A0A]" />
                    <span>Suitcase</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenList(list.id, 'timeline')}
                    className="min-h-[34px] px-2.5 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-[11px] font-semibold text-[#0A0A0A] dark:text-[#FBFAF8] flex items-center gap-1 whitespace-nowrap"
                  >
                    <CalendarClock className="w-3.5 h-3.5 text-[#0A0A0A]" />
                    <span>Timeline</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenList(list.id, 'before_leave')}
                    className="min-h-[34px] px-2.5 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-[11px] font-semibold text-[#0A0A0A] dark:text-[#FBFAF8] flex items-center gap-1 whitespace-nowrap"
                  >
                    <DoorClosed className="w-3.5 h-3.5 text-[#0A0A0A]" />
                    <span>Before Leave</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenList(list.id, 'memory')}
                    className="min-h-[34px] px-2.5 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-[11px] font-semibold text-[#0A0A0A] dark:text-[#FBFAF8] flex items-center gap-1 whitespace-nowrap"
                  >
                    <Brain className="w-3.5 h-3.5 text-[#0A0A0A]" />
                    <span>{list.postTripMemory ? 'Memory Saved' : 'Review'}</span>
                  </button>
                </div>

                {/* Footer Actions */}
                <div className="pt-2.5 border-t border-[#0A0A0A1f] dark:border-[#FBFAF824] flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] flex items-center gap-1.5">
                    {list.isShared && <Users className="w-3.5 h-3.5 text-[#0A0A0A] dark:text-[#D5DCD9]" />}
                    <span>{list.luggageType.split(' ')[0]} · {list.luggageCapacityLiters}L</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDuplicateList(list.id)}
                      aria-label={`Duplicate ${list.title}`}
                      className="min-h-[38px] px-3 rounded-xl text-xs font-semibold text-[#0A0A0Acc] dark:text-[#FBFAF8a8] hover:bg-[#D5DCD966] dark:hover:bg-[#FBFAF80f] flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Reuse</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(list)}
                      aria-label={`Delete ${list.title}`}
                      className="min-h-[38px] min-w-[38px] rounded-xl text-[#0A0A0A85] hover:text-[#0A0A0A] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] p-8 text-center">
          <p className="font-display font-bold text-base text-[#0A0A0A] dark:text-white">
            No matching trips found
          </p>
          <p className="text-sm text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mt-1">
            Create a tailored trip with smart timeline, suitcase optimizer, and outfit planner.
          </p>
          <button
            type="button"
            onClick={onOpenCreate}
            className="mt-4 min-h-[44px] px-5 rounded-2xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Trip</span>
          </button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.title}"?`}
        description="This permanently removes the trip checklist, timeline, shopping items, and post-trip memory for this trip."
        confirmLabel="Delete Trip"
        onConfirm={() => {
          if (pendingDelete) onDeleteList(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
