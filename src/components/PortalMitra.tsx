import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Edit3,
  KeyRound,
  LogOut,
  Moon,
  Power,
  Printer,
  Sun,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { OrderStatus } from '../types/printkampus';
import { BINDING_LABELS, formatRupiah } from '../utils/pricing';
import { OrderVolumeChart, RevenueBreakdownChart } from './AnalyticsCharts';
import { KatalogTarif } from './KatalogTarif';
import { OrderStatusText } from './StatusLabel';

type MitraSection = 'antrean' | 'katalog' | 'pencairan';

export const PortalMitra: React.FC = () => {
  const {
    navigatePortal,
    isDark,
    toggleDark,
    mitraToken,
    mitraProfile,
    mitraOrders,
    mitraServices,
    mitraPayouts,
    commissionSettings,
    loginMitra,
    logoutMitra,
    updateMitraProfile,
    toggleMitraSelfOpen,
    updateMitraOrderStatus,
    createMitraService,
    updateMitraService,
    deleteMitraService,
    requestMitraPayout,
    cancelMitraPayout,
  } = useApp();

  const [section, setSection] = useState<MitraSection>('antrean');
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [editingProfile, setEditingProfile] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Profile & pricing edit fields
  const [editName, setEditName] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editBw, setEditBw] = useState(250);
  const [editColor, setEditColor] = useState(1000);
  const [editDuplexDisc, setEditDuplexDisc] = useState(40);
  const [editLakban, setEditLakban] = useState(3500);
  const [editSpiralKawat, setEditSpiralKawat] = useState(12000);
  const [editHardcover, setEditHardcover] = useState(35000);
  const [newPassword, setNewPassword] = useState('');

  // Payout form state
  const [payoutAmount, setPayoutAmount] = useState('50000');
  const [bankAccount, setBankAccount] = useState('');

  const filteredOrders = useMemo(() => {
    return mitraOrders.filter(
      (o) => filterStatus === 'all' || o.status === filterStatus,
    );
  }, [mitraOrders, filterStatus]);

  const financeMetrics = useMemo(() => {
    const valid = mitraOrders.filter((o) => o.status !== 'dibatalkan');
    const gmv = valid.reduce((acc, o) => acc + o.totalAmount, 0);
    const comm = valid.reduce((acc, o) => acc + o.platformFee, 0);
    const net = valid.reduce((acc, o) => acc + o.mitraEarnings, 0);
    return { gmv, comm, net };
  }, [mitraOrders]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    await loginMitra(loginEmail, loginPassword);
    setLoggingIn(false);
  };

  const openProfileEditor = () => {
    if (!mitraProfile) return;
    setEditName(mitraProfile.name);
    setEditArea(mitraProfile.campusArea);
    setEditAddress(mitraProfile.address);
    setEditHours(mitraProfile.operatingHours);
    setEditBw(mitraProfile.pricing.bwPerPage);
    setEditColor(mitraProfile.pricing.colorPerPage);
    setEditDuplexDisc(mitraProfile.pricing.duplexDiscountPerPage);
    setEditLakban(mitraProfile.pricing.bindings.lakban);
    setEditSpiralKawat(mitraProfile.pricing.bindings.spiral_kawat);
    setEditHardcover(mitraProfile.pricing.bindings.hardcover);
    setNewPassword('');
    setEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mitraProfile) return;
    const ok = await updateMitraProfile({
      name: editName.trim(),
      campusArea: editArea.trim(),
      address: editAddress.trim(),
      operatingHours: editHours.trim(),
      newPassword: newPassword.trim() || undefined,
      pricing: {
        ...mitraProfile.pricing,
        bwPerPage: Math.max(50, editBw),
        colorPerPage: Math.max(100, editColor),
        duplexDiscountPerPage: Math.max(0, editDuplexDisc),
        bindings: {
          ...mitraProfile.pricing.bindings,
          lakban: Math.max(0, editLakban),
          spiral_kawat: Math.max(0, editSpiralKawat),
          hardcover: Math.max(0, editHardcover),
        },
      },
    });
    if (ok) {
      setEditingProfile(false);
      setNewPassword('');
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number.parseInt(payoutAmount, 10);
    const ok = await requestMitraPayout(numeric, bankAccount.trim());
    if (ok) {
      setBankAccount('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Dedicated Mitra Top Bar */}
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
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                · Mitra
              </span>
            </span>
          </div>

          {mitraToken && (
            <nav aria-label="Navigasi Portal Mitra" className="hidden md:flex items-center gap-6">
              {(
                [
                  ['antrean', 'Antrean & Toko'],
                  ['katalog', 'Katalog Layanan'],
                  ['pencairan', 'Pencairan Saldo'],
                ] as [MitraSection, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    section === id
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
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
            {mitraToken && (
              <button
                type="button"
                onClick={logoutMitra}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {!mitraToken || !mitraProfile ? (
          <div className="max-w-md mx-auto mt-8 pk-surface-card rounded-3xl border border-slate-200/80 dark:border-slate-800 p-7 space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Login Portal Mitra Percetakan
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Masukkan email dan kata sandi akun Mitra yang telah didaftarkan secara manual oleh Admin di database.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" htmlFor="mitra-login-email">
                  Email Login Mitra
                </label>
                <input
                  id="mitra-login-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="mitra@percetakan.id"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" htmlFor="mitra-login-pass">
                  Kata Sandi
                </label>
                <input
                  id="mitra-login-pass"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loggingIn ? 'Memverifikasi...' : 'Masuk ke Panel Mitra'}</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mobile Section Switcher */}
            <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  ['antrean', 'Antrean & Toko'],
                  ['katalog', 'Katalog Layanan'],
                  ['pencairan', 'Pencairan Saldo'],
                ] as [MitraSection, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    section === id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Store Header Card */}
            <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {mitraProfile.loginEmail} · {mitraProfile.campusArea}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {mitraProfile.name}
                  </h1>
                  <span
                    className={`text-xs font-bold ${
                      mitraProfile.isOpen
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    Status: {mitraProfile.isOpen ? 'BUKA' : 'TUTUP'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={openProfileEditor}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profil, Tarif & Sandi</span>
                </button>

                <button
                  type="button"
                  onClick={() => void toggleMitraSelfOpen()}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer ${
                    mitraProfile.isOpen
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{mitraProfile.isOpen ? 'Tutup Toko' : 'Buka Toko'}</span>
                </button>
              </div>
            </div>

            {/* Profile & Tariff Editor */}
            {editingProfile && (
              <form
                onSubmit={handleSaveProfile}
                className="pk-surface-card rounded-2xl border border-emerald-200 dark:border-emerald-800 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Konfigurasi Profil, Tarif & Sandi Mitra
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="text-xs font-medium text-slate-500 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" htmlFor="m-edit-name">
                      Nama Toko
                    </label>
                    <input
                      id="m-edit-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" htmlFor="m-edit-area">
                      Area Kampus
                    </label>
                    <input
                      id="m-edit-area"
                      type="text"
                      value={editArea}
                      onChange={(e) => setEditArea(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" htmlFor="m-edit-hours">
                      Jam Operasional
                    </label>
                    <input
                      id="m-edit-hours"
                      type="text"
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" htmlFor="m-edit-addr">
                      Alamat Lengkap
                    </label>
                    <input
                      id="m-edit-addr"
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" htmlFor="m-edit-bw">
                      Tarif B/W (Rp/hal)
                    </label>
                    <input
                      id="m-edit-bw"
                      type="number"
                      value={editBw}
                      onChange={(e) => setEditBw(Number(e.target.value))}
                      className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" htmlFor="m-edit-clr">
                      Tarif Warna (Rp/hal)
                    </label>
                    <input
                      id="m-edit-clr"
                      type="number"
                      value={editColor}
                      onChange={(e) => setEditColor(Number(e.target.value))}
                      className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" htmlFor="m-edit-lakban">
                      Jilid Lakban (Rp)
                    </label>
                    <input
                      id="m-edit-lakban"
                      type="number"
                      value={editLakban}
                      onChange={(e) => setEditLakban(Number(e.target.value))}
                      className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" htmlFor="m-edit-spiral">
                      Spiral Kawat (Rp)
                    </label>
                    <input
                      id="m-edit-spiral"
                      type="number"
                      value={editSpiralKawat}
                      onChange={(e) => setEditSpiralKawat(Number(e.target.value))}
                      className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" htmlFor="m-edit-pass">
                      Sandi Baru (Opsional, min. 8 karakter)
                    </label>
                    <input
                      id="m-edit-pass"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Kosongkan jika tidak diubah"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Simpan Perubahan Toko
                  </button>
                </div>
              </form>
            )}

            {/* 4 Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Antrean Berjalan</p>
                <p className="text-2xl font-bold font-mono-num mt-1">
                  {mitraProfile.queueCount}
                </p>
              </div>
              <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Pesanan Selesai</p>
                <p className="text-2xl font-bold font-mono-num mt-1">
                  {mitraProfile.totalCompletedOrders}
                </p>
              </div>
              <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Saldo Siap Cair ({100 - commissionSettings.platformCommissionPercent}%)
                </p>
                <p
                  className="text-2xl font-bold font-mono-num mt-1 text-emerald-600 dark:text-emerald-400"
                  data-testid="mitra-pending-balance"
                >
                  {formatRupiah(mitraProfile.pendingBalance)}
                </p>
              </div>
              <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Akumulasi Pendapatan</p>
                <p className="text-2xl font-bold font-mono-num mt-1">
                  {formatRupiah(mitraProfile.totalEarnings)}
                </p>
              </div>
            </div>

            {section === 'antrean' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <RevenueBreakdownChart
                    totalGmv={financeMetrics.gmv}
                    platformCommission={financeMetrics.comm}
                    mitraShare={financeMetrics.net}
                    commissionPercent={commissionSettings.platformCommissionPercent}
                  />
                  <OrderVolumeChart orders={mitraOrders} />
                </div>

                {/* Queue Filter & Cards */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Antrean Pesanan Masuk ({filteredOrders.length})
                    </h2>
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
                      {(
                        [
                          ['all', 'Semua'],
                          ['menunggu_konfirmasi', 'Baru'],
                          ['diproses', 'Sedang Cetak'],
                          ['siap_diambil', 'Siap Ambil'],
                          ['selesai', 'Selesai'],
                        ] as ['all' | OrderStatus, string][]
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setFilterStatus(id)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                            filterStatus === id
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div className="pk-surface-card rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-xs text-slate-500">
                      Belum ada pesanan masuk untuk filter ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredOrders.map((order) => (
                        <div
                          key={order.id}
                          className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono-num text-xs font-bold">
                                {order.orderNumber}
                              </span>
                              <OrderStatusText status={order.status} />
                            </div>
                            <h3 className="text-sm font-bold">{order.documentTitle}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Pemesan: {order.studentName} · {order.pickupDeadline}
                            </p>
                            <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 rounded-xl p-3 space-y-1">
                              <p>
                                {order.pageCount} hal × {order.copies} salinan · {order.paperSize}{' '}
                                {order.paperWeight} · {order.duplex ? 'Duplex' : 'Simplex'} ·{' '}
                                {BINDING_LABELS[order.binding]}
                              </p>
                              {order.notes && <p className="text-slate-500">Catatan: {order.notes}</p>}
                              <p className="font-mono-num font-semibold text-emerald-600 dark:text-emerald-400 pt-1">
                                Hak Mitra: {formatRupiah(order.mitraEarnings)} (Total:{' '}
                                {formatRupiah(order.totalAmount)})
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            {order.status === 'menunggu_konfirmasi' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateMitraOrderStatus(
                                      order.id,
                                      'diproses',
                                      `Pesanan diterima & mulai dicetak oleh ${mitraProfile.name}.`,
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Terima & Mulai Cetak</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateMitraOrderStatus(
                                      order.id,
                                      'dibatalkan',
                                      `Pesanan ditolak oleh ${mitraProfile.name}.`,
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Tolak</span>
                                </button>
                              </>
                            )}

                            {order.status === 'diproses' && (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateMitraOrderStatus(
                                    order.id,
                                    'siap_diambil',
                                    `Dokumen selesai dicetak & siap diambil di ${mitraProfile.name}.`,
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Tandai Siap Diambil</span>
                              </button>
                            )}

                            {order.status === 'siap_diambil' && (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateMitraOrderStatus(
                                    order.id,
                                    'selesai',
                                    `Dokumen diserahkan ke mahasiswa & pesanan selesai.`,
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Serahkan & Selesaikan</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {section === 'katalog' && (
              <KatalogTarif
                services={mitraServices}
                onCreateService={createMitraService}
                onUpdateService={updateMitraService}
                onDeleteService={deleteMitraService}
              />
            )}

            {section === 'pencairan' && (
              <div className="space-y-5">
                <form
                  onSubmit={handleWithdraw}
                  className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col md:flex-row items-end gap-3"
                >
                  <div className="flex-1 w-full">
                    <label
                      htmlFor="payout-bank-input"
                      className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
                    >
                      Rekening Tujuan Pencairan
                    </label>
                    <input
                      id="payout-bank-input"
                      type="text"
                      required
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="Contoh: BCA 1234567890 a.n. Berkah Print"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="w-full md:w-52">
                    <label
                      htmlFor="payout-amount-input"
                      className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
                    >
                      Nominal (Min {formatRupiah(commissionSettings.payoutMinimum)})
                    </label>
                    <input
                      id="payout-amount-input"
                      type="number"
                      min={0}
                      step={5000}
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Ajukan Pencairan</span>
                  </button>
                </form>

                <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-sm font-bold">Riwayat Pengajuan Pencairan</h2>
                  </div>
                  {mitraPayouts.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Belum ada riwayat pengajuan pencairan saldo.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50/70 dark:bg-slate-950/60">
                            <th className="py-3 px-4">Tanggal</th>
                            <th className="py-3 px-4">Rekening Tujuan</th>
                            <th className="py-3 px-4 text-right">Nominal</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {mitraPayouts.map((p) => (
                            <tr key={p.id}>
                              <td className="py-3 px-4 font-mono-num">
                                {new Date(p.createdAt).toLocaleDateString('id-ID')}
                              </td>
                              <td className="py-3 px-4">{p.bankAccount}</td>
                              <td className="py-3 px-4 text-right font-mono-num font-semibold">
                                {formatRupiah(p.amount)}
                              </td>
                              <td className="py-3 px-4 font-semibold uppercase">{p.status}</td>
                              <td className="py-3 px-4 text-right">
                                {p.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => void cancelMitraPayout(p.id)}
                                    aria-label={`Batalkan pencairan ${p.id}`}
                                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
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
          </div>
        )}
      </main>
    </div>
  );
};
