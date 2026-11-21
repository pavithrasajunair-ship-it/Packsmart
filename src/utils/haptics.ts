export function triggerHaptic(type: 'light' | 'medium' | 'success' = 'light', enabled = true): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    if (type === 'light') {
      navigator.vibrate(10);
    } else if (type === 'medium') {
      navigator.vibrate(20);
    } else {
      navigator.vibrate([12, 30, 16]);
    }
  } catch {
    // Gracefully ignore when browser blocks vibration
  }
}
