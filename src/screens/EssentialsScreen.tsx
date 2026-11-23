import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import type {
  DocumentFolder,
  DocumentRecord,
  DocumentType,
  PackingList,
  PackingTemplate,
  PersonalEssential,
  ShoppingStatus,
  UserPreferences,
} from '../types';
import { STANDARD_CATEGORIES } from '../types';
import {
  daysUntilDate,
  evaluateDocumentUrgency,
  evaluateTripDocumentReadiness,
} from '../utils/packingEngine';
import {
  decryptSensitiveText,
  deleteVaultFile,
  encryptSensitiveText,
  getVaultFile,
  maskDocumentNumber,
  saveVaultFile,
  sha256Hash,
  uid,
} from '../utils/storage';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ASSETS } from '../data/templates';
import { SafeImage } from '../components/ui/SafeImage';

interface EssentialsScreenProps {
  documents: DocumentRecord[];
  trips: PackingList[];
  templates: PackingTemplate[];
  personalEssentials: PersonalEssential[];
  preferences: UserPreferences;
  onSetVaultPinHash: (hash: string) => void;
  onAddDocument: (doc: DocumentRecord) => void;
  onDeleteDocument: (docId: string) => void;
  onUpdateTrip: (trip: PackingList) => void;
  onOpenTrip: (tripId: string, subTab?: 'checklist' | 'shopping') => void;
  onCreateFromTemplate: (tpl: PackingTemplate) => void;
  onUpdateEssentials: (essentials: PersonalEssential[]) => void;
}

const DOC_TYPES: DocumentType[] = [
  'Passport',
  'Visa',
  'National ID',
  'Driving Licence',
  'Travel Insurance',
  'Flight Ticket',
  'Hotel Booking',
  'College ID',
  'Other',
];

const FOLDERS: DocumentFolder[] = [
  'Passports & Visas',
  'ID & Licences',
  'Tickets & Bookings',
  'Insurance & Medical',
  'College & Work',
  'Other',
];

