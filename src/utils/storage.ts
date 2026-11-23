import type { AppState, PackingList } from '../types';

const STORAGE_KEY = 'packsmart_app_state_v2';
const VAULT_KEY_STORAGE = 'packsmart_device_aes_key_v1';
const DB_NAME = 'packsmart_vault_db';
const DB_VERSION = 2;
const FILE_STORE = 'vault_files';
const WARDROBE_PHOTO_STORE = 'wardrobe_photos';

export function loadAppState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

export function saveAppState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export async function sha256Hash(input: string): Promise<string> {
  const data = new TextEncoder().encode(`packsmart_salt_v2:${input}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash) ^ data[i];
  }
  return (hash >>> 0).toString(16);
}

// Local device Web Crypto AES-GCM encryption for sensitive document references
async function getOrCreateLocalCryptoKey(): Promise<CryptoKey | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  try {
    const stored = localStorage.getItem(VAULT_KEY_STORAGE);
    if (stored) {
      const rawBytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
      return await crypto.subtle.importKey('raw', rawBytes, { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt',
      ]);
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    const exported = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    localStorage.setItem(VAULT_KEY_STORAGE, btoa(String.fromCharCode(...exported)));
    return key;
  } catch {
    return null;
  }
}

export async function encryptSensitiveText(plainText: string): Promise<string> {
  if (!plainText) return '';
  const key = await getOrCreateLocalCryptoKey();
  if (!key) return `b64:${btoa(unescape(encodeURIComponent(plainText)))}`;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded));
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  return `aes:${btoa(String.fromCharCode(...combined))}`;
}

export async function decryptSensitiveText(payload: string): Promise<string> {
  if (!payload) return '';
  try {
    if (payload.startsWith('b64:')) {
      return decodeURIComponent(escape(atob(payload.slice(4))));
    }
    if (payload.startsWith('aes:')) {
      const key = await getOrCreateLocalCryptoKey();
      if (!key) return '';
      const combined = Uint8Array.from(atob(payload.slice(4)), (c) => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const cipher = combined.slice(12);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
      return new TextDecoder().decode(plain);
    }
    return payload;
  } catch {
    return '';
  }
}

export function maskDocumentNumber(num: string): string {
  const clean = num.trim();
  if (clean.length <= 4) return '••••';
  return `${clean.slice(0, 2)}••••${clean.slice(-2)}`;
}

// Browser Notification helper where supported & permitted
export async function requestAppNotificationPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    const res = await Notification.requestPermission();
    return res === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export function sendAppNotification(title: string, body: string): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}

// IndexedDB binary file storage for private Document Vault images & PDFs
function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE);
      }
      if (!db.objectStoreNames.contains(WARDROBE_PHOTO_STORE)) {
        db.createObjectStore(WARDROBE_PHOTO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVaultFile(fileId: string, dataUrl: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite');
    tx.objectStore(FILE_STORE).put(dataUrl, fileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getVaultFile(fileId: string): Promise<string | null> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readonly');
    const req = tx.objectStore(FILE_STORE).get(fileId);
    req.onsuccess = () => resolve((req.result as string) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVaultFile(fileId: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite');
    tx.objectStore(FILE_STORE).delete(fileId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// IndexedDB storage for user-uploaded Wardrobe clothing photos
export async function saveWardrobePhoto(photoId: string, dataUrl: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WARDROBE_PHOTO_STORE, 'readwrite');
    tx.objectStore(WARDROBE_PHOTO_STORE).put(dataUrl, photoId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllWardrobePhotos(): Promise<Record<string, string>> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WARDROBE_PHOTO_STORE, 'readonly');
    const store = tx.objectStore(WARDROBE_PHOTO_STORE);
    const result: Record<string, string> = {};
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        result[String(cursor.key)] = String(cursor.value);
        cursor.continue();
      } else {
        resolve(result);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function deleteWardrobePhoto(photoId: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WARDROBE_PHOTO_STORE, 'readwrite');
    tx.objectStore(WARDROBE_PHOTO_STORE).delete(photoId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function compressImageFileToJpegDataUrl(
  file: File,
  maxEdge = 768
): Promise<{ dataUrl: string; base64: string; mimeType: 'image/jpeg' }> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!file.type.startsWith('image/') && !allowed.includes(file.type)) {
    throw new Error(`"${file.name}" is not a supported image format. Please upload JPG, PNG, or WebP photos.`);
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error(`"${file.name}" exceeds the 15 MB photo limit.`);
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Could not decode "${file.name}". Try a standard JPG or PNG photo.`));
    el.src = rawDataUrl;
  });

  const scale = Math.min(1, maxEdge / Math.max(img.width || 1, img.height || 1));
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Image processing is unavailable in this browser.');
  }
  ctx.fillStyle = '#FBFAF8';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

  return { dataUrl, base64, mimeType: 'image/jpeg' };
}

