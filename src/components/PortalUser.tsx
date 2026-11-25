import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Edit3,
  FileText,
  LogOut,
  Moon,
  Palette,
  Printer,
  Search,
  Star,
  Sun,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PrintStudioCanvas } from '../three/PrintStudioCanvas';
import type { PrintFinishMode } from '../three/models';
import type { Order, OrderStatus } from '../types/printkampus';
import { BINDING_LABELS, formatRupiah } from '../utils/pricing';
import { CreateOrderModal, type OrderPresetDraft } from './CreateOrderModal';
import { KatalogTarif } from './KatalogTarif';
import { OrderTrackerModal } from './OrderTrackerModal';
import { ReportIssueModal } from './ReportIssueModal';
import { IssueStatusText, OrderStatusText } from './StatusLabel';

type UserSection = 'beranda' | 'katalog' | 'kendala';

const STATUS_FILTERS: { id: 'all' | OrderStatus; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'menunggu_konfirmasi', label: 'Menunggu' },
  { id: 'diproses', label: 'Dicetak' },
  { id: 'siap_diambil', label: 'Siap Diambil' },
  { id: 'selesai', label: 'Selesai' },
];

export const PortalUser: React.FC = () => {
  const {
    navigatePortal,
    isDark,
    toggleDark,
    publicMitras,
    publicServices,
    userUid,
    userProfile,
    userOrders,
    userTickets,
    loginUserWithGoogle,
    logoutUser,
    updateUserProfile,
    updateUserTicket,
    deleteUserTicket,
  } = useApp();

  const [section, setSection] = useState<UserSection>('beranda');
  const [finishMode, setFinishMode] = useState<PrintFinishMode>('spiral');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [authLoading, setAuthLoading] = useState(false);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderPreset, setOrderPreset] = useState<OrderPresetDraft | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [reportingOrder, setReportingOrder] = useState<Order | null>(null);

  // Profile editor
  const [editingProfile, setEditingProfile] = useState(false);
  const [profName, setProfName] = useState('');
  const [profNim, setProfNim] = useState('');
  const [profFaculty, setProfFaculty] = useState('');
  const [profPhone, setProfPhone] = useState('');

  // Ticket edit
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [editTicketDesc, setEditTicketDesc] = useState('');
  const [editTicketCat, setEditTicketCat] = useState('lainnya');

  const activeOrders = useMemo(
    () => userOrders.filter((o) => o.status !== 'selesai' && o.status !== 'dibatalkan'),
    [userOrders],
  );

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return userOrders.filter((o) => {
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchesQuery =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.documentTitle.toLowerCase().includes(q) ||
        o.mitraName.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [userOrders, searchQuery, statusFilter]);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    await loginUserWithGoogle();
    setAuthLoading(false);
  };

  const openCreateModal = (preset?: OrderPresetDraft) => {
    if (!userUid) {
      void handleGoogleLogin();
      return;
    }
    setEditingOrder(null);
    setOrderPreset(preset ?? null);
    setCreateOpen(true);
  };

  const openEditModal = (order: Order) => {
    setOrderPreset(null);
    setEditingOrder(order);
    setCreateOpen(true);
  };

  const openProfileForm = () => {
    if (!userProfile) return;
    setProfName(userProfile.name);
    setProfNim(userProfile.nim);
    setProfFaculty(userProfile.faculty);
    setProfPhone(userProfile.phone);
    setEditingProfile(true);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await updateUserProfile({
      name: profName.trim(),
      nim: profNim.trim(),
      faculty: profFaculty.trim(),
      phone: profPhone.trim(),
    });
    if (ok) setEditingProfile(false);
  };

  const anyModalOpen = createOpen || trackingOrder !== null || reportingOrder !== null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Dedicated User Portal Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigatePortal('home')}
              aria-label="Kembali ke beranda pilihan portal"
              className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSection('beranda')}
              className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap truncate cursor-pointer"
            >
              PRINT KAMPUS <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">· User</span>
            </button>
          </div>

          <nav aria-label="Navigasi Portal User" className="hidden md:flex items-center gap-6">
            {(
              [
                ['beranda', 'Beranda & Pesanan'],
                ['katalog', 'Katalog Tarif'],
                ['kendala', `Tiket Kendala (${userTickets.length})`],
              ] as [UserSection, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  section === id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleDark}
              aria-label={isDark ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {userUid ? (
              <>
                <button
                  type="button"
                  onClick={() => openCreateModal()}
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Pesan Cetak</span>
                </button>
                <button
                  type="button"
                  onClick={() => void logoutUser()}
                  aria-label="Keluar akun Google"
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="sm:hidden">{authLoading ? 'Menghubungkan...' : 'Masuk Google'}</span>
                <span className="hidden sm:inline">{authLoading ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Mobile Nav */}
        <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              ['beranda', 'Beranda & Pesanan'],
              ['katalog', 'Katalog Tarif'],
              ['kendala', `Kendala (${userTickets.length})`],
            ] as [UserSection, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                section === id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {section === 'beranda' && (
          <div className="space-y-8">
            {/* Hero Section — ONLY "PRINT KAMPUS" Title */}
            <section className="pk-hero-shell rounded-3xl text-white border border-indigo-500/20 p-5 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="max-w-2xl space-y-2">
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
                    PRINT KAMPUS
                  </h1>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                    Unggah dokumen PDF atau Word, tentukan spesifikasi kertas dan jilid, pilih mitra percetakan terdekat, dan pantau status cetak Anda.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {userUid ? (
                    <button
                      type="button"
                      onClick={() => openCreateModal()}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Mulai Pesan Cetak</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={authLoading}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>{authLoading ? 'Menghubungkan Google...' : 'Masuk dengan Google'}</span>
                    </button>
                  )}
                </div>
              </div>

              <PrintStudioCanvas
                finishMode={finishMode}
                onFinishModeChange={setFinishMode}
                paused={anyModalOpen}
                isDark={isDark}
                onQuickOrder={(mode) => {
                  if (mode === 'bw') openCreateModal({ colorType: 'bw', binding: 'none' });
                  else if (mode === 'color') openCreateModal({ colorType: 'color', binding: 'none' });
                  else if (mode === 'spiral') openCreateModal({ colorType: 'mixed', binding: 'spiral_kawat' });
                  else openCreateModal({ colorType: 'bw', binding: 'hardcover' });
                }}
              />
            </section>

            {/* Google Account Status / Profile Card */}
            {!userUid ? (
              <section className="pk-surface-card rounded-2xl border border-indigo-200 dark:border-indigo-800/60 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Masuk dengan Akun Google untuk Memesan
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Akun User menggunakan login Google terverifikasi sehingga riwayat pesanan dan tiket kendala tersimpan aman ke profil Anda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{authLoading ? 'Memproses...' : 'Masuk dengan Google'}</span>
                </button>
              </section>
            ) : (
              <section className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {userProfile?.photoUrl ? (
                      <img
                        src={userProfile.photoUrl}
                        alt={userProfile.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                        {userProfile?.name?.slice(0, 1).toUpperCase() ?? 'U'}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {userProfile?.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {userProfile?.email} · NIM: {userProfile?.nim || 'Belum diisi'} ·{' '}
                        {userProfile?.faculty || 'Fakultas belum diisi'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openProfileForm}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Lengkapi Profil Mahasiswa</span>
                  </button>
                </div>

                {editingProfile && (
                  <form
                    onSubmit={saveProfile}
                    className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800"
                  >
                    <input
                      type="text"
                      required
                      value={profName}
                      onChange={(e) => setProfName(e.target.value)}
                      placeholder="Nama Lengkap"
                      aria-label="Nama Lengkap"
                      className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      value={profNim}
                      onChange={(e) => setProfNim(e.target.value)}
                      placeholder="NIM"
                      aria-label="NIM"
                      className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono-num"
                    />
                    <input
                      type="text"
                      value={profFaculty}
                      onChange={(e) => setProfFaculty(e.target.value)}
                      placeholder="Fakultas / Jurusan"
                      aria-label="Fakultas"
                      className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={profPhone}
                        onChange={(e) => setProfPhone(e.target.value)}
                        placeholder="No. WhatsApp"
                        aria-label="Nomor WhatsApp"
                        className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono-num"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Simpan
                      </button>
                    </div>
                  </form>
                )}
              </section>
            )}

            {/* 3 Quick Service Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <FileText className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Hitam Putih (B/W)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Diktat, makalah, dan draf skripsi dengan opsi cetak hemat bolak-balik.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFinishMode('bw')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Lihat di 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateModal({ colorType: 'bw', binding: 'none' })}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Pesan B/W
                  </button>
                </div>
              </div>

              <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <Palette className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Berwarna (CLR)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Toner laser warna presisi untuk grafik penelitian, poster A3, dan slide kuliah.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFinishMode('color')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Lihat di 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateModal({ colorType: 'color', binding: 'none' })}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Pesan CLR
                  </button>
                </div>
              </div>

              <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Paket Jilid Lengkap (JLD)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Lakban mika, spiral kawat 360°, hingga hardcover skripsi foil emas.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFinishMode('hardcover')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Lihat di 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateModal({ colorType: 'mixed', binding: 'hardcover' })}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Pesan Jilid
                  </button>
                </div>
              </div>
            </section>

            {/* User Orders History (if logged in) */}
            {userUid && (
              <section aria-labelledby="order-history-heading" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2
                      id="order-history-heading"
                      className="text-lg font-bold text-slate-900 dark:text-white"
                    >
                      Riwayat & Pelacakan Pesanan Saya
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono-num font-semibold">{activeOrders.length}</span>{' '}
                      pesanan berjalan ·{' '}
                      <span className="font-mono-num font-semibold">{userOrders.length}</span>{' '}
                      total pesanan
                    </p>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari no. order atau judul..."
                      aria-label="Cari riwayat pesanan"
                      className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto w-fit max-w-full">
                  {STATUS_FILTERS.map((sf) => (
                    <button
                      key={sf.id}
                      type="button"
                      onClick={() => setStatusFilter(sf.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                        statusFilter === sf.id
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {sf.label}
                    </button>
                  ))}
                </div>

                <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                  {filteredOrders.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Belum ada pesanan cetak
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Buat pesanan cetak baru setelah Mitra percetakan tersedia.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/60">
                            <th className="py-3 px-4">No. Order</th>
                            <th className="py-3 px-4">Dokumen & Spesifikasi</th>
                            <th className="py-3 px-4">Mitra Percetakan</th>
                            <th className="py-3 px-4 text-right">Total</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          {filteredOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                              <td className="py-3.5 px-4 font-mono-num font-semibold whitespace-nowrap">
                                {order.orderNumber}
                              </td>
                              <td className="py-3.5 px-4 max-w-xs">
                                <p className="font-semibold truncate">{order.documentTitle}</p>
                                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  {order.pageCount} hal × {order.copies} · {order.paperSize}{' '}
                                  {order.paperWeight} · {BINDING_LABELS[order.binding]}
                                </p>
                              </td>
                              <td className="py-3.5 px-4">
                                <p className="font-medium">{order.mitraName}</p>
                                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  {order.pickupDeadline}
                                </p>
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono-num font-semibold whitespace-nowrap">
                                {formatRupiah(order.totalAmount)}
                              </td>
                              <td className="py-3.5 px-4">
                                <OrderStatusText status={order.status} />
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => setTrackingOrder(order)}
                                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold whitespace-nowrap cursor-pointer"
                                >
                                  Detail & Lacak
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Mitra Directory (empty initially until Admin adds Mitras) */}
            <section aria-labelledby="mitra-directory-heading" className="space-y-4">
              <div>
                <h2
                  id="mitra-directory-heading"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  Mitra Percetakan Terdaftar
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Daftar mitra aktif yang dikelola oleh Admin Platform.
                </p>
              </div>

              {publicMitras.length === 0 ? (
                <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-10 text-center space-y-1.5">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Belum ada mitra percetakan yang terdaftar
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Admin Platform dapat mendaftarkan akun & lokasi Mitra melalui Portal Admin.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {publicMitras.map((mitra) => (
                    <div
                      key={mitra.id}
                      className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span
                            className={`font-semibold ${
                              mitra.isOpen
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {mitra.isOpen ? 'BUKA' : 'TUTUP'}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono-num text-slate-600 dark:text-slate-300">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            {mitra.rating.toFixed(1)}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                          {mitra.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {mitra.campusArea} · {mitra.operatingHours}
                        </p>
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">
                            Antrean: <strong className="font-mono-num">{mitra.queueCount}</strong>
                          </span>
                          <span className="font-mono-num font-semibold text-indigo-600 dark:text-indigo-400">
                            B/W {formatRupiah(mitra.pricing.bwPerPage)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!mitra.isOpen}
                        onClick={() => openCreateModal({ mitraId: mitra.id })}
                        className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          mitra.isOpen
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {mitra.isOpen ? 'Pesan di Mitra Ini' : 'Sedang Tutup'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {section === 'katalog' && <KatalogTarif services={publicServices} readOnly />}

        {section === 'kendala' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Tiket Kendala Saya
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kelola laporan kendala hasil cetak Anda. Untuk membuat tiket baru, buka detail pesanan Anda.
              </p>
            </div>

            {!userUid ? (
              <div className="pk-surface-card rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
                <p className="text-sm font-semibold">Masuk dengan Google terlebih dahulu</p>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Masuk dengan Google
                </button>
              </div>
            ) : userTickets.length === 0 ? (
              <div className="pk-surface-card rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                Belum ada tiket kendala yang dilaporkan.
              </div>
            ) : (
              <div className="space-y-3">
                {userTickets.map((t) => {
                  const isEditing = editingTicketId === t.id;
                  return (
                    <div
                      key={t.id}
                      className="pk-surface-card rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono-num text-xs font-bold">{t.orderNumber}</span>
                          <IssueStatusText status={t.status} />
                        </div>
                        {t.status === 'terbuka' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTicketId(t.id);
                                setEditTicketDesc(t.description);
                                setEditTicketCat(t.category);
                              }}
                              aria-label={`Edit tiket ${t.orderNumber}`}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteUserTicket(t.id)}
                              aria-label={`Hapus tiket ${t.orderNumber}`}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <select
                            value={editTicketCat}
                            onChange={(e) => setEditTicketCat(e.target.value)}
                            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                          >
                            <option value="salah_cetak">Salah Cetak</option>
                            <option value="keterlambatan">Keterlambatan</option>
                            <option value="kertas_rusak">Kertas Rusak</option>
                            <option value="salah_jilid">Salah Jilid</option>
                            <option value="pembayaran">Pembayaran</option>
                            <option value="lainnya">Lainnya</option>
                          </select>
                          <textarea
                            rows={2}
                            value={editTicketDesc}
                            onChange={(e) => setEditTicketDesc(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingTicketId(null)}
                              className="px-3 py-1 rounded-lg border text-xs cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await updateUserTicket(t.id, {
                                  category: editTicketCat,
                                  description: editTicketDesc,
                                });
                                if (ok) setEditingTicketId(null);
                              }}
                              className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Simpan
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-slate-800 dark:text-slate-100">
                            {t.description}
                          </p>
                          {t.adminNote && (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-3 py-2">
                              Catatan Admin: {t.adminNote}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <CreateOrderModal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditingOrder(null);
          setOrderPreset(null);
        }}
        editingOrder={editingOrder}
        preset={orderPreset}
      />

      <OrderTrackerModal
        order={trackingOrder}
        onClose={() => setTrackingOrder(null)}
        onEditOrder={openEditModal}
        onReportIssue={(order) => {
          setTrackingOrder(null);
          setReportingOrder(order);
        }}
      />

      <ReportIssueModal
        order={reportingOrder}
        onClose={() => setReportingOrder(null)}
      />
    </div>
  );
};