export const EssentialsScreen: React.FC<EssentialsScreenProps> = ({
  documents,
  trips,
  templates,
  personalEssentials,
  preferences,
  onSetVaultPinHash,
  onAddDocument,
  onDeleteDocument,
  onUpdateTrip,
  onOpenTrip,
  onCreateFromTemplate,
  onUpdateEssentials,
}) => {
  const [subView, setSubView] = useState<'documents' | 'shopping' | 'checklists'>('documents');

  // Vault PIN & AES-GCM state
  const [unlocked, setUnlocked] = useState(!preferences.vaultPinHash);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [setupPinOpen, setSetupPinOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Document filters
  const [urgencyFilter, setUrgencyFilter] = useState<'All' | 'Critical' | 'Expiring Soon' | 'Watchlist' | 'Ready'>('All');
  const [docSearch, setDocSearch] = useState('');

  // Add Document sheet
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DocumentType>('Passport');
  const [folder, setFolder] = useState<DocumentFolder>('Passports & Visas');
  const [docNumber, setDocNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [reminderDays, setReminderDays] = useState(60);
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    mime: string;
    size: number;
    dataUrl: string;
  } | null>(null);
  const [formError, setFormError] = useState('');

  // Preview & Decrypted ref
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [decryptedRef, setDecryptedRef] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<DocumentRecord | null>(null);

  // New reusable essential
  const [essName, setEssName] = useState('');
  const [essCat, setEssCat] = useState<string>('Electronics');

  const evaluatedDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return documents
      .map((doc) => ({ doc, eval: evaluateDocumentUrgency(doc) }))
      .filter(({ doc, eval: ev }) => {
        if (urgencyFilter !== 'All' && ev.urgency !== urgencyFilter) return false;
        if (q) {
          return (
            doc.title.toLowerCase().includes(q) ||
            doc.type.toLowerCase().includes(q) ||
            (doc.notes || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const order = { Critical: 0, 'Expiring Soon': 1, Watchlist: 2, Ready: 3 };
        return order[a.eval.urgency] - order[b.eval.urgency];
      });
  }, [documents, urgencyFilter, docSearch]);

  const upcomingTrips = useMemo(() => trips.filter((t) => !t.completed), [trips]);

  // Unified Shopping Radar items across all active trips
  const unifiedShopping = useMemo(() => {
    return upcomingTrips.flatMap((trip) => {
      const daysLeft = daysUntilDate(trip.startDate);
      return trip.shoppingItems.map((item) => ({
        trip,
        item,
        daysLeft,
        isCloseUrgent: item.status === 'To Buy' && (daysLeft <= 5 || item.priority === 'Urgent'),
      }));
    });
  }, [upcomingTrips]);

  const totalToBuyBudget = useMemo(
    () =>
      unifiedShopping
        .filter((x) => x.item.status === 'To Buy')
        .reduce((s, x) => s + x.item.estimatedPrice, 0),
    [unifiedShopping]
  );

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (!preferences.vaultPinHash) {
      setUnlocked(true);
      return;
    }
    const hashed = await sha256Hash(`vault:${pinInput}`);
    if (hashed === preferences.vaultPinHash) {
      setUnlocked(true);
      setPinInput('');
    } else {
      setPinError('Incorrect 4-digit PIN.');
    }
  };

  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (!/^\d{4}$/.test(newPin)) {
      setPinError('PIN must be 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PIN confirmation does not match.');
      return;
    }
    const hash = await sha256Hash(`vault:${newPin}`);
    onSetVaultPinHash(hash);
    setNewPin('');
    setConfirmPin('');
    setSetupPinOpen(false);
    setUnlocked(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFormError('File must be 5 MB or smaller.');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setFormError('Allowed formats: JPG, PNG, WebP, or PDF.');
      return;
    }
    setFormError('');
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        mime: file.type,
        size: file.size,
        dataUrl: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!title.trim()) {
      setFormError('Please enter a document name.');
      return;
    }
    if (issueDate && expiryDate && expiryDate < issueDate) {
      setFormError('Expiry date cannot be earlier than issue date.');
      return;
    }

    let fileId: string | undefined;
    if (selectedFile) {
      fileId = uid('vfile');
      await saveVaultFile(fileId, selectedFile.dataUrl);
    }

    const encryptedRef = docNumber.trim() ? await encryptSensitiveText(docNumber.trim()) : undefined;

    onAddDocument({
      id: uid('doc'),
      title: title.trim(),
      type,
      folder,
      documentNumber: docNumber.trim() ? maskDocumentNumber(docNumber.trim()) : undefined,
      encryptedRef,
      issueDate: issueDate || undefined,
      expiryDate: expiryDate || undefined,
      reminderDaysBefore: Math.max(1, reminderDays),
      notes: notes.trim() || undefined,
      fileId,
      fileName: selectedFile?.name,
      fileMimeType: selectedFile?.mime,
      fileSize: selectedFile?.size,
      createdAt: new Date().toISOString(),
    });

    setTitle('');
    setDocNumber('');
    setIssueDate('');
    setExpiryDate('');
    setNotes('');
    setSelectedFile(null);
    setAddDocOpen(false);
  };

  const handleOpenPreview = async (doc: DocumentRecord) => {
    setPreviewDoc(doc);
    setDecryptedRef('');
    setPreviewDataUrl(null);
    if (doc.encryptedRef) {
      const plain = await decryptSensitiveText(doc.encryptedRef);
      setDecryptedRef(plain);
    }
    if (doc.fileId) {
      const data = await getVaultFile(doc.fileId);
      setPreviewDataUrl(data);
    }
  };

  const handleUpdateShoppingStatus = (trip: PackingList, itemId: string, status: ShoppingStatus) => {
    onUpdateTrip({
      ...trip,
      shoppingItems: trip.shoppingItems.map((s) =>
        s.id === itemId ? { ...s, status, purchased: status === 'Purchased' } : s
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddEssential = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = essName.trim();
    if (!clean) return;
    if (personalEssentials.some((p) => p.name.toLowerCase() === clean.toLowerCase())) return;
    onUpdateEssentials([
      ...personalEssentials,
      {
        id: uid('pe'),
        name: clean,
        category: essCat,
        quantity: 1,
        weightGrams: 150,
        volumeLiters: 0.4,
        autoInclude: true,
      },
    ]);
    setEssName('');
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#0A0A0A] dark:text-white tracking-tight">
            Travel Essentials Hub
          </h1>
          <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mt-0.5">
            Document Expiry Radar, Last-Minute Shopping & Reusable Checklists
          </p>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-[#FBFAF8] dark:bg-[#FBFAF80f] rounded-2xl max-w-xl">
        {[
          { id: 'documents', label: `Docs Radar (${documents.length})` },
          { id: 'shopping', label: `Shopping (${unifiedShopping.filter((x) => x.item.status === 'To Buy').length})` },
          { id: 'checklists', label: 'Checklists' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubView(tab.id as typeof subView)}
            className={`min-h-[42px] rounded-xl text-xs font-semibold transition-all ${
              subView === tab.id
                ? 'bg-white dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-white shadow-xs'
                : 'text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== TAB 1: DOCUMENT EXPIRY RADAR ==================== */}
      {subView === 'documents' && (
        <>
          {!unlocked && preferences.vaultPinHash ? (
            <div className="max-w-md mx-auto py-6 bg-white dark:bg-[#FBFAF80f] rounded-3xl p-6 border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0B3B40] text-[#0A0A0A] flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="font-display text-lg font-extrabold text-[#0A0A0A] dark:text-white">
                Document Expiry Radar Locked
              </h2>
              <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">
                Enter your 4-digit PIN to decrypt sensitive passport, visa, and ID records.
              </p>
              <form onSubmit={handleUnlock} className="space-y-3">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  aria-label="Vault PIN"
                  className="w-40 mx-auto block text-center tracking-[0.6em] font-mono text-2xl font-bold min-h-[50px] rounded-2xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824]"
                />
                {pinError && <p role="alert" className="text-xs font-medium text-[#0A0A0A]">{pinError}</p>}
                <button
                  type="submit"
                  className="w-full min-h-[46px] rounded-2xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Unlock Radar</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Security & Trip Document Readiness Card */}
              <div className="rounded-3xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] overflow-hidden grid grid-cols-1 md:grid-cols-12">
                <div className="md:col-span-8 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#0A0A0A] dark:text-[#FBFAF8] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>AES-GCM Local Encryption · Private Device Vault</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {preferences.vaultPinHash ? (
                        <button
                          type="button"
                          onClick={() => setUnlocked(false)}
                          className="min-h-[38px] px-3 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-xs font-semibold flex items-center gap-1"
                        >
                          <Lock className="w-3.5 h-3.5 text-[#0A0A0A]" />
                          <span>Lock</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPinError('');
                            setSetupPinOpen(true);
                          }}
                          className="min-h-[38px] px-3 rounded-xl bg-[#D5DCD966] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#D5DCD9] text-xs font-semibold"
                        >
                          Set Vault PIN
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setFormError('');
                          setAddDocOpen(true);
                        }}
                        className="min-h-[38px] px-3.5 rounded-xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Document</span>
                      </button>
                    </div>
                  </div>

                  {/* Upcoming Trip Document Readiness */}
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-bold text-[#0A0A0A] dark:text-white">
                      Document Readiness for Upcoming Trips
                    </p>
                    {upcomingTrips.length === 0 ? (
                      <p className="text-xs text-[#0A0A0Ab2]">No upcoming trips to evaluate.</p>
                    ) : (
                      upcomingTrips.slice(0, 2).map((trip) => {
                        const readiness = evaluateTripDocumentReadiness(trip, documents);
                        return (
                          <div
                            key={trip.id}
                            className="p-3 rounded-2xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#0A0A0A] dark:text-white truncate">
                                {trip.title} ({trip.startDate})
                              </p>
                              {readiness.issues.length > 0 ? (
                                <p className="text-[11px] text-[#0A0A0A] dark:text-[#E6DFD2] mt-0.5">
                                  {readiness.issues[0]}
                                </p>
                              ) : (
                                <p className="text-[11px] text-[#0A0A0A] dark:text-[#FBFAF8] mt-0.5">
                                  All stored documents are valid past your return date.
                                </p>
                              )}
                            </div>
                            <span
                              className={`text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-1 ${
                                readiness.ready
                                  ? 'text-[#0A0A0A] dark:text-[#FBFAF8]'
                                  : 'text-[#0A0A0A] dark:text-[#E6DFD2]'
                              }`}
                            >
                              {readiness.ready ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <AlertTriangle className="w-4 h-4" />
                              )}
                              <span>{readiness.label}</span>
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="md:col-span-4 h-36 md:h-full">
                  <SafeImage
                    src={ASSETS.vault}
                    alt="Document expiry radar vault illustration"
                    className="w-full h-full object-cover"
                    fallbackLabel="Document Radar"
                  />
                </div>
              </div>

              {/* Search & Urgency Filter */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#0A0A0A99] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search passport, visa, insurance, licence..."
                    className="w-full min-h-[44px] pl-10 pr-4 rounded-2xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-sm"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {(['All', 'Critical', 'Expiring Soon', 'Watchlist', 'Ready'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgencyFilter(u)}
                      className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
                        urgencyFilter === u
                          ? 'bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white'
                          : 'bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-[#0A0A0Acc] dark:text-[#FBFAF8a8]'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Documents by Urgency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {evaluatedDocs.map(({ doc, eval: ev }) => (
                  <div
                    key={doc.id}
                    className="rounded-3xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] p-5 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-[#D5DCD966] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#D5DCD9] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">
                            {doc.type} · {ev.urgency}
                            {doc.isSampleData ? ' · Sample' : ''}
                          </p>
                          <h3 className="font-display font-bold text-base text-[#0A0A0A] dark:text-white truncate">
                            {doc.title}
                          </h3>
                          {doc.documentNumber && (
                            <p className="font-mono text-xs text-[#0A0A0Ab2] mt-0.5">
                              Ref: {doc.documentNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
                        ev.urgency === 'Critical'
                          ? 'bg-[#E6DFD266] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#E6DFD2]'
                          : ev.urgency === 'Expiring Soon'
                          ? 'bg-[#E6DFD266] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#E6DFD2]'
                          : 'bg-[#BCD2CF66] dark:bg-[#0B3B40] text-[#0A0A0A] dark:text-[#FBFAF8]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {ev.urgency === 'Critical' || ev.urgency === 'Expiring Soon' ? (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{ev.statusText}</span>
                      </span>
                      <span className="font-mono text-[11px] opacity-85">
                        Alert {doc.reminderDaysBefore}d before
                      </span>
                    </div>

                    <div className="text-[11px] text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] flex items-center justify-between pt-2 border-t border-[#0A0A0A1f] dark:border-[#FBFAF824]">
                      <span>
                        {doc.issueDate ? `Issued ${doc.issueDate}` : 'Local encrypted record'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(doc)}
                          className="min-h-[36px] px-3 rounded-xl bg-[#D5DCD966] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#D5DCD9] text-xs font-semibold flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteDocConfirm(doc)}
                          aria-label={`Delete ${doc.title}`}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-[#0A0A0A85] hover:text-[#0A0A0A]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== TAB 2: UNIFIED LAST-MINUTE SHOPPING RADAR ==================== */}
      {subView === 'shopping' && (
        <div className="space-y-4">
          <div className="bg-[#0B3B40] text-white rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[#D5DCD9]">All Upcoming Trips · Last-Minute Shopping Radar</p>
              <h2 className="font-display text-xl font-bold mt-0.5 tabular-nums">
                {unifiedShopping.filter((x) => x.item.status === 'To Buy').length} items still to buy
              </h2>
              <p className="text-xs text-white/75 mt-1">
                Urgent items close to departure are surfaced automatically at the top.
              </p>
            </div>
            <div className="text-right font-mono tabular-nums">
              <p className="text-xs text-white/70">Pending Estimate</p>
              <p className="text-2xl font-bold text-[#0A0A0A]">
                {preferences.currency}{totalToBuyBudget.toLocaleString()}
              </p>
            </div>
          </div>

          {unifiedShopping.length === 0 ? (
            <div className="rounded-3xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] p-8 text-center">
              <ShoppingBag className="w-7 h-7 text-[#0A0A0A] mx-auto mb-2" />
              <p className="font-display font-bold text-base text-[#0A0A0A] dark:text-white">
                Shopping Radar is clear
              </p>
              <p className="text-xs text-[#0A0A0Ab2] mt-1">
                Open any trip's Shopping tab to pull missing checklist items or add purchases.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...unifiedShopping]
                .sort((a, b) => Number(b.isCloseUrgent) - Number(a.isCloseUrgent))
                .map(({ trip, item, daysLeft, isCloseUrgent }) => (
                  <div
                    key={`${trip.id}-${item.id}`}
                    className={`rounded-3xl bg-white dark:bg-[#FBFAF80f] border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCloseUrgent
                        ? 'border-[#0A0A0A73] dark:border-[#FBFAF824]'
                        : 'border-[#0A0A0A1f] dark:border-[#FBFAF824]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">
                        {trip.title} · {daysLeft <= 0 ? 'Departing now' : `${daysLeft}d left`} · {item.priority} Priority
                        {isCloseUrgent && (
                          <span className="text-[#0A0A0A] dark:text-[#E6DFD2] font-bold"> · Urgent before departure</span>
                        )}
                      </p>
                      <p className="text-sm font-bold text-[#0A0A0A] dark:text-white mt-0.5">
                        {item.name} ·{' '}
                        <span className="font-mono font-semibold text-[#0A0A0A] dark:text-[#D5DCD9]">
                          {preferences.currency}{item.estimatedPrice.toLocaleString()}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={item.status}
                        aria-label={`Shopping status for ${item.name}`}
                        onChange={(e) =>
                          handleUpdateShoppingStatus(trip, item.id, e.target.value as ShoppingStatus)
                        }
                        className="min-h-[40px] px-3 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-xs font-semibold text-[#0A0A0A] dark:text-white"
                      >
                        <option value="To Buy">To Buy</option>
                        <option value="Purchased">Purchased</option>
                        <option value="No Longer Needed">No Longer Needed</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => onOpenTrip(trip.id, 'shopping')}
                        aria-label={`Open ${trip.title} shopping`}
                        className="min-h-[40px] min-w-[40px] rounded-xl bg-[#D5DCD966] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#D5DCD9] flex items-center justify-center"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: REUSABLE CHECKLISTS & PERSONAL ESSENTIALS ==================== */}
      {subView === 'checklists' && (
        <div className="space-y-5">
          <section className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-5 border border-[#0A0A0A1f] dark:border-[#FBFAF824] space-y-4">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-[#0A0A0A]" />
              <div>
                <h2 className="font-display text-base font-bold text-[#0A0A0A] dark:text-white">
                  Reusable Personal Essentials
                </h2>
                <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">
                  Auto-included whenever you create a new trip
                </p>
              </div>
            </div>

            <form onSubmit={handleAddEssential} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                value={essName}
                onChange={(e) => setEssName(e.target.value)}
                placeholder="Add personal staple (e.g., Sleep mask, Spare glasses)"
                className="sm:col-span-7 min-h-[42px] px-3.5 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-sm"
              />
              <select
                value={essCat}
                onChange={(e) => setEssCat(e.target.value)}
                className="sm:col-span-3 min-h-[42px] px-3 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-xs"
              >
                {STANDARD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                type="submit"
                className="sm:col-span-2 min-h-[42px] rounded-xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white text-xs font-semibold"
              >
                Add
              </button>
            </form>

            <div className="divide-y divide-[#0A0A0A1f] dark:divide-[#FBFAF824]">
              {personalEssentials.map((pe) => (
                <div key={pe.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0A0A0A] dark:text-white">{pe.name}</p>
                    <p className="text-xs text-[#0A0A0Ab2]">{pe.category} · {pe.weightGrams}g</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                      <span>Auto</span>
                      <input
                        type="checkbox"
                        checked={pe.autoInclude}
                        onChange={(e) =>
                          onUpdateEssentials(
                            personalEssentials.map((x) =>
                              x.id === pe.id ? { ...x, autoInclude: e.target.checked } : x
                            )
                          )
                        }
                        className="w-4 h-4 accent-[#0A0A0A73]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onUpdateEssentials(personalEssentials.filter((x) => x.id !== pe.id))}
                      aria-label={`Remove ${pe.name}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#0A0A0A85] hover:text-[#0A0A0A]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-base font-bold text-[#0A0A0A] dark:text-white">
              Reusable Checklist Templates
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-3xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#0A0A0A] dark:text-[#D5DCD9]">
                      {tpl.mode} · {tpl.items.length} items
                    </p>
                    <h3 className="font-display font-bold text-sm text-[#0A0A0A] dark:text-white mt-0.5">
                      {tpl.title}
                    </h3>
                    <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mt-1">{tpl.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreateFromTemplate(tpl)}
                    className="min-h-[40px] w-full rounded-xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Launch Trip from Template</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Add Document Bottom Sheet */}
      <BottomSheet
        open={addDocOpen}
        onClose={() => setAddDocOpen(false)}
        title="Add Document to Expiry Radar"
        subtitle="Encrypted privately on this device"
      >
        <form onSubmit={handleSaveDoc} className="space-y-3.5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document name (e.g., Passport, Schengen Visa)"
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
              className="min-h-[44px] px-3 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-xs"
            >
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value as DocumentFolder)}
              className="min-h-[44px] px-3 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-xs"
            >
              {FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <input
            type="text"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
            placeholder="Document number (AES-GCM encrypted & masked)"
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-sm font-mono"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="doc-issue" className="block text-[11px] font-semibold text-[#0A0A0Ab2] mb-1">Issue Date</label>
              <input
                id="doc-issue"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-xs font-mono"
              />
            </div>
            <div>
              <label htmlFor="doc-expiry" className="block text-[11px] font-semibold text-[#0A0A0Ab2] mb-1">Expiry Date</label>
              <input
                id="doc-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-xs font-mono"
              />
            </div>
          </div>
          <div>
            <label htmlFor="doc-rem-days" className="block text-[11px] font-semibold text-[#0A0A0Ab2] mb-1">
              Reminder lead time (days before expiry)
            </label>
            <input
              id="doc-rem-days"
              type="number"
              min={1}
              max={365}
              value={reminderDays}
              onChange={(e) => setReminderDays(Math.max(1, Number(e.target.value) || 30))}
              className="w-full min-h-[42px] px-3 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] font-mono text-sm"
            />
          </div>
          <label className="min-h-[50px] px-4 rounded-xl border border-dashed border-[#0A0A0A40] dark:border-[#FBFAF824] bg-[#FBFAF8] dark:bg-[#0B3B40] flex items-center justify-center gap-2 text-xs font-semibold text-[#0A0A0A] cursor-pointer">
            <Upload className="w-4 h-4" />
            <span className="truncate">{selectedFile ? selectedFile.name : 'Attach private image or PDF (optional)'}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} className="sr-only" />
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes or renewal instructions..."
            className="w-full p-3 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-sm"
          />
          {formError && <p role="alert" className="text-xs font-medium text-[#0A0A0A]">{formError}</p>}
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white font-semibold text-sm"
          >
            Save Encrypted Document
          </button>
        </form>
      </BottomSheet>

      {/* Set Vault PIN Sheet */}
      <BottomSheet
        open={setupPinOpen}
        onClose={() => setSetupPinOpen(false)}
        title="Set 4-Digit Vault PIN"
        subtitle="Protects Document Expiry Radar on this device"
      >
        <form onSubmit={handleSetupPin} className="space-y-3.5">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Enter 4 digits"
            className="w-full min-h-[46px] px-4 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] font-mono text-lg tracking-widest"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Confirm 4 digits"
            className="w-full min-h-[46px] px-4 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] font-mono text-lg tracking-widest"
          />
          {pinError && <p role="alert" className="text-xs font-medium text-[#0A0A0A]">{pinError}</p>}
          <button
            type="submit"
            className="w-full min-h-[46px] rounded-2xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white font-semibold text-sm"
          >
            Enable Vault Lock
          </button>
        </form>
      </BottomSheet>

      {/* Document Preview Sheet */}
      <BottomSheet
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || ''}
        subtitle={previewDoc ? `${previewDoc.type} · ${previewDoc.folder}` : ''}
      >
        {previewDoc && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-[#FBFAF8] dark:bg-[#0B3B40]">
                <p className="text-[#0A0A0A99]">Issue Date</p>
                <p className="font-mono font-semibold mt-0.5">{previewDoc.issueDate || 'Not set'}</p>
              </div>
              <div className="p-3 rounded-2xl bg-[#FBFAF8] dark:bg-[#0B3B40]">
                <p className="text-[#0A0A0A99]">Expiry Date</p>
                <p className="font-mono font-semibold mt-0.5">{previewDoc.expiryDate || 'No expiry'}</p>
              </div>
            </div>
            {(decryptedRef || previewDoc.documentNumber) && (
              <div className="p-3 rounded-2xl bg-[#BCD2CF66] dark:bg-[#0B3B40] text-xs flex items-center justify-between">
                <span className="text-[#0A0A0A] dark:text-[#FBFAF8] font-semibold">Decrypted Ref Number</span>
                <span className="font-mono font-bold text-[#0A0A0A] dark:text-white">
                  {decryptedRef || previewDoc.documentNumber}
                </span>
              </div>
            )}
            {previewDoc.notes && (
              <p className="text-xs text-[#0A0A0Acc] dark:text-[#FBFAF8a8] p-3 rounded-2xl bg-[#FBFAF8] dark:bg-[#0B3B40]">
                {previewDoc.notes}
              </p>
            )}
            {previewDataUrl && (
              previewDoc.fileMimeType === 'application/pdf' ? (
                <iframe src={previewDataUrl} title={previewDoc.title} className="w-full h-64 rounded-2xl border" />
              ) : (
                <img loading="lazy" decoding="async" src={previewDataUrl} alt={previewDoc.title} className="w-full max-h-72 object-contain rounded-2xl border" />
              )
            )}
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={Boolean(deleteDocConfirm)}
        title="Delete document from Vault?"
        description={`Remove "${deleteDocConfirm?.title}" and any attached private scan from this device permanently?`}
        confirmLabel="Delete Document"
        onConfirm={async () => {
          if (deleteDocConfirm) {
            if (deleteDocConfirm.fileId) {
              await deleteVaultFile(deleteDocConfirm.fileId).catch(() => {});
            }
            onDeleteDocument(deleteDocConfirm.id);
          }
          setDeleteDocConfirm(null);
        }}
        onCancel={() => setDeleteDocConfirm(null)}
      />
    </div>
  );
};
