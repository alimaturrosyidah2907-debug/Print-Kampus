import React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ToastType } from '../types/printkampus';

const TOAST_STYLES: Record<
  ToastType,
  { border: string; iconColor: string; Icon: React.FC<{ className?: string }> }
> = {
  success: {
    border: 'border-emerald-200 dark:border-emerald-800',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  info: {
    border: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400',
    Icon: Info,
  },
  warning: {
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-600 dark:text-amber-400',
    Icon: TriangleAlert,
  },
  error: {
    border: 'border-rose-200 dark:border-rose-800',
    iconColor: 'text-rose-600 dark:text-rose-400',
    Icon: AlertCircle,
  },
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const cfg = TOAST_STYLES[toast.type];
        const Icon = cfg.Icon;
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${cfg.border} bg-white dark:bg-slate-900 p-3.5 shadow-lg text-slate-900 dark:text-slate-100`}
          >
            <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{toast.title}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label={`Tutup notifikasi ${toast.title}`}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
