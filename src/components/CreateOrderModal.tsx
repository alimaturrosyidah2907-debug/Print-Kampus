import React, { useEffect, useMemo, useState } from 'react';
import { FileUp, Printer, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type {
  BindingType,
  ColorType,
  Order,
  PaperSize,
  PaperWeight,
  PaymentMethod,
} from '../types/printkampus';
import {
  BINDING_LABELS,
  calculateOrderPricing,
  estimatePagesFromFileSize,
  formatFileSize,
  formatRupiah,
} from '../utils/pricing';

export interface OrderPresetDraft {
  colorType?: ColorType;
  binding?: BindingType;
  mitraId?: string;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingOrder?: Order | null;
  preset?: OrderPresetDraft | null;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'QRIS',
  'GoPay',
  'DANA',
  'ShopeePay',
  'Transfer VA',
  'COD',
];

const PICKUP_OPTIONS = [
  'Hari ini, 13.00 WIB',
  'Hari ini, 16.00 WIB',
  'Hari ini, 19.00 WIB',
  'Besok, 09.00 WIB',
  'Besok, 13.00 WIB',
];

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  editingOrder = null,
  preset = null,
}) => {
  const {
    publicMitras,
    commissionSettings,
    createUserOrder,
    updateUserOrder,
  } = useApp();

  const openMitras = useMemo(() => publicMitras.filter((m) => m.isOpen), [publicMitras]);
  const defaultMitraId = openMitras[0]?.id ?? publicMitras[0]?.id ?? '';

  const [documentTitle, setDocumentTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [mitraId, setMitraId] = useState(defaultMitraId);
  const [pageCount, setPageCount] = useState<number>(12);
  const [copies, setCopies] = useState<number>(1);
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [paperWeight, setPaperWeight] = useState<PaperWeight>('70gr');
  const [colorType, setColorType] = useState<ColorType>('bw');
  const [duplex, setDuplex] = useState<boolean>(false);
  const [binding, setBinding] = useState<BindingType>('none');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('QRIS');
  const [pickupDeadline, setPickupDeadline] = useState(PICKUP_OPTIONS[0]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFormError('');
    if (editingOrder) {
      setDocumentTitle(editingOrder.documentTitle);
      setFileName(editingOrder.fileName);
      setFileSize(editingOrder.fileSize);
      setMitraId(editingOrder.mitraId);
      setPageCount(editingOrder.pageCount);
      setCopies(editingOrder.copies);
      setPaperSize(editingOrder.paperSize);
      setPaperWeight(editingOrder.paperWeight);
      setColorType(editingOrder.colorType);
      setDuplex(editingOrder.duplex);
      setBinding(editingOrder.binding);
      setNotes(editingOrder.notes);
      setPaymentMethod(editingOrder.paymentMethod);
      setPickupDeadline(editingOrder.pickupDeadline);
    } else {
      setDocumentTitle('');
      setFileName('');
      setFileSize('');
      setMitraId(preset?.mitraId ?? defaultMitraId);
      setPageCount(15);
      setCopies(1);
      setPaperSize('A4');
      setPaperWeight('70gr');
      setColorType(preset?.colorType ?? 'bw');
      setDuplex(false);
      setBinding(preset?.binding ?? 'none');
      setNotes('');
      setPaymentMethod('QRIS');
      setPickupDeadline(PICKUP_OPTIONS[0]);
    }
  }, [isOpen, editingOrder, preset, defaultMitraId]);

  const selectedMitra = useMemo(
    () => publicMitras.find((m) => m.id === mitraId) ?? publicMitras[0],
    [publicMitras, mitraId],
  );

  const pricingResult = useMemo(() => {
    if (!selectedMitra) {
      return {
        unitPrintPrice: 0,
        unitBindingPrice: 0,
        subtotal: 0,
        platformFee: 0,
        mitraEarnings: 0,
        totalAmount: 0,
      };
    }
    return calculateOrderPricing({
      pageCount,
      copies,
      colorType,
      paperSize,
      paperWeight,
      duplex,
      binding,
      pricing: selectedMitra.pricing,
      platformCommissionPercent: commissionSettings.platformCommissionPercent,
    });
  }, [
    selectedMitra,
    pageCount,
    copies,
    colorType,
    paperSize,
    paperWeight,
    duplex,
    binding,
    commissionSettings.platformCommissionPercent,
  ]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileSize(formatFileSize(file.size));
    const estimated = estimatePagesFromFileSize(file.size);
    setPageCount(estimated);
    if (!documentTitle.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      setDocumentTitle(cleanName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentTitle.trim()) {
      setFormError('Judul dokumen wajib diisi.');
      return;
    }
    if (!selectedMitra) {
      setFormError('Belum ada mitra percetakan yang terdaftar. Hubungi Admin.');
      return;
    }
    if (!selectedMitra.isOpen && !editingOrder) {
      setFormError('Mitra yang dipilih sedang tutup. Pilih mitra yang berstatus BUKA.');
      return;
    }
    if (pageCount < 1 || copies < 1) {
      setFormError('Jumlah halaman dan salinan minimal 1.');
      return;
    }
    if (pricingResult.totalAmount < commissionSettings.minimumOrderAmount) {
      setFormError(
        `Minimum transaksi adalah ${formatRupiah(commissionSettings.minimumOrderAmount)}.`,
      );
      return;
    }

    const resolvedFileName =
      fileName.trim() || `${documentTitle.trim().replace(/\s+/g, '_')}.pdf`;
    const resolvedFileSize = fileSize.trim() || `${(pageCount * 0.08).toFixed(2)} MB`;

    setSubmitting(true);
    const payload = {
      mitraId: selectedMitra.id,
      documentTitle: documentTitle.trim(),
      fileName: resolvedFileName,
      fileSize: resolvedFileSize,
      pageCount,
      copies,
      colorType,
      paperSize,
      paperWeight,
      duplex,
      binding,
      notes: notes.trim(),
      paymentMethod,
      pickupDeadline,
    };

    const ok = editingOrder
      ? await updateUserOrder(editingOrder.id, payload)
      : await createUserOrder(payload);
    setSubmitting(false);

    if (ok) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-order-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 id="create-order-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {editingOrder
                ? `Edit Pesanan ${editingOrder.orderNumber}`
                : 'Form Pemesanan Cetak Dokumen'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Unggah dokumen, atur spesifikasi cetak, dan cek rincian biaya secara transparan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal pemesanan"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {formError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300"
              >
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="doc-file-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Unggah Dokumen (.pdf, .doc, .docx, .xls, .xlsx)
                </label>
                <label
                  htmlFor="doc-file-input"
                  className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 cursor-pointer hover:border-indigo-500 transition-colors"
                >
                  <FileUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {fileName || 'Pilih file dari perangkat'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {fileSize
                        ? `Ukuran ${fileSize} · Estimasi ${pageCount} hal`
                        : 'Halaman otomatis diperkirakan'}
                    </p>
                  </div>
                  <input
                    id="doc-file-input"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>

              <div>
                <label
                  htmlFor="doc-title-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Judul / Nama Dokumen
                </label>
                <input
                  id="doc-title-input"
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Contoh: Proposal Skripsi Bab 1-3"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="mitra-select"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Lokasi Mitra Percetakan
              </label>
              {publicMitras.length === 0 ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                  Belum ada mitra percetakan terdaftar oleh Admin.
                </div>
              ) : (
                <select
                  id="mitra-select"
                  value={mitraId}
                  onChange={(e) => setMitraId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {publicMitras.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.campusArea} · Antrean {m.queueCount} ·{' '}
                      {m.isOpen ? 'BUKA' : 'TUTUP'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label
                  htmlFor="page-count-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Jumlah Halaman
                </label>
                <input
                  id="page-count-input"
                  type="number"
                  min={1}
                  max={1000}
                  value={pageCount}
                  onChange={(e) =>
                    setPageCount(Math.max(1, Number.parseInt(e.target.value || '1', 10)))
                  }
                  className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="copies-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Salinan (Copies)
                </label>
                <input
                  id="copies-input"
                  type="number"
                  min={1}
                  max={200}
                  value={copies}
                  onChange={(e) =>
                    setCopies(Math.max(1, Number.parseInt(e.target.value || '1', 10)))
                  }
                  className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="paper-size-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Ukuran Kertas
                </label>
                <select
                  id="paper-size-select"
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="A4">A4 (Standar)</option>
                  <option value="F4">F4 (+Rp 50/hal)</option>
                  <option value="A3">A3 (2× harga/hal)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="paper-weight-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Gramatur Kertas
                </label>
                <select
                  id="paper-weight-select"
                  value={paperWeight}
                  onChange={(e) => setPaperWeight(e.target.value as PaperWeight)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="70gr">HVS 70gr</option>
                  <option value="80gr">HVS 80gr (+Rp 100)</option>
                  <option value="100gr">HVS 100gr (+Rp 250)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="color-type-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Mode Warna
                </label>
                <select
                  id="color-type-select"
                  value={colorType}
                  onChange={(e) => setColorType(e.target.value as ColorType)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="bw">Hitam Putih (B/W)</option>
                  <option value="color">Berwarna (CLR)</option>
                  <option value="mixed">Campuran (B/W + CLR)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="duplex-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Sisi Cetak
                </label>
                <select
                  id="duplex-select"
                  value={duplex ? 'duplex' : 'simplex'}
                  onChange={(e) => setDuplex(e.target.value === 'duplex')}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="simplex">1 Sisi (Simplex)</option>
                  <option value="duplex">Bolak-Balik (Duplex · Hemat)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="binding-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Jenis Jilid
                </label>
                <select
                  id="binding-select"
                  value={binding}
                  onChange={(e) => setBinding(e.target.value as BindingType)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  {(Object.keys(BINDING_LABELS) as BindingType[]).map((key) => (
                    <option key={key} value={key}>
                      {BINDING_LABELS[key]} (
                      {formatRupiah(selectedMitra?.pricing.bindings[key] ?? 0)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="payment-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Metode Pembayaran
                </label>
                <select
                  id="payment-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="pickup-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Target Waktu Ambil
                </label>
                <select
                  id="pickup-select"
                  value={pickupDeadline}
                  onChange={(e) => setPickupDeadline(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  {PICKUP_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="order-notes-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Catatan Khusus untuk Operator
              </label>
              <textarea
                id="order-notes-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Warna cover bufalo biru muda, halaman 10-12 cetak berwarna..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
              />
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>
                  Biaya Cetak ({pageCount} hal × {formatRupiah(pricingResult.unitPrintPrice)} ×{' '}
                  {copies} salinan)
                </span>
                <span className="font-mono-num font-medium text-slate-900 dark:text-slate-100">
                  {formatRupiah(pageCount * pricingResult.unitPrintPrice * copies)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>
                  Biaya Jilid ({BINDING_LABELS[binding]} × {copies})
                </span>
                <span className="font-mono-num font-medium text-slate-900 dark:text-slate-100">
                  {formatRupiah(pricingResult.unitBindingPrice * copies)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Total Estimasi Pembayaran
                </span>
                <span
                  className="text-lg font-bold font-mono-num text-indigo-600 dark:text-indigo-400"
                  data-testid="modal-total-amount"
                >
                  {formatRupiah(pricingResult.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedMitra}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Menyimpan...'
                  : editingOrder
                    ? 'Simpan Perubahan'
                    : 'Kirim Pesanan Cetak'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
