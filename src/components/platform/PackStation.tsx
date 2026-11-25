import React, { useMemo, useState } from 'react';
import { AlertTriangle, GripVertical, Luggage, PackageCheck, RotateCcw } from 'lucide-react';
import type { PackingItem, PackingList } from '../../types';
import { DragGhost, usePointerDrag } from './usePointerDrag';

interface PackStationProps {
  trip: PackingList;
  onUpdateList: (updated: PackingList) => void;
}

const unitVol = (i: PackingItem) => (i.volumeLiters > 0 ? i.volumeLiters : 0.5) * Math.max(1, i.quantity);
const unitKg = (i: PackingItem) => (i.weightGrams * Math.max(1, i.quantity)) / 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Pack the case by hand: drag items from the tray into the suitcase (or tap or press
 * Enter on an item), and watch the litres and kilograms fill against the limits.
 */
export const PackStation: React.FC<PackStationProps> = ({ trip, onUpdateList }) => {
  const [status, setStatus] = useState('');

  const packed = useMemo(() => trip.items.filter((i) => i.packed), [trip.items]);
  const tray = useMemo(() => trip.items.filter((i) => !i.packed), [trip.items]);

  const capacity = Math.max(1, trip.luggageCapacityLiters || 40);
  const allowance = Math.max(1, trip.baggageAllowanceKg || 20);
  const bagKg = trip.bagWeightKg || 0;
  const usedL = packed.reduce((s, i) => s + unitVol(i), 0);
  const usedKg = packed.reduce((s, i) => s + unitKg(i), 0) + bagKg;

  const setPacked = (ids: string[], value: boolean, message?: string) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    onUpdateList({
      ...trip,
      items: trip.items.map((it) => (set.has(it.id) ? { ...it, packed: value } : it)),
      updatedAt: new Date().toISOString(),
    });
    if (message) setStatus(message);
  };

  const describe = (item: PackingItem, adding: boolean) => {
    const l = usedL + (adding ? unitVol(item) : -unitVol(item));
    const kg = usedKg + (adding ? unitKg(item) : -unitKg(item));
    const pct = Math.round((l / capacity) * 100);
    const over = l > capacity || kg > allowance;
    return `${adding ? 'Packed' : 'Took out'} ${item.name}. Case is ${pct} percent full at ${round1(kg)} kilograms.${
      over ? ' Over the limit.' : ''
    }`;
  };

  const { drag, begin, wasDragged } = usePointerDrag((id, zone) => {
    const item = trip.items.find((i) => i.id === id);
    if (!item) return;
    if (zone === 'case' && !item.packed) setPacked([id], true, describe(item, true));
    if (zone === 'tray' && item.packed) setPacked([id], false, describe(item, false));
  });

  const dragged = drag ? trip.items.find((i) => i.id === drag.id) : undefined;
  const hovering = drag?.overZone === 'case' && dragged && !dragged.packed;
  const projL = usedL + (hovering && dragged ? unitVol(dragged) : 0);
  const projKg = usedKg + (hovering && dragged ? unitKg(dragged) : 0);

  const volPct = (usedL / capacity) * 100;
  const projVolPct = (projL / capacity) * 100;
  const kgPct = (usedKg / allowance) * 100;
  const projKgPct = (projKg / allowance) * 100;
  const overVol = projL > capacity;
  const overKg = projKg > allowance;
  const over = overVol || overKg;

  const warning = [
    overVol ? `${round1(projL - capacity)} L over the case's ${capacity} L` : '',
    overKg ? `${round1(projKg - allowance)} kg over the ${allowance} kg allowance` : '',
  ]
    .filter(Boolean)
    .join(' and ');

  // Tiles in the case are sized by how much space each item takes.
  const maxVol = Math.max(1, ...packed.map(unitVol));

  const chip = (item: PackingItem, inCase: boolean) => {
    const active = drag?.id === item.id;
    return (
        <div
          onPointerDown={begin(item.id, item.name)}
          className={`group flex items-stretch rounded-xl border text-left select-none transition-[opacity,box-shadow,border-color] duration-150 ${
            inCase
              ? 'bg-[#FBFAF8]/10 border-[#FBFAF8]/25 text-[#FBFAF8]'
              : 'bg-[#FBFAF8] border-[#0A0A0A]/15 text-[#0A0A0A] hover:border-[#0B3B40]'
          } ${active ? 'opacity-40' : ''}`}
          style={{ cursor: 'grab' }}
        >
          <span
            data-grip
            aria-hidden="true"
            className="flex items-center px-1.5 opacity-50 group-hover:opacity-90 transition-opacity"
            style={{ touchAction: 'none' }}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          <button
            type="button"
            onClick={() => {
              if (wasDragged()) return;
              setPacked([item.id], !inCase, describe(item, !inCase));
            }}
            aria-label={inCase ? `Take ${item.name} out of the suitcase` : `Pack ${item.name} into the suitcase`}
            className="py-2 pr-3 text-left min-w-0 rounded-r-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3B40]"
            style={{ cursor: 'inherit' }}
          >
            <span className="block text-xs font-semibold truncate max-w-[170px]">
              {item.name}
              {item.quantity > 1 ? ` x${item.quantity}` : ''}
            </span>
            <span className={`block text-[11px] tabular-nums ${inCase ? 'text-[#FBFAF8]/70' : 'text-[#0A0A0A]/65'}`}>
              {round1(unitVol(item))} L · {round1(unitKg(item))} kg
            </span>
          </button>
        </div>
    );
  };

  const meter = (label: string, value: string, pct: number, projPct: number, isOver: boolean) => (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs font-medium text-[#FBFAF8]/80">
        <span>{label}</span>
        <span className="tabular-nums text-[#FBFAF8]">{value}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-[#FBFAF8]/15 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#FBFAF8]/35 transition-[width] duration-200"
          style={{ width: `${Math.min(100, projPct)}%` }}
        />
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-300 ${
            isOver ? 'bg-[#E6DFD2]' : 'bg-[#FBFAF8]'
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );

  return (
    <section
      aria-label="Pack the suitcase"
      className="rounded-3xl bg-[#FBFAF8] border border-[#0A0A0A]/10 p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#0A0A0A]/75">Pack Station</p>
          <h2 className="font-serif text-2xl font-medium text-[#0A0A0A]">Load the suitcase</h2>
          <p className="text-xs text-[#0A0A0A]/75 mt-0.5">
            Drag an item into the case, or tap it. Drag it back to the tray to take it out.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPacked(tray.map((i) => i.id), true, `Packed all ${tray.length} remaining items.`)}
            disabled={tray.length === 0}
            className="h-9 px-3.5 rounded-full bg-[#0B3B40] text-[#FBFAF8] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#0A0A0A] transition-colors disabled:opacity-40"
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Pack everything</span>
          </button>
          <button
            type="button"
            onClick={() => setPacked(packed.map((i) => i.id), false, 'Emptied the suitcase.')}
            disabled={packed.length === 0}
            className="h-9 px-3.5 rounded-full border border-[#0A0A0A]/20 text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-1.5 hover:border-[#0A0A0A] transition-colors disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Empty case</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Tray */}
        <div
          data-dropzone="tray"
          className={`lg:col-span-5 rounded-2xl border border-dashed p-4 space-y-3 transition-colors ${
            drag?.overZone === 'tray' && dragged?.packed
              ? 'border-[#0B3B40] bg-[#BCD2CF]/35'
              : 'border-[#0A0A0A]/20 bg-[#0A0A0A]/[0.025]'
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Still to pack</h3>
            <span className="text-xs font-medium text-[#0A0A0A]/70 tabular-nums">{tray.length}</span>
          </div>
          {tray.length === 0 ? (
            <p className="text-sm text-[#0A0A0A]/70 py-6 text-center">Everything is in the case.</p>
          ) : (
            <ul className="flex flex-wrap gap-2 max-h-[320px] overflow-y-auto pr-1 m-0 p-0">
              {tray.map((i) => (
                <li key={i.id} className="list-none">
                  {chip(i, false)}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Suitcase */}
        <div
          data-dropzone="case"
          className={`lg:col-span-7 rounded-2xl p-4 sm:p-5 space-y-4 bg-[#0B3B40] text-[#FBFAF8] border-2 transition-colors ${
            hovering ? (over ? 'border-[#E6DFD2]' : 'border-[#FBFAF8]') : 'border-transparent'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Luggage className="w-4 h-4" />
              <h3 className="text-sm font-semibold">{trip.luggageType}</h3>
            </div>
            <span className="text-xs text-[#FBFAF8]/75 tabular-nums">{packed.length} packed</span>
          </div>

          <div className="space-y-3">
            {meter(
              'Volume',
              `${round1(projL)} / ${capacity} L`,
              volPct,
              projVolPct,
              usedL > capacity
            )}
            {meter(
              'Weight with the empty bag',
              `${round1(projKg)} / ${allowance} kg`,
              kgPct,
              projKgPct,
              usedKg > allowance
            )}
          </div>

          <div
            className={`min-h-[132px] rounded-xl border border-dashed p-3 ${
              hovering ? 'border-[#FBFAF8]/80 bg-[#FBFAF8]/10' : 'border-[#FBFAF8]/30'
            }`}
          >
            {packed.length === 0 ? (
              <p className="text-sm text-[#FBFAF8]/70 text-center py-9">
                {hovering ? 'Release to pack it.' : 'The case is empty. Drop items here.'}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2 m-0 p-0">
                {packed.map((i) => {
                  const scale = 0.55 + 0.45 * (unitVol(i) / maxVol);
                  return (
                    <li
                      key={i.id}
                      className="list-none"
                      style={{ flexGrow: scale > 0.8 ? 1 : 0 }}
                    >
                      {chip(i, true)}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="min-h-[1.25rem]">
            {over ? (
              <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-[#E6DFD2]">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {hovering ? 'Dropping this would put you ' : 'Over the limit: '}
                  {warning}.
                </span>
              </p>
            ) : (
              <p className="text-xs text-[#FBFAF8]/75">
                {Math.max(0, round1(capacity - projL))} L and {Math.max(0, round1(allowance - projKg))} kg of room left.
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <DragGhost drag={drag} />
    </section>
  );
};
