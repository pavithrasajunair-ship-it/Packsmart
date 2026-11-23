import React, { useState } from 'react';
import {
  Bell,
  Brain,
  Check,
  Download,
  HardDrive,
  LogOut,
  Moon,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Vibrate,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type {
  AppState,
  ReminderItem,
  UserAccount,
  UserPreferences,
} from '../types';
import {
  requestAppNotificationPermission,
  sendAppNotification,
  uid,
} from '../utils/storage';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface ProfileScreenProps {
  user: UserAccount;
  preferences: UserPreferences;
  reminders: ReminderItem[];
  isOnline: boolean;
  aiConfigured: boolean;
  hasSampleData: boolean;
  fullState: AppState;
  onUpdateUser: (user: UserAccount) => void;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  onUpdateReminders: (reminders: ReminderItem[]) => void;
  onOpenAI: () => void;
  onOpenHistory: () => void;
  onClearSampleData: () => void;
  onImportBackup: (state: AppState) => void;
  onReplayOnboarding: () => void;
  onSignOut: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  preferences,
  reminders,
  isOnline,
  aiConfigured,
  hasSampleData,
  fullState,
  onUpdateUser,
  onUpdatePreferences,
  onUpdateReminders,
  onOpenAI,
  onOpenHistory,
  onClearSampleData,
  onImportBackup,
  onReplayOnboarding,
  onSignOut,
}) => {
  const [editingName, setEditingName] = useState(user.name);
  const [savedProfileMsg, setSavedProfileMsg] = useState('');
  const [notifStatusMsg, setNotifStatusMsg] = useState('');

  // Reminder form
  const [remTitle, setRemTitle] = useState('');
  const [remDate, setRemDate] = useState(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  const [remCategory, setRemCategory] = useState<ReminderItem['category']>('Departure');

  const [backupMessage, setBackupMessage] = useState('');
  const [clearSampleConfirm, setClearSampleConfirm] = useState(false);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = editingName.trim();
    if (clean.length < 2) return;
    const initials = clean
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    onUpdateUser({ ...user, name: clean, initials: initials || 'PS' });
    setSavedProfileMsg('Profile updated');
    window.setTimeout(() => setSavedProfileMsg(''), 2500);
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    if (!enabled) {
      onUpdatePreferences({ ...preferences, notificationsEnabled: false });
      setNotifStatusMsg('Device notifications turned off.');
      return;
    }
    const perm = await requestAppNotificationPermission();
    if (perm === 'granted') {
      onUpdatePreferences({ ...preferences, notificationsEnabled: true });
      sendAppNotification(
        'PackSmart Notifications Active',
        'Departure checks, document expiry radar alerts, and shopping reminders are enabled.'
      );
      setNotifStatusMsg('Notifications permitted and test alert sent.');
    } else if (perm === 'unsupported') {
      onUpdatePreferences({ ...preferences, notificationsEnabled: false });
      setNotifStatusMsg('Browser notifications are not supported in this view; in-app alerts remain active.');
    } else {
      onUpdatePreferences({ ...preferences, notificationsEnabled: false });
      setNotifStatusMsg('Notification permission was declined in your browser settings.');
    }
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) return;
    onUpdateReminders([
      {
        id: uid('rem'),
        title: remTitle.trim(),
        dueDate: remDate,
        category: remCategory,
        completed: false,
      },
      ...reminders,
    ]);
    setRemTitle('');
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(fullState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packsmart-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage('Backup exported cleanly.');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '')) as AppState;
        if (parsed && Array.isArray(parsed.lists) && Array.isArray(parsed.templates)) {
          onImportBackup(parsed);
          setBackupMessage('Backup restored successfully.');
        } else {
          setBackupMessage('Invalid PackSmart backup file.');
        }
      } catch {
        setBackupMessage('Could not parse JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-10 max-w-4xl mx-auto">
      {/* Account Header */}
      <div className="bg-[#0B3B40] text-white rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-[#0B3B40] text-white font-display text-xl font-extrabold flex items-center justify-center shrink-0">
            {user.initials}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-extrabold truncate">{user.name}</h1>
            <p className="text-xs text-[#D5DCD9] truncate">{user.email}</p>
            <p className="text-[11px] text-white/75 mt-1 flex flex-wrap items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-[#0A0A0A]" />
              <span>Private On-Device Storage</span>
              <span aria-hidden="true">·</span>
              {isOnline ? (
                <span className="inline-flex items-center gap-1 text-[#0A0A0A]">
                  <Wifi className="w-3 h-3" /> Online (Live Weather{aiConfigured ? ' & AI' : ''})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[#0A0A0A]">
                  <WifiOff className="w-3 h-3" /> Offline Mode Active
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap self-start sm:self-center"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Quick Intelligence Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <button
          type="button"
          onClick={onOpenHistory}
          className="p-4 rounded-3xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] flex items-center gap-3.5 text-left hover:border-[#0A0A0A]/50 transition-colors"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#BCD2CF66] dark:bg-[#0B3B40] text-[#0A0A0A] dark:text-[#FBFAF8] flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-[#0A0A0A] dark:text-white">
              Post-Trip Memory & Insights
            </p>
            <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">
              View learned forgotten items, unused gear & archived trips
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenAI}
          className="p-4 rounded-3xl bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] flex items-center gap-3.5 text-left hover:border-[#0A0A0A]/50 transition-colors"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#D5DCD966] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#D5DCD9] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-[#0A0A0A] dark:text-white">
              PackSmart AI Advisor
            </p>
            <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">
              Ask trip questions & pull non-duplicate recommendations
            </p>
          </div>
        </button>
      </div>

      {/* Preferences & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-5 border border-[#0A0A0A1f] dark:border-[#FBFAF824] space-y-4">
          <h2 className="font-display text-base font-bold text-[#0A0A0A] dark:text-white">
            Account & App Preferences
          </h2>

          <form onSubmit={handleSaveName} className="flex gap-2">
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              aria-label="Display Name"
              className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-sm text-[#0A0A0A] dark:text-white"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 rounded-xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white text-xs font-semibold whitespace-nowrap"
            >
              Save
            </button>
          </form>
          {savedProfileMsg && (
            <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#FBFAF8]">{savedProfileMsg}</p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#0A0A0A1f] dark:border-[#FBFAF824]">
            <div>
              <label className="block text-xs font-semibold text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mb-1.5">
                Weight Unit
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40]">
                {(['kg', 'lb'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => onUpdatePreferences({ ...preferences, weightUnit: unit })}
                    className={`min-h-[36px] rounded-lg text-xs font-bold uppercase ${
                      preferences.weightUnit === unit
                        ? 'bg-white dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-white shadow-xs'
                        : 'text-[#0A0A0Ab2]'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mb-1.5">
                Currency
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40]">
                {(['₹', '$', '€', '£'] as const).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => onUpdatePreferences({ ...preferences, currency: cur })}
                    className={`min-h-[36px] rounded-lg text-xs font-bold ${
                      preferences.currency === cur
                        ? 'bg-white dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-white shadow-xs'
                        : 'text-[#0A0A0Ab2]'
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-[#0A0A0A1f] dark:border-[#FBFAF824]">
            <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FBFAF8] dark:bg-[#0B3B40] cursor-pointer min-h-[48px]">
              <span className="flex items-center gap-2.5 text-xs font-semibold text-[#0A0A0A] dark:text-white">
                {preferences.darkMode ? <Moon className="w-4 h-4 text-[#D5DCD9]" /> : <Sun className="w-4 h-4 text-[#0A0A0A]" />}
                <span>Dark Appearance</span>
              </span>
              <input
                type="checkbox"
                checked={preferences.darkMode}
                onChange={(e) => onUpdatePreferences({ ...preferences, darkMode: e.target.checked })}
                className="w-5 h-5 accent-[#0A0A0A73]"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FBFAF8] dark:bg-[#0B3B40] cursor-pointer min-h-[48px]">
              <span className="flex items-center gap-2.5 text-xs font-semibold text-[#0A0A0A] dark:text-white">
                <Bell className="w-4 h-4 text-[#0A0A0A] dark:text-[#FBFAF8]" />
                <span>Departure & Document Reminders</span>
              </span>
              <input
                type="checkbox"
                checked={preferences.notificationsEnabled}
                onChange={(e) => handleToggleNotifications(e.target.checked)}
                className="w-5 h-5 accent-[#0A0A0A73]"
              />
            </label>
            {notifStatusMsg && (
              <p className="text-[11px] text-[#0A0A0A] dark:text-[#D5DCD9] px-1">{notifStatusMsg}</p>
            )}

            <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FBFAF8] dark:bg-[#0B3B40] cursor-pointer min-h-[48px]">
              <span className="flex items-center gap-2.5 text-xs font-semibold text-[#0A0A0A] dark:text-white">
                <Vibrate className="w-4 h-4 text-[#0A0A0A] dark:text-[#D5DCD9]" />
                <span>Tactile Haptic Feedback</span>
              </span>
              <input
                type="checkbox"
                checked={preferences.hapticsEnabled}
                onChange={(e) => onUpdatePreferences({ ...preferences, hapticsEnabled: e.target.checked })}
                className="w-5 h-5 accent-[#0A0A0A73]"
              />
            </label>
          </div>
        </section>

        {/* Reminders Manager */}
        <section className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-5 border border-[#0A0A0A1f] dark:border-[#FBFAF824] space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#0A0A0A]" />
            <h2 className="font-display text-base font-bold text-[#0A0A0A] dark:text-white">
              Custom Travel Reminders
            </h2>
          </div>

          <form onSubmit={handleAddReminder} className="space-y-2">
            <input
              type="text"
              value={remTitle}
              onChange={(e) => setRemTitle(e.target.value)}
              placeholder="e.g., Download boarding passes & offline city map"
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-xs text-[#0A0A0A] dark:text-white"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="date"
                value={remDate}
                onChange={(e) => setRemDate(e.target.value)}
                className="min-h-[40px] px-2.5 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-xs font-mono text-[#0A0A0A] dark:text-white"
              />
              <select
                value={remCategory}
                onChange={(e) => setRemCategory(e.target.value as ReminderItem['category'])}
                className="min-h-[40px] px-2.5 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-xs text-[#0A0A0A] dark:text-white"
              >
                <option value="Departure">Departure</option>
                <option value="Document">Document</option>
                <option value="Essentials">Essentials</option>
                <option value="Custom">Custom</option>
              </select>
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white text-xs font-semibold flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </form>

          <div className="divide-y divide-[#0A0A0A1f] dark:divide-[#FBFAF824] max-h-60 overflow-y-auto">
            {reminders.map((rem) => (
              <div key={rem.id} className="py-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateReminders(
                      reminders.map((r) => (r.id === rem.id ? { ...r, completed: !r.completed } : r))
                    )
                  }
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left min-h-[40px]"
                >
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      rem.completed
                        ? 'bg-[#0B3B40] border-[#0A0A0A73] text-white'
                        : 'border-[#0A0A0A40] dark:border-[#FBFAF824]'
                    }`}
                  >
                    {rem.completed && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold truncate ${
                        rem.completed ? 'line-through text-[#0A0A0A85]' : 'text-[#0A0A0A] dark:text-white'
                      }`}
                    >
                      {rem.title}
                    </p>
                    <p className="text-[11px] text-[#0A0A0Ab2] dark:text-[#FBFAF8a8]">
                      {rem.category} · {rem.dueDate}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateReminders(reminders.filter((r) => r.id !== rem.id))}
                  aria-label="Delete reminder"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#0A0A0A85] hover:text-[#0A0A0A]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Data Backup, Sample Data Controls & Walkthrough */}
      <section className="bg-white dark:bg-[#FBFAF80f] rounded-3xl p-5 border border-[#0A0A0A1f] dark:border-[#FBFAF824] space-y-3.5">
        <h2 className="font-display text-base font-bold text-[#0A0A0A] dark:text-white">
          Offline Data Backup & App Controls
        </h2>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleExportJSON}
            className="min-h-[44px] px-4 rounded-xl bg-[#D5DCD966] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#D5DCD9] text-xs font-semibold flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON Backup</span>
          </button>

          <label className="min-h-[44px] px-4 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-[#0A0A0A] dark:text-white text-xs font-semibold flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import Backup</span>
            <input type="file" accept="application/json" onChange={handleImportJSON} className="sr-only" />
          </label>

          {hasSampleData && (
            <button
              type="button"
              onClick={() => setClearSampleConfirm(true)}
              className="min-h-[44px] px-4 rounded-xl bg-[#E6DFD266] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#E6DFD2] text-xs font-semibold flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Sample Data</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReplayOnboarding}
            className="min-h-[44px] px-4 rounded-xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-[#0A0A0Acc] dark:text-[#FBFAF8a8] text-xs font-semibold flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Replay Walkthrough</span>
          </button>
        </div>
        {backupMessage && (
          <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#FBFAF8]">{backupMessage}</p>
        )}
      </section>

      <ConfirmDialog
        open={clearSampleConfirm}
        title="Clear pre-loaded sample data?"
        description="This removes sample trips (Kerala, Tokyo, Coorg) and sample documents while preserving any trips, documents, or wardrobe pieces you added yourself."
        confirmLabel="Clear Sample Data"
        onConfirm={() => {
          onClearSampleData();
          setClearSampleConfirm(false);
        }}
        onCancel={() => setClearSampleConfirm(false)}
      />
    </div>
  );
};
