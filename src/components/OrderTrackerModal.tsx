import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Order, OrderStatus } from '../types/printkampus';
import { BINDING_LABELS, COLOR_LABELS, formatRupiah } from '../utils/pricing';
import { OrderStatusText } from './StatusLabel';

interface OrderTrackerModalProps {
  order: Order | null;
  onClose: () => void;
  onEditOrder: (order: Order) => void;
  onReportIssue: (order: Order) => void;
}

const PROGRESS_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'menunggu_konfirmasi', label: '1. Buat Pesanan & Konfirmasi' },
  { status: 'diproses', label: '2. Proses Cetak' },
  { status: 'siap_diambil', label: '3. Siap Diambil' },
  { status: 'selesai', label: '4. Selesai' },
];

export const OrderTrackerModal: React.FC<OrderTrackerModalProps> = ({
  order,
  onClose,
  onEditOrder,
  onReportIssue,
}) => {
  const { cancelUserOrder, deleteUserOrder } = useApp();

  if (!order) return null;

  const currentIdx = PROGRESS_STEPS.findIndex((s) => s.status === order.status);
  const canEditOrCancel = order.status === 'menunggu_konfirmasi';

  const handleCancelOrder = async () => {
    const ok = await cancelUserOrder(order.id);
    if (ok) onClose();
  };

  const handleDeleteOrder = async () => {
    const ok = await deleteUserOrder(order.id);
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracker-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl my-auto overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <h2
                id="tracker-modal-title"
                className="text-lg font-bold font-mono-num text-slate-900 dark:text-white"
              >
                {order.orderNumber}
              </h2>
              <OrderStatusText status={order.status} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {order.mitraName} · {order.mitraLocation}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal detail pesanan"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {order.status !== 'dibatalkan' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROGRESS_STEPS.map((step, idx) => {
                const done = currentIdx >= idx;
                return (
                  <div
                    key={step.status}
                    className={`rounded-xl border p-3 ${
                      done
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          done
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-300 dark:text-slate-700'
                        }`}
                      />
                    </div>
                    <p className="text-xs font-semibold leading-snug">{step.label}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-3.5 text-sm text-rose-700 dark:text-rose-300 font-medium">
              Pesanan ini telah dibatalkan.
            </div>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-900 dark:text-white">
                {order.documentTitle}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {order.fileName} ({order.fileSize})
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
              <div>
                <span className="text-slate-400 block">Volume</span>
                <span className="font-semibold font-mono-num">
                  {order.pageCount} hal × {order.copies} salinan
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Kertas & Warna</span>
                <span className="font-semibold">
                  {order.paperSize} {order.paperWeight} · {COLOR_LABELS[order.colorType]}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Finishing & Sisi</span>
                <span className="font-semibold">
                  {BINDING_LABELS[order.binding]} · {order.duplex ? 'Duplex' : '1 Sisi'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Pembayaran</span>
                <span className="font-semibold">
                  {order.paymentMethod} ({order.paymentStatus.replace('_', ' ')})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Target Ambil</span>
                <span className="font-semibold">{order.pickupDeadline}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Biaya</span>
                <span className="font-bold font-mono-num text-indigo-600 dark:text-indigo-400">
                  {formatRupiah(order.totalAmount)}
                </span>
              </div>
            </div>
            {order.notes && (
              <p className="text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                Catatan: {order.notes}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5">
              Riwayat Pembaruan Status
            </h3>
            <div className="space-y-2">
              {order.statusHistory.map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <OrderStatusText status={entry.status} />
                    <p className="text-slate-600 dark:text-slate-300 mt-1">{entry.note}</p>
                  </div>
                  <span className="font-mono-num text-slate-400 whitespace-nowrap shrink-0">
                    {new Date(entry.timestamp).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onReportIssue(order)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Laporkan Kendala</span>
              </button>
            </div>

            {canEditOrCancel && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteOrder}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Batalkan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditOrder(order);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Spesifikasi</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
