import React, { useState } from 'react';
import { ArrowRight, Building2, GraduationCap, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PrintStudioCanvas } from '../three/PrintStudioCanvas';
import type { PrintFinishMode } from '../three/models';

export const PortalLanding: React.FC = () => {
  const { navigatePortal, isDark, toggleDark, publicMitras, publicServices } = useApp();
  const [finishMode, setFinishMode] = useState<PrintFinishMode>('spiral');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
          <button
            type="button"
            onClick={() => navigatePortal('home')}
            className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            PRINT KAMPUS
          </button>

          <nav aria-label="Portal Aktor" className="hidden md:flex items-center gap-6">
            <button
              type="button"
              onClick={() => navigatePortal('user')}
              className="py-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Portal User
            </button>
            <button
              type="button"
              onClick={() => navigatePortal('mitra')}
              className="py-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Portal Mitra
            </button>
            <button
              type="button"
              onClick={() => navigatePortal('admin')}
              className="py-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Portal Admin
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleDark}
              aria-label={isDark ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isDark ? 'Terang' : 'Gelap'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigatePortal('user')}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Masuk User</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-10">
        {/* Hero Section — Clean "PRINT KAMPUS" Title */}
        <section className="pk-hero-shell rounded-3xl text-white border border-indigo-500/20 p-5 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2.5">
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
                PRINT KAMPUS
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Platform layanan cetak dokumen kampus terpadu dengan studio pratinjau 3D interaktif dan portal terpisah untuk User, Mitra Percetakan, dan Admin Platform.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono-num">
              <span className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2">
                {publicMitras.length} Mitra Terdaftar
              </span>
              <span className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2">
                {publicServices.length} Layanan Aktif
              </span>
            </div>
          </div>

          <PrintStudioCanvas
            finishMode={finishMode}
            onFinishModeChange={setFinishMode}
            isDark={isDark}
            onQuickOrder={() => navigatePortal('user')}
          />
        </section>

        {/* 3 Separate Actor Portals */}
        <section aria-labelledby="actor-portals-heading" className="space-y-4">
          <div>
            <h2
              id="actor-portals-heading"
              className="text-xl font-bold text-slate-900 dark:text-white"
            >
              Pilih Portal Akses
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Setiap peran memiliki web portal, alur otentikasi, dan otorisasi database yang terpisah.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* User Portal Card */}
            <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Portal User (Mahasiswa)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Masuk cepat menggunakan akun Google. Unggah dokumen, atur spesifikasi cetak, lacak progres pesanan, dan laporkan kendala.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigatePortal('user')}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Buka Web User (/user)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Mitra Portal Card */}
            <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Portal Mitra Percetakan
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Masuk menggunakan akun Google Mitra yang telah didaftarkan Admin. Kelola antrean cetak, tarif toko, layanan, dan pencairan saldo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigatePortal('mitra')}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Buka Web Mitra (/mitra)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Admin Portal Card */}
            <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Portal Admin Platform
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Masuk dengan akun Google Admin terotorisasi di Firestore. Atur persentase komisi potongan mitra, daftarkan akun mitra, kelola katalog, order, dan tiket.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigatePortal('admin')}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Buka Web Admin (/admin)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <p className="font-semibold text-slate-700 dark:text-slate-300">PRINT KAMPUS</p>
          <p>Portal Terpisah: User · Mitra Percetakan · Admin Platform</p>
        </div>
      </footer>
    </div>
  );
};
