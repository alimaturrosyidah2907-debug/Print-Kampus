import React, { useMemo, useState } from 'react';
import { Check, Edit3, Plus, Power, Trash2, X } from 'lucide-react';
import type { PrintServiceItem, ServiceCategory } from '../types/printkampus';
import { formatRupiah } from '../utils/pricing';

const CATEGORY_TABS: { id: 'all' | ServiceCategory; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'kertas', label: 'Kertas' },
  { id: 'warna', label: 'Warna & Tinta' },
  { id: 'jilid', label: 'Jilid Buku' },
  { id: 'finishing', label: 'Finishing & Laminasi' },
];

interface KatalogTarifProps {
  services: PrintServiceItem[];
  readOnly?: boolean;
  onCreateService?: (payload: Record<string, unknown>) => Promise<boolean>;
  onUpdateService?: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  onDeleteService?: (id: string) => Promise<boolean>;
}

export const KatalogTarif: React.FC<KatalogTarifProps> = ({
  services,
  readOnly = false,
  onCreateService,
  onUpdateService,
  onDeleteService,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | ServiceCategory>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // Add service form
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('kertas');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState(500);
  const [unit, setUnit] = useState('per halaman');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editUnit, setEditUnit] = useState('per halaman');
  const [editDesc, setEditDesc] = useState('');

  const filtered = useMemo(() => {
    return services.filter(
      (s) => categoryFilter === 'all' || s.category === categoryFilter,
    );
  }, [services, categoryFilter]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateService || !name.trim() || !code.trim()) return;
    const ok = await onCreateService({
      code: code.trim().toUpperCase(),
      category,
      name: name.trim(),
      description: description.trim() || 'Layanan percetakan kampus.',
      basePrice: Math.max(0, basePrice),
      unit: unit.trim() || 'per halaman',
    });
    if (ok) {
      setCode('');
      setName('');
      setDescription('');
      setBasePrice(500);
      setShowAddForm(false);
    }
  };

  const startInlineEdit = (item: PrintServiceItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(item.basePrice);
    setEditUnit(item.unit);
    setEditDesc(item.description);
  };

  const saveInlineEdit = async (id: string) => {
    if (!onUpdateService) return;
    const ok = await onUpdateService(id, {
      name: editName.trim(),
      basePrice: Math.max(0, editPrice),
      unit: editUnit.trim(),
      description: editDesc.trim(),
    });
    if (ok) setEditingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Katalog Tarif & Layanan Cetak
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {readOnly
              ? 'Daftar layanan dan tarif resmi yang dikelola oleh Admin & Mitra percetakan.'
              : 'Kelola master layanan cetak kampus lintas kategori kertas, tinta, jilid, dan laminasi.'}
          </p>
        </div>

        {!readOnly && onCreateService && (
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Layanan</span>
          </button>
        )}
      </div>

      {!readOnly && showAddForm && (
        <form
          onSubmit={handleAdd}
          className="pk-surface-card rounded-2xl border border-indigo-200 dark:border-indigo-800 p-5 space-y-3"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Tambah Item Katalog Baru
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" htmlFor="srv-code">
                Kode Layanan
              </label>
              <input
                id="srv-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="KRT-A4-70"
                className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" htmlFor="srv-cat">
                Kategori
              </label>
              <select
                id="srv-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as ServiceCategory)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="kertas">Kertas</option>
                <option value="warna">Warna & Tinta</option>
                <option value="jilid">Jilid Buku</option>
                <option value="finishing">Finishing & Laminasi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" htmlFor="srv-name">
                Nama Layanan
              </label>
              <input
                id="srv-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cetak Hitam Putih A4 70gr"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" htmlFor="srv-price">
                Tarif Dasar (Rp)
              </label>
              <input
                id="srv-price"
                type="number"
                min={0}
                value={basePrice}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" htmlFor="srv-unit">
                Satuan
              </label>
              <input
                id="srv-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" htmlFor="srv-desc">
                Deskripsi Singkat
              </label>
              <input
                id="srv-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Keterangan layanan..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
            >
              Simpan Layanan
            </button>
          </div>
        </form>
      )}

      {/* Category Filter */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit max-w-full overflow-x-auto">
        {CATEGORY_TABS.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryFilter(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
              categoryFilter === cat.id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Catalog List */}
      {filtered.length === 0 ? (
        <div className="pk-surface-card rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Belum ada layanan di katalog tarif
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {readOnly
              ? 'Admin atau Mitra belum menambahkan daftar layanan ke database.'
              : 'Klik "Tambah Layanan" untuk mulai mengisi daftar layanan & tarif.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <div
                key={item.id}
                className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono-num text-slate-500 dark:text-slate-400">
                      {item.code} · {item.category}
                    </span>
                    <span
                      className={`font-bold ${
                        item.isActive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.isActive ? 'AKTIF' : 'NON-AKTIF'}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label
                          className="block text-[11px] font-semibold text-slate-500 mb-1"
                          htmlFor={`edit-name-${item.id}`}
                        >
                          Nama Layanan
                        </label>
                        <input
                          id={`edit-name-${item.id}`}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label
                            className="block text-[11px] font-semibold text-slate-500 mb-1"
                            htmlFor={`edit-price-${item.id}`}
                          >
                            Tarif Dasar (Rp)
                          </label>
                          <input
                            id={`edit-price-${item.id}`}
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            className="w-full font-mono-num rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label
                            className="block text-[11px] font-semibold text-slate-500 mb-1"
                            htmlFor={`edit-unit-${item.id}`}
                          >
                            Satuan
                          </label>
                          <input
                            id={`edit-unit-${item.id}`}
                            type="text"
                            value={editUnit}
                            onChange={(e) => setEditUnit(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          className="block text-[11px] font-semibold text-slate-500 mb-1"
                          htmlFor={`edit-desc-${item.id}`}
                        >
                          Deskripsi
                        </label>
                        <input
                          id={`edit-desc-${item.id}`}
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {item.name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {item.description}
                      </p>
                      <p className="text-base font-bold font-mono-num text-indigo-600 dark:text-indigo-400">
                        {formatRupiah(item.basePrice)}{' '}
                        <span className="text-xs font-normal text-slate-500">/ {item.unit}</span>
                      </p>
                    </>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {onUpdateService && (
                      <button
                        type="button"
                        onClick={() => onUpdateService(item.id, { isActive: !item.isActive })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{item.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1.5">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveInlineEdit(item.id)}
                            aria-label={`Simpan edit ${item.name}`}
                            className="p-2 rounded-lg bg-emerald-600 text-white cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            aria-label="Batal edit"
                            className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          {onUpdateService && (
                            <button
                              type="button"
                              onClick={() => startInlineEdit(item)}
                              aria-label={`Edit ${item.name}`}
                              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteService && (
                            <button
                              type="button"
                              onClick={() => onDeleteService(item.id)}
                              aria-label={`Hapus ${item.name}`}
                              className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
