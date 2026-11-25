import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Edit3,
  KeyRound,
  LogOut,
  Moon,
  Plus,
  Power,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { IssueStatus, Mitra, OrderStatus } from '../types/printkampus';
import { formatRupiah } from '../utils/pricing';
import { OrderVolumeChart, RevenueBreakdownChart } from './AnalyticsCharts';
import { KatalogTarif } from './KatalogTarif';
import { SimulasiKomisi } from './SimulasiKomisi';
import { IssueStatusText } from './StatusLabel';

type AdminSection = 'ringkasan' | 'mitra' | 'komisi' | 'transaksi' | 'akun';

export const PortalAdmin: React.FC = () => {
  const {
    navigatePortal,
    isDark,
    toggleDark,
    adminUid,
    adminProfile,
    adminAuthError,
    adminOrders,
    adminMitras,
    adminServices,
    adminTickets,
    adminPayouts,
    adminUsers,
    adminAccounts,
    adminInvites,
    commissionSettings,
    loginAdminWithGoogle,
    logoutAdmin,
    updateCommissionSettings,
    adminCreateMitra,
    adminUpdateMitra,
    adminToggleMitraOpen,
    adminDeleteMitra,
    adminCreateService,
    adminUpdateService,
    adminDeleteService,
    adminCreateOrder,
    adminUpdateOrderStatus,
    adminDeleteOrder,
    adminCreateTicket,
    adminUpdateTicket,
    adminDeleteTicket,
    adminProcessPayout,
    adminInviteAccount,
    adminDeleteInvite,
    adminUpdateAccount,
    adminDeleteAccount,
    adminDeleteUser,
  } = useApp();

  const [section, setSection] = useState<AdminSection>('ringkasan');
  const [authBusy, setAuthBusy] = useState(false);

  // Commission form synced with Firestore
  const [commPercent, setCommPercent] = useState(commissionSettings.platformCommissionPercent);
  const [minOrderAmt, setMinOrderAmt] = useState(commissionSettings.minimumOrderAmount);
  const [payoutMin, setPayoutMin] = useState(commissionSettings.payoutMinimum);
  const [hotline, setHotline] = useState(commissionSettings.supportHotline);

  useEffect(() => {
    setCommPercent(commissionSettings.platformCommissionPercent);
    setMinOrderAmt(commissionSettings.minimumOrderAmount);
    setPayoutMin(commissionSettings.payoutMinimum);
    setHotline(commissionSettings.supportHotline);
  }, [commissionSettings]);

  // Mitra Create/Edit state
  const [showAddMitra, setShowAddMitra] = useState(false);
  const [mEmail, setMEmail] = useState('');
  const [mName, setMName] = useState('');
  const [mArea, setMArea] = useState('');
  const [mAddress, setMAddress] = useState('');
  const [mHours, setMHours] = useState('08.00 - 21.00 WIB');
  const [mBw, setMBw] = useState(250);
  const [mColor, setMColor] = useState(1000);
  const [mLakban, setMLakban] = useState(3500);
  const [mSpiral, setMSpiral] = useState(12000);
  const [mHardcover, setMHardcover] = useState(35000);

  const [editingMitra, setEditingMitra] = useState<Mitra | null>(null);
  const [emEmail, setEmEmail] = useState('');
  const [emName, setEmName] = useState('');
  const [emArea, setEmArea] = useState('');
  const [emBw, setEmBw] = useState(250);
  const [emColor, setEmColor] = useState(1000);

  // Manual Order Create state
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [oStudent, setOStudent] = useState('');
  const [oMitraId, setOMitraId] = useState('');
  const [oTitle, setOTitle] = useState('');
  const [oPages, setOPages] = useState(10);
  const [oCopies, setOCopies] = useState(1);

  // Ticket Create & Note state
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [tOrderNum, setTOrderNum] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [ticketNotes, setTicketNotes] = useState<Record<string, string>>({});

  // Admin Account Invite/Edit state
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [aUser, setAUser] = useState('');
  const [aEmail, setAEmail] = useState('');
  const [aName, setAName] = useState('');
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [eaUser, setEaUser] = useState('');
  const [eaName, setEaName] = useState('');
  const [eaEmail, setEaEmail] = useState('');

  const metrics = useMemo(() => {
    const valid = adminOrders.filter((o) => o.status !== 'dibatalkan');
    const totalGmv = valid.reduce((acc, o) => acc + o.totalAmount, 0);
    const totalCommission = valid.reduce((acc, o) => acc + o.platformFee, 0);
    const totalMitraShare = valid.reduce((acc, o) => acc + o.mitraEarnings, 0);
    const activeMitras = adminMitras.filter((m) => m.isOpen).length;
    return { totalGmv, totalCommission, totalMitraShare, activeMitras };
  }, [adminOrders, adminMitras]);

  const handleLoginAdminGoogle = async () => {
    setAuthBusy(true);
    await loginAdminWithGoogle();
    setAuthBusy(false);
  };

  const handleSaveCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateCommissionSettings({
      ...commissionSettings,
      platformCommissionPercent: Math.min(50, Math.max(0, commPercent)),
      minimumOrderAmount: Math.max(0, minOrderAmt),
      payoutMinimum: Math.max(10000, payoutMin),
      supportHotline: hotline.trim() || 'support@printkampus.id',
    });
  };

  const handleCreateMitra = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await adminCreateMitra({
      loginEmail: mEmail,
      name: mName,
      campusArea: mArea,
      address: mAddress,
      operatingHours: mHours,
      bwPerPage: mBw,
      colorPerPage: mColor,
      lakbanPrice: mLakban,
      spiralKawatPrice: mSpiral,
      hardcoverPrice: mHardcover,
    });
    if (ok) {
      setMEmail('');
      setMName('');
      setMArea('');
      setMAddress('');
      setShowAddMitra(false);
    }
  };

  const startEditMitra = (m: Mitra) => {
    setEditingMitra(m);
    setEmEmail(m.loginEmail);
    setEmName(m.name);
    setEmArea(m.campusArea);
    setEmBw(m.pricing.bwPerPage);
    setEmColor(m.pricing.colorPerPage);
  };

  const handleUpdateMitra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMitra) return;
    const ok = await adminUpdateMitra(editingMitra.id, {
      loginEmail: emEmail,
      name: emName,
      campusArea: emArea,
      bwPerPage: emBw,
      colorPerPage: emColor,
    });
    if (ok) setEditingMitra(null);
  };

  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetMitra = oMitraId || adminMitras[0]?.id || '';
    if (!targetMitra) return;
    const ok = await adminCreateOrder({
      studentName: oStudent,
      mitraId: targetMitra,
      documentTitle: oTitle,
      pageCount: oPages,
      copies: oCopies,
    });
    if (ok) {
      setOStudent('');
      setOTitle('');
      setShowAddOrder(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await adminCreateTicket({
      orderNumber: tOrderNum || 'MANUAL',
      description: tDesc,
    });
    if (ok) {
      setTOrderNum('');
      setTDesc('');
      setShowAddTicket(false);
    }
  };

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await adminInviteAccount({
      username: aUser,
      email: aEmail,
      fullName: aName,
    });
    if (ok) {
      setAUser('');
      setAEmail('');
      setAName('');
      setShowAddAdmin(false);
    }
  };

  const sampleOrderTotal = 20000;
  const samplePlatformFee = Math.round((sampleOrderTotal * commPercent) / 100);
  const sampleMitraNet = sampleOrderTotal - samplePlatformFee;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Dedicated Admin Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigatePortal('home')}
              aria-label="Kembali ke beranda pilihan portal"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              PRINT KAMPUS{' '}
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                · Admin
              </span>
            </span>
          </div>

          {adminUid && (
            <nav aria-label="Navigasi Portal Admin" className="hidden lg:flex items-center gap-5">
              {(
                [
                  ['ringkasan', 'Ringkasan & Grafik'],
                  ['mitra', `Mitra & Pencairan (${adminMitras.length})`],
                  ['komisi', 'Komisi & Katalog'],
                  ['transaksi', `Pesanan & Tiket (${adminOrders.length})`],
                  ['akun', 'Akun Firestore'],
                ] as [AdminSection, string][]
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
          )}

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleDark}
              aria-label={isDark ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {adminUid && (
              <button
                type="button"
                onClick={() => void logoutAdmin()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {!adminUid || !adminProfile ? (
          <div className="max-w-md mx-auto mt-8 pk-surface-card rounded-3xl border border-slate-200/80 dark:border-slate-800 p-7 space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Login Portal Admin Platform
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Masuk dengan akun Google Super Admin atau email Admin yang telah diundang di Cloud Firestore.
              </p>
            </div>

            {adminAuthError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300"
              >
                {adminAuthError}
              </div>
            )}

            <button
              type="button"
              onClick={handleLoginAdminGoogle}
              disabled={authBusy}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{authBusy ? 'Memverifikasi...' : 'Masuk dengan Google (Admin)'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mobile Section Tabs */}
            <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  ['ringkasan', 'Ringkasan'],
                  ['mitra', `Mitra (${adminMitras.length})`],
                  ['komisi', 'Komisi & Katalog'],
                  ['transaksi', `Order & Tiket`],
                  ['akun', 'Akun DB'],
                ] as [AdminSection, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    section === id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Dashboard Admin PRINT KAMPUS
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Masuk sebagai {adminProfile.fullName} ({adminProfile.email})
                </p>
              </div>
            </div>

            {/* 4 Financial KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total GMV Transaksi</p>
                <p className="text-2xl font-bold font-mono-num mt-1">
                  {formatRupiah(metrics.totalGmv)}
                </p>
              </div>
              <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Komisi Platform ({commissionSettings.platformCommissionPercent}%)
                </p>
                <p className="text-2xl font-bold font-mono-num mt-1 text-indigo-600 dark:text-indigo-400">
                  {formatRupiah(metrics.totalCommission)}
                </p>
              </div>
              <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Penyaluran ke Mitra</p>
                <p className="text-2xl font-bold font-mono-num mt-1 text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(metrics.totalMitraShare)}
                </p>
              </div>
              <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Mitra Aktif Buka</p>
                <p className="text-2xl font-bold font-mono-num mt-1">
                  {metrics.activeMitras} / {adminMitras.length}
                </p>
              </div>
            </div>

            {/* 1. RINGKASAN & GRAFIK */}
            {section === 'ringkasan' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RevenueBreakdownChart
                  totalGmv={metrics.totalGmv}
                  platformCommission={metrics.totalCommission}
                  mitraShare={metrics.totalMitraShare}
                  commissionPercent={commissionSettings.platformCommissionPercent}
                />
                <OrderVolumeChart orders={adminOrders} />
              </div>
            )}

            {/* 2. MITRA & PENCAIRAN CRUD */}
            {section === 'mitra' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">Manajemen Akun & Toko Mitra (CRUD)</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Daftarkan email Google Mitra dan kelola tarif mereka di Cloud Firestore.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddMitra((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Daftarkan Mitra Baru</span>
                  </button>
                </div>

                {showAddMitra && (
                  <form
                    onSubmit={handleCreateMitra}
                    className="pk-surface-card rounded-2xl border border-indigo-200 dark:border-indigo-800 p-5 space-y-4"
                  >
                    <h3 className="text-sm font-bold">Registrasi Akun & Toko Mitra ke Firestore</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1" htmlFor="new-m-email">
                          Email Google Mitra *
                        </label>
                        <input
                          id="new-m-email"
                          type="email"
                          required
                          value={mEmail}
                          onChange={(e) => setMEmail(e.target.value)}
                          placeholder="berkahprint@gmail.com"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" htmlFor="new-m-name">
                          Nama Toko Mitra *
                        </label>
                        <input
                          id="new-m-name"
                          type="text"
                          required
                          value={mName}
                          onChange={(e) => setMName(e.target.value)}
                          placeholder="Berkah Digital Print"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" htmlFor="new-m-area">
                          Area Kampus *
                        </label>
                        <input
                          id="new-m-area"
                          type="text"
                          required
                          value={mArea}
                          onChange={(e) => setMArea(e.target.value)}
                          placeholder="Gerbang Timur / Teknik"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" htmlFor="new-m-hours">
                          Jam Operasional
                        </label>
                        <input
                          id="new-m-hours"
                          type="text"
                          value={mHours}
                          onChange={(e) => setMHours(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" htmlFor="new-m-addr">
                          Alamat Lengkap
                        </label>
                        <input
                          id="new-m-addr"
                          type="text"
                          value={mAddress}
                          onChange={(e) => setMAddress(e.target.value)}
                          placeholder="Jl. Kampus No. 12"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" htmlFor="new-m-bw">
                          Tarif B/W (Rp)
                        </label>
                        <input
                          id="new-m-bw"
                          type="number"
                          value={mBw}
                          onChange={(e) => setMBw(Number(e.target.value))}
                          className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" htmlFor="new-m-clr">
                          Tarif CLR (Rp)
                        </label>
                        <input
                          id="new-m-clr"
                          type="number"
                          value={mColor}
                          onChange={(e) => setMColor(Number(e.target.value))}
                          className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" htmlFor="new-m-lakban">
                          Jilid Lakban (Rp)
                        </label>
                        <input
                          id="new-m-lakban"
                          type="number"
                          value={mLakban}
                          onChange={(e) => setMLakban(Number(e.target.value))}
                          className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" htmlFor="new-m-spiral">
                          Spiral Kawat (Rp)
                        </label>
                        <input
                          id="new-m-spiral"
                          type="number"
                          value={mSpiral}
                          onChange={(e) => setMSpiral(Number(e.target.value))}
                          className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" htmlFor="new-m-hard">
                          Hardcover Skripsi (Rp)
                        </label>
                        <input
                          id="new-m-hard"
                          type="number"
                          value={mHardcover}
                          onChange={(e) => setMHardcover(Number(e.target.value))}
                          className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddMitra(false)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Simpan Akun Mitra
                      </button>
                    </div>
                  </form>
                )}

                {editingMitra && (
                  <form
                    onSubmit={handleUpdateMitra}
                    className="pk-surface-card rounded-2xl border border-amber-300 dark:border-amber-800 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold">Edit Mitra: {editingMitra.name}</h3>
                      <button
                        type="button"
                        onClick={() => setEditingMitra(null)}
                        className="text-xs text-slate-500 cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="email"
                        required
                        value={emEmail}
                        onChange={(e) => setEmEmail(e.target.value)}
                        aria-label="Edit Email Google Mitra"
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={emName}
                        onChange={(e) => setEmName(e.target.value)}
                        aria-label="Edit Nama Mitra"
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={emArea}
                        onChange={(e) => setEmArea(e.target.value)}
                        aria-label="Edit Area Kampus"
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <input
                        type="number"
                        value={emBw}
                        onChange={(e) => setEmBw(Number(e.target.value))}
                        aria-label="Edit Tarif B/W"
                        className="font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <input
                        type="number"
                        value={emColor}
                        onChange={(e) => setEmColor(Number(e.target.value))}
                        aria-label="Edit Tarif CLR"
                        className="font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Simpan Perubahan Mitra
                      </button>
                    </div>
                  </form>
                )}

                {adminMitras.length === 0 ? (
                  <div className="pk-surface-card rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-xs text-slate-500">
                    Belum ada mitra percetakan terdaftar. Klik &quot;Daftarkan Mitra Baru&quot; untuk menambahkan akun mitra ke database.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {adminMitras.map((m) => (
                      <div
                        key={m.id}
                        className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm font-bold truncate">{m.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {m.loginEmail} · {m.campusArea}
                          </p>
                          <p className="text-xs font-mono-num text-emerald-600 dark:text-emerald-400">
                            B/W {formatRupiah(m.pricing.bwPerPage)} · Saldo{' '}
                            {formatRupiah(m.pendingBalance)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void adminToggleMitraOpen(m.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                              m.isOpen
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{m.isOpen ? 'BUKA' : 'TUTUP'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditMitra(m)}
                            aria-label={`Edit ${m.name}`}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void adminDeleteMitra(m.id)}
                            aria-label={`Hapus ${m.name}`}
                            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mitra Payout Approvals */}
                <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-sm font-bold">Persetujuan Pencairan Saldo Mitra</h3>
                  </div>
                  {adminPayouts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Belum ada pengajuan pencairan saldo dari Mitra.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/70 dark:bg-slate-950/60">
                            <th className="py-3 px-4">Mitra</th>
                            <th className="py-3 px-4">Rekening</th>
                            <th className="py-3 px-4 text-right">Nominal</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {adminPayouts.map((p) => (
                            <tr key={p.id}>
                              <td className="py-3 px-4 font-semibold">{p.mitraName}</td>
                              <td className="py-3 px-4">{p.bankAccount}</td>
                              <td className="py-3 px-4 text-right font-mono-num font-bold">
                                {formatRupiah(p.amount)}
                              </td>
                              <td className="py-3 px-4 uppercase font-semibold">{p.status}</td>
                              <td className="py-3 px-4 text-right">
                                {p.status === 'pending' && (
                                  <div className="inline-flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => void adminProcessPayout(p.id, 'selesai')}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                                    >
                                      Setujui
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void adminProcessPayout(p.id, 'ditolak')}
                                      className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-600 font-semibold cursor-pointer"
                                    >
                                      Tolak
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. KOMISI % & KATALOG CRUD */}
            {section === 'komisi' && (
              <div className="space-y-8">
                <form
                  onSubmit={handleSaveCommission}
                  className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-5 max-w-3xl"
                >
                  <div>
                    <h2 className="text-base font-bold">
                      Pengaturan Potongan Komisi Mitra (%)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Persentase komisi yang dipotong dari setiap transaksi Mitra disimpan ke database dan diterapkan otomatis.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <label htmlFor="adm-comm-input">Persentase Komisi Platform (%)</label>
                        <span className="font-mono-num text-indigo-600 dark:text-indigo-400">
                          {commPercent}% Platform / {100 - commPercent}% Mitra
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          id="adm-comm-range"
                          type="range"
                          min={0}
                          max={50}
                          step={0.5}
                          value={commPercent}
                          onChange={(e) => setCommPercent(Number(e.target.value))}
                          className="flex-1 accent-indigo-600 cursor-pointer"
                        />
                        <input
                          id="adm-comm-input"
                          type="number"
                          min={0}
                          max={50}
                          step={0.5}
                          value={commPercent}
                          onChange={(e) => setCommPercent(Number(e.target.value))}
                          className="w-20 font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-center"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1" htmlFor="adm-min-order">
                        Minimum Transaksi (Rp)
                      </label>
                      <input
                        id="adm-min-order"
                        type="number"
                        min={0}
                        step={500}
                        value={minOrderAmt}
                        onChange={(e) => setMinOrderAmt(Number(e.target.value))}
                        className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1" htmlFor="adm-min-payout">
                        Minimum Pencairan Mitra (Rp)
                      </label>
                      <input
                        id="adm-min-payout"
                        type="number"
                        min={10000}
                        step={5000}
                        value={payoutMin}
                        onChange={(e) => setPayoutMin(Number(e.target.value))}
                        className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1" htmlFor="adm-hotline">
                        Kontak Bantuan Platform
                      </label>
                      <input
                        id="adm-hotline"
                        type="text"
                        value={hotline}
                        onChange={(e) => setHotline(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs space-y-1.5">
                    <p className="font-semibold">Simulasi Contoh Transaksi Rp 20.000:</p>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Potongan Komisi Platform ({commPercent}%)</span>
                      <span className="font-mono-num font-bold text-indigo-600 dark:text-indigo-400">
                        {formatRupiah(samplePlatformFee)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hak Bersih Mitra ({100 - commPercent}%)</span>
                      <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(sampleMitraNet)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Simpan Kebijakan Komisi ke Database
                  </button>
                </form>

                <SimulasiKomisi />

                <KatalogTarif
                  services={adminServices}
                  onCreateService={adminCreateService}
                  onUpdateService={adminUpdateService}
                  onDeleteService={adminDeleteService}
                />
              </div>
            )}

            {/* 4. PESANAN & TIKET CRUD */}
            {section === 'transaksi' && (
              <div className="space-y-8">
                {/* Orders CRUD */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold">Semua Transaksi & Pesanan (CRUD)</h2>
                    <button
                      type="button"
                      onClick={() => setShowAddOrder((v) => !v)}
                      disabled={adminMitras.length === 0}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Catat Pesanan Manual</span>
                    </button>
                  </div>

                  {showAddOrder && (
                    <form
                      onSubmit={handleCreateManualOrder}
                      className="pk-surface-card rounded-2xl border border-indigo-200 dark:border-indigo-800 p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
                    >
                      <input
                        type="text"
                        required
                        value={oStudent}
                        onChange={(e) => setOStudent(e.target.value)}
                        placeholder="Nama Mahasiswa"
                        aria-label="Nama Mahasiswa"
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <select
                        value={oMitraId || adminMitras[0]?.id || ''}
                        onChange={(e) => setOMitraId(e.target.value)}
                        aria-label="Pilih Mitra"
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      >
                        {adminMitras.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required
                        value={oTitle}
                        onChange={(e) => setOTitle(e.target.value)}
                        placeholder="Judul Dokumen"
                        aria-label="Judul Dokumen"
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          value={oPages}
                          onChange={(e) => setOPages(Number(e.target.value))}
                          aria-label="Jumlah Halaman"
                          className="w-1/2 font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs"
                        />
                        <input
                          type="number"
                          min={1}
                          value={oCopies}
                          onChange={(e) => setOCopies(Number(e.target.value))}
                          aria-label="Jumlah Salinan"
                          className="w-1/2 font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Simpan Order
                      </button>
                    </form>
                  )}

                  <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                    {adminOrders.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        Belum ada transaksi pesanan di database.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-500">
                              <th className="py-3 px-4">Order</th>
                              <th className="py-3 px-4">Pemesan & Dokumen</th>
                              <th className="py-3 px-4">Mitra</th>
                              <th className="py-3 px-4 text-right">Total</th>
                              <th className="py-3 px-4 text-right">Komisi</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-right">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {adminOrders.map((o) => (
                              <tr key={o.id}>
                                <td className="py-3 px-4 font-mono-num font-semibold">
                                  {o.orderNumber}
                                </td>
                                <td className="py-3 px-4">
                                  <p className="font-semibold">{o.documentTitle}</p>
                                  <p className="text-slate-500">{o.studentName}</p>
                                </td>
                                <td className="py-3 px-4">{o.mitraName}</td>
                                <td className="py-3 px-4 text-right font-mono-num font-semibold">
                                  {formatRupiah(o.totalAmount)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono-num text-indigo-600 dark:text-indigo-400">
                                  {formatRupiah(o.platformFee)}
                                </td>
                                <td className="py-3 px-4">
                                  <select
                                    aria-label={`Ubah status ${o.orderNumber}`}
                                    value={o.status}
                                    onChange={(e) =>
                                      void adminUpdateOrderStatus(
                                        o.id,
                                        e.target.value as OrderStatus,
                                        `Status diperbarui oleh Admin ke ${e.target.value}.`,
                                      )
                                    }
                                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                                  >
                                    <option value="menunggu_konfirmasi">Menunggu</option>
                                    <option value="diproses">Diproses</option>
                                    <option value="siap_diambil">Siap Diambil</option>
                                    <option value="selesai">Selesai</option>
                                    <option value="dibatalkan">Dibatalkan</option>
                                  </select>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => void adminDeleteOrder(o.id)}
                                    aria-label={`Hapus ${o.orderNumber}`}
                                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tickets CRUD */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold">Tiket Kendala (CRUD)</h2>
                    <button
                      type="button"
                      onClick={() => setShowAddTicket((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Tiket</span>
                    </button>
                  </div>

                  {showAddTicket && (
                    <form
                      onSubmit={handleCreateTicket}
                      className="pk-surface-card rounded-2xl border border-amber-200 dark:border-amber-800 p-4 flex flex-col sm:flex-row gap-3"
                    >
                      <input
                        type="text"
                        value={tOrderNum}
                        onChange={(e) => setTOrderNum(e.target.value)}
                        placeholder="No. Order (opsional)"
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs sm:w-48"
                      />
                      <input
                        type="text"
                        required
                        value={tDesc}
                        onChange={(e) => setTDesc(e.target.value)}
                        placeholder="Deskripsi kendala atau catatan audit..."
                        className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Buat Tiket
                      </button>
                    </form>
                  )}

                  {adminTickets.length === 0 ? (
                    <div className="pk-surface-card rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                      Belum ada tiket kendala di database.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {adminTickets.map((t) => (
                        <div
                          key={t.id}
                          className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <span className="font-mono-num text-xs font-bold">{t.orderNumber}</span>
                              <IssueStatusText status={t.status} />
                            </div>
                            <button
                              type="button"
                              onClick={() => void adminDeleteTicket(t.id)}
                              aria-label={`Hapus tiket ${t.orderNumber}`}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-500">
                            Pelapor: {t.reporterName} · {t.category.replace('_', ' ')}
                          </p>
                          <p className="text-sm">{t.description}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <select
                              aria-label={`Status tiket ${t.orderNumber}`}
                              value={t.status}
                              onChange={(e) =>
                                void adminUpdateTicket(
                                  t.id,
                                  e.target.value as IssueStatus,
                                  ticketNotes[t.id] ?? t.adminNote,
                                )
                              }
                              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                            >
                              <option value="terbuka">Terbuka</option>
                              <option value="investigasi">Investigasi</option>
                              <option value="selesai">Selesai</option>
                              <option value="ditolak">Ditolak</option>
                            </select>
                            <input
                              type="text"
                              value={ticketNotes[t.id] ?? t.adminNote}
                              onChange={(e) =>
                                setTicketNotes((prev) => ({ ...prev, [t.id]: e.target.value }))
                              }
                              placeholder="Tulis solusi atau tindakan admin..."
                              className="sm:col-span-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                void adminUpdateTicket(
                                  t.id,
                                  t.status,
                                  ticketNotes[t.id] ?? t.adminNote,
                                )
                              }
                              className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Simpan Solusi
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. AKUN FIRESTORE (ADMINS CRUD, INVITES & GOOGLE USERS) */}
            {section === 'akun' && (
              <div className="space-y-8">
                {/* Admin Accounts & Invites CRUD */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">Akun & Undangan Admin Firestore (CRUD)</h2>
                      <p className="text-xs text-slate-500">
                        Admin terverifikasi lewat Firebase Authentication dan hak aksesnya tersimpan di Cloud Firestore.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddAdmin((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Undang Email Admin</span>
                    </button>
                  </div>

                  {showAddAdmin && (
                    <form
                      onSubmit={handleInviteAdmin}
                      className="pk-surface-card rounded-2xl border border-indigo-200 dark:border-indigo-800 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
                    >
                      <input
                        type="text"
                        required
                        minLength={2}
                        value={aUser}
                        onChange={(e) => setAUser(e.target.value)}
                        placeholder="Username"
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <input
                        type="email"
                        required
                        value={aEmail}
                        onChange={(e) => setAEmail(e.target.value)}
                        placeholder="Email Google Admin"
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={aName}
                        onChange={(e) => setAName(e.target.value)}
                        placeholder="Nama Lengkap"
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Kirim Undangan Admin
                      </button>
                    </form>
                  )}

                  {adminInvites.length > 0 && (
                    <div className="pk-surface-card rounded-2xl border border-amber-200 dark:border-amber-800/70 p-4 space-y-2">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                        Menunggu Aktivasi Login Google ({adminInvites.length})
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {adminInvites.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{inv.fullName}</p>
                              <p className="text-slate-500 truncate">
                                @{inv.username} · {inv.email}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void adminDeleteInvite(inv.id)}
                              aria-label={`Batalkan undangan ${inv.email}`}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {adminAccounts.map((acc) => {
                      const isEditing = editingAdminId === acc.id;
                      return (
                        <div
                          key={acc.id}
                          className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3"
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={eaUser}
                                onChange={(e) => setEaUser(e.target.value)}
                                placeholder="Username"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                              />
                              <input
                                type="text"
                                value={eaName}
                                onChange={(e) => setEaName(e.target.value)}
                                placeholder="Nama Lengkap"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                              />
                              <input
                                type="email"
                                value={eaEmail}
                                onChange={(e) => setEaEmail(e.target.value)}
                                placeholder="Email"
                                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingAdminId(null)}
                                  className="p-1.5 rounded-lg border cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ok = await adminUpdateAccount(acc.id, {
                                      username: eaUser,
                                      fullName: eaName,
                                      email: eaEmail,
                                    });
                                    if (ok) setEditingAdminId(null);
                                  }}
                                  className="p-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold">{acc.fullName}</p>
                                <p className="text-xs text-slate-500">
                                  @{acc.username} · {acc.email}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAdminId(acc.id);
                                    setEaUser(acc.username);
                                    setEaName(acc.fullName);
                                    setEaEmail(acc.email);
                                  }}
                                  aria-label={`Edit admin ${acc.username}`}
                                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {acc.id !== adminProfile.id && adminAccounts.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => void adminDeleteAccount(acc.id)}
                                    aria-label={`Hapus admin ${acc.username}`}
                                    className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Registered Google Users List */}
                <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-sm font-bold">
                      Pengguna Google Terdaftar ({adminUsers.length})
                    </h3>
                  </div>
                  {adminUsers.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Belum ada pengguna yang login via Google.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/70 dark:bg-slate-950/60">
                            <th className="py-3 px-4">Nama</th>
                            <th className="py-3 px-4">Email Google</th>
                            <th className="py-3 px-4">NIM & Fakultas</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {adminUsers.map((u) => (
                            <tr key={u.id}>
                              <td className="py-3 px-4 font-semibold">{u.name}</td>
                              <td className="py-3 px-4">{u.email}</td>
                              <td className="py-3 px-4">
                                {u.nim || '-'} · {u.faculty || '-'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => void adminDeleteUser(u.id)}
                                  aria-label={`Hapus user ${u.email}`}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
