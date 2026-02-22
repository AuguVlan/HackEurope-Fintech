export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  createdAt: number;
}

let toasts: Toast[] = [];
let listeners: Array<(toasts: Toast[]) => void> = [];

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export function toast(message: string, type: ToastType = 'info') {
  const id = crypto.randomUUID();
  const t: Toast = { id, message, type, createdAt: Date.now() };
  toasts = [...toasts, t];
  notify();

  // Auto-remove after 4 seconds
  setTimeout(() => removeToast(id), 4000);
  return id;
}

export function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function getToasts(): Toast[] {
  return [...toasts];
}

export function subscribeToToasts(listener: (toasts: Toast[]) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
