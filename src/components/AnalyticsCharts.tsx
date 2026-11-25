import React from 'react';
import type { Order, OrderStatus } from '../types/printkampus';
import { formatRupiah } from '../utils/pricing';

interface RevenueBreakdownProps {
  totalGmv: number;
  platformCommission: number;
  mitraShare: number;
  commissionPercent: number;
}

export const RevenueBreakdownChart: React.FC<RevenueBreakdownProps> = ({
  totalGmv,
  platformCommission,
  mitraShare,
  commissionPercent,
}) => {
  const safeTotal = Math.max(totalGmv, 1);
  const commRatio = Math.min(100, Math.round((platformCommission / safeTotal) * 100));
  const mitraRatio = totalGmv > 0 ? Math.max(0, 100 - commRatio) : 0;

  // SVG Donut ring math
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const mitraDash = totalGmv > 0 ? (mitraRatio / 100) * circumference : 0;
  const commDash = totalGmv > 0 ? (commRatio / 100) * circumference : 0;

  return (
    <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Distribusi Pendapatan & Komisi ({commissionPercent}%)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Proporsi GMV terhadap hak bersih Mitra dan komisi platform
          </p>
        </div>
        <span className="font-mono-num text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          {formatRupiah(totalGmv)}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg
            viewBox="0 0 130 130"
            className="w-full h-full -rotate-90"
            aria-label="Grafik proporsi komisi platform dan hak mitra"
          >
            <defs>
              <linearGradient id="pkEmeraldGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="pkIndigoGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
            <circle
              cx="65"
              cy="65"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              className="text-slate-100 dark:text-slate-800"
            />
            {totalGmv > 0 && (
              <>
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  fill="none"
                  stroke="url(#pkEmeraldGrad)"
                  strokeWidth="14"
                  strokeDasharray={`${mitraDash} ${circumference}`}
                  strokeLinecap="round"
                />
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  fill="none"
                  stroke="url(#pkIndigoGrad)"
                  strokeWidth="14"
                  strokeDasharray={`${commDash} ${circumference}`}
                  strokeDashoffset={-mitraDash}
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Komisi</span>
            <span className="text-lg font-extrabold font-mono-num text-slate-900 dark:text-white">
              {commissionPercent}%
            </span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Hak Bersih Mitra
              </span>
              <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                {formatRupiah(mitraShare)} ({mitraRatio}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                style={{ width: `${mitraRatio}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                Potongan Komisi Platform
              </span>
              <span className="font-mono-num font-bold text-indigo-600 dark:text-indigo-400">
                {formatRupiah(platformCommission)} ({totalGmv > 0 ? commRatio : 0}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                style={{ width: `${totalGmv > 0 ? commRatio : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface OrderStatusChartProps {
  orders: Order[];
}

const STATUS_BUCKETS: { status: OrderStatus; label: string; colorClass: string; stroke: string }[] = [
  { status: 'menunggu_konfirmasi', label: 'Menunggu', colorClass: 'bg-amber-500', stroke: '#f59e0b' },
  { status: 'diproses', label: 'Dicetak', colorClass: 'bg-indigo-500', stroke: '#6366f1' },
  { status: 'siap_diambil', label: 'Siap Ambil', colorClass: 'bg-sky-500', stroke: '#0ea5e9' },
  { status: 'selesai', label: 'Selesai', colorClass: 'bg-emerald-500', stroke: '#10b981' },
  { status: 'dibatalkan', label: 'Dibatalkan', colorClass: 'bg-rose-500', stroke: '#f43f5e' },
];

export const OrderVolumeChart: React.FC<OrderStatusChartProps> = ({ orders }) => {
  const counts = STATUS_BUCKETS.map((b) => ({
    ...b,
    count: orders.filter((o) => o.status === b.status).length,
    gmv: orders
      .filter((o) => o.status === b.status)
      .reduce((acc, o) => acc + o.totalAmount, 0),
  }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  return (
    <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Statistik Tahapan Pesanan
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sebaran antrean aktif, selesai, dan batal real-time
          </p>
        </div>
        <span className="font-mono-num text-xs font-semibold text-slate-600 dark:text-slate-300">
          {orders.length} order
        </span>
      </div>

      {/* Modern Column Bar SVG Chart */}
      <div className="pt-2">
        <div className="grid grid-cols-5 gap-3 items-end h-36 px-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {counts.map((item) => {
            const heightPct = item.count > 0 ? Math.max(14, (item.count / maxCount) * 100) : 6;
            return (
              <div
                key={item.status}
                className="flex flex-col items-center justify-end h-full gap-1.5 group"
                title={`${item.label}: ${item.count} pesanan (${formatRupiah(item.gmv)})`}
              >
                <span className="font-mono-num text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {item.count}
                </span>
                <div className="w-full max-w-[38px] flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${
                      item.count > 0
                        ? item.colorClass
                        : 'bg-slate-200 dark:bg-slate-800 opacity-50'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-5 gap-3 px-2 pt-2 text-center">
          {counts.map((item) => (
            <span
              key={item.status}
              className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate"
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ProfitCurveProps {
  avgOrderValue: number;
  commissionPercent: number;
  qrisFeePercent: number;
  fixedOpex: number;
  currentOrders: number;
}

export const ProfitCurveChart: React.FC<ProfitCurveProps> = ({
  avgOrderValue,
  commissionPercent,
  qrisFeePercent,
  fixedOpex,
  currentOrders,
}) => {
  const maxOrders = 2000;
  const steps = [0, 400, 800, 1200, 1600, 2000];
  const points = steps.map((vol) => {
    const grossComm = (vol * avgOrderValue * commissionPercent) / 100;
    const qris = (vol * avgOrderValue * qrisFeePercent) / 100;
    return { vol, net: grossComm - fixedOpex - qris };
  });

  const minVal = Math.min(0, ...points.map((p) => p.net));
  const maxVal = Math.max(100000, ...points.map((p) => p.net));
  const range = Math.max(1, maxVal - minVal);

  const W = 400;
  const H = 140;
  const padX = 16;
  const padY = 14;

  const toX = (vol: number) => padX + (vol / maxOrders) * (W - padX * 2);
  const toY = (val: number) => H - padY - ((val - minVal) / range) * (H - padY * 2);

  const zeroY = toY(0);
  const pathD = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(p.vol).toFixed(1)} ${toY(p.net).toFixed(1)}`)
    .join(' ');
  const areaD = `${pathD} L ${toX(maxOrders).toFixed(1)} ${zeroY.toFixed(1)} L ${toX(0).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const currGross = (currentOrders * avgOrderValue * commissionPercent) / 100;
  const currQris = (currentOrders * avgOrderValue * qrisFeePercent) / 100;
  const currNet = currGross - fixedOpex - currQris;
  const cx = toX(Math.min(maxOrders, currentOrders));
  const cy = toY(currNet);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>Kurva Laba Bersih (0 – 2.000 order/bln)</span>
        <span className="font-mono-num">Garis Nol = Impas</span>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32 overflow-visible">
          <defs>
            <linearGradient id="pkCurveArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line
            x1={padX}
            y1={zeroY}
            x2={W - padX}
            y2={zeroY}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <path d={areaD} fill="url(#pkCurveArea)" />
          <path
            d={pathD}
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={cx}
            cy={cy}
            r="5"
            fill={currNet >= 0 ? '#10b981' : '#f43f5e'}
            stroke="#ffffff"
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
};
