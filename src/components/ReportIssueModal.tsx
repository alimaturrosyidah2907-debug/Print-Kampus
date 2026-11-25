import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { IssueCategory, Order } from '../types/printkampus';

interface ReportIssueModalProps {
  order: Order | null;
  onClose: () => void;
}

const ISSUE_CATEGORIES: { id: IssueCategory; label: string }[] = [
  { id: 'salah_cetak', label: 'Hasil Cetak Salah / Kurang Tajam' },
  { id: 'keterlambatan', label: 'Keterlambatan Pengerjaan' },
  { id: 'kertas_rusak', label: 'Kertas Kusut / Rusak' },
  { id: 'salah_jilid', label: 'Jenis Jilid / Cover Tidak Sesuai' },
  { id: 'pembayaran', label: 'Kendala Pembayaran' },
  { id: 'lainnya', label: 'Lainnya' },
];

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  order,
  onClose,
}) => {
  const { createUserTicket } = useApp();
  const [category, setCategory] = useState<IssueCategory>('salah_cetak');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 8) {
      setError('Jelaskan kendala minimal 8 karakter agar admin dapat menindaklanjuti.');
      return;
    }

    setSubmitting(true);
    const ok = await createUserTicket({
      orderId: order.id,
      category,
      description: description.trim(),
    });
    setSubmitting(false);

    if (ok) {
      setDescription('');
      setError('');
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-issue-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2
              id="report-issue-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Laporkan Kendala ({order.orderNumber})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal lapor kendala"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="issue-category-select"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Kategori Masalah
            </label>
            <select
              id="issue-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as IssueCategory)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            >
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="issue-desc-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Detail Keluhan
            </label>
            <textarea
              id="issue-desc-input"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tuliskan detail ketidaksesuaian cetak atau kendala yang dialami..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
            >
              {submitting ? 'Mengirim...' : 'Kirim Tiket Kendala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