// Encode / decode compact shareable group invite link
export function createShareableListLink(list: PackingList): string {
  const payload = {
    v: 2,
    t: list.title,
    m: list.mode,
    tt: list.tripType,
    d: list.destination,
    s: list.startDate,
    e: list.endDate,
    n: list.travellers,
    c: list.shareCode || Math.random().toString(36).slice(2, 8).toUpperCase(),
    items: list.items.slice(0, 45).map((i) => ({
      n: i.name,
      c: i.category,
      q: i.quantity,
      p: i.packed ? 1 : 0,
      w: i.weightGrams,
      v: i.volumeLiters,
      a: i.assignedTo || '',
    })),
    members: list.groupMembers.map((m) => m.name),
  };
  const json = JSON.stringify(payload);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  return `${baseUrl}#share=${encoded}`;
}

export function parseShareableListHash(hash: string): Partial<PackingList> | null {
  try {
    if (!hash.startsWith('#share=')) return null;
    const encoded = hash.slice('#share='.length);
    const json = decodeURIComponent(escape(atob(encoded)));
    const payload = JSON.parse(json) as {
      t?: string;
      m?: PackingList['mode'];
      tt?: PackingList['tripType'];
      d?: string;
      s?: string;
      e?: string;
      n?: number;
      c?: string;
      items?: Array<{ n: string; c: string; q: number; p: number; w: number; v?: number; a?: string }>;
      members?: string[];
    };
    if (!payload.t || !Array.isArray(payload.items)) return null;

    const palette = ['#D5DCD9', '#BCD2CF', '#E6DFD2', '#E6DFD2', '#BCD2CF'];
    const members = (payload.members && payload.members.length > 0 ? payload.members : ['Trip Host']).map(
      (name, idx) => ({
        id: `m-shared-${idx}`,
        name,
        role: idx === 0 ? ('Owner' as const) : ('Editor' as const),
        initials: name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
        color: palette[idx % palette.length],
      })
    );

    return {
      title: `${payload.t} (Shared)`,
      mode: payload.m || 'Travel',
      tripType: payload.tt || 'Vacation',
      destination: payload.d || 'Shared Destination',
      startDate: payload.s || new Date().toISOString().slice(0, 10),
      endDate: payload.e || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      travellers: payload.n || 2,
      isShared: true,
      shareCode: payload.c,
      groupMembers: members,
      items: payload.items.map((it, idx) => ({
        id: `shared-item-${Date.now()}-${idx}`,
        name: it.n,
        category: it.c || 'Miscellaneous',
        quantity: Math.max(1, it.q || 1),
        packed: it.p === 1,
        weightGrams: Math.max(0, it.w || 150),
        volumeLiters: Math.max(0.1, it.v || 0.8),
        priority: 'Helpful',
        assignedTo: it.a || undefined,
        order: idx,
      })),
    };
  } catch {
    return null;
  }
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
