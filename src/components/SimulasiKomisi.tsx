import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateFinancialSimulation, formatRupiah } from '../utils/pricing';
import { ProfitCurveChart } from './AnalyticsCharts';

export const SimulasiKomisi: React.FC = () => {
  const { commissionSettings } = useApp();

  const [monthlyOrders, setMonthlyOrders] = useState(500);
  const [avgOrderValue, setAvgOrderValue] = useState(20000);
  const [commissionPercent, setCommissionPercent] = useState(
    commissionSettings.platformCommissionPercent,
  );
  const [hostingCost, setHostingCost] = useState(350000);
  const [promoCost, setPromoCost] = useState(250000);
  const [qrisFeePercent, setQrisFeePercent] = useState(0.7);

  useEffect(() => {
    setCommissionPercent(commissionSettings.platformCommissionPercent);
  }, [commissionSettings.platformCommissionPercent]);

  const sim = useMemo(
    () =>
      calculateFinancialSimulation({
        monthlyOrders,
        avgOrderValue,
        commissionPercent,
        hostingCost,
        promoCost,
        qrisFeePercent,
      }),
    [
      monthlyOrders,
      avgOrderValue,
      commissionPercent,
      hostingCost,
      promoCost,
      qrisFeePercent,
    ],
  );

  const exampleFee = Math.round((avgOrderValue * commissionPercent) / 100);
  const exampleMitra = avgOrderValue - exampleFee;
  const maxBarRef = Math.max(sim.grossPlatformCommission, sim.totalOperationalCost, 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Simulasi Pendapatan & Proyeksi Komisi
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Proyeksikan arus GMV bulanan, beban operasional, laba bersih platform, dan kurva titik impas.
        </p>
      </div>

      {/* Formula & Unit Economics Strip */}
      <div className="pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Komisi per Transaksi</p>
          <p className="text-sm font-bold font-mono-num text-slate-900 dark:text-white mt-1">
            {formatRupiah(avgOrderValue)} × {commissionPercent}% = {formatRupiah(exampleFee)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Hak Bersih Mitra / Order</p>
          <p className="text-sm font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1">
            {formatRupiah(exampleMitra)} ({100 - commissionPercent}%)
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Margin Bersih Platform / Order
          </p>
          <p className="text-sm font-bold font-mono-num text-indigo-600 dark:text-indigo-400 mt-1">
            {formatRupiah(sim.netCommissionPerOrder)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Parameters */}
        <div className="lg:col-span-7 pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Parameter Volume & Beban Operasional
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <label htmlFor="sim-orders-slider">Volume Pesanan Bulanan</label>
                <span className="font-mono-num text-indigo-600 dark:text-indigo-400">
                  {monthlyOrders.toLocaleString('id-ID')} pesanan/bln
                </span>
              </div>
              <input
                id="sim-orders-slider"
                type="range"
                min={20}
                max={2000}
                step={20}
                value={monthlyOrders}
                onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <label htmlFor="sim-aov-slider">Rata-Rata Nilai Pesanan</label>
                <span className="font-mono-num text-indigo-600 dark:text-indigo-400">
                  {formatRupiah(avgOrderValue)}
                </span>
              </div>
              <input
                id="sim-aov-slider"
                type="range"
                min={5000}
                max={100000}
                step={1000}
                value={avgOrderValue}
                onChange={(e) => setAvgOrderValue(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <label htmlFor="sim-comm-slider">Komisi Platform (%)</label>
                <span className="font-mono-num text-indigo-600 dark:text-indigo-400">
                  {commissionPercent}%
                </span>
              </div>
              <input
                id="sim-comm-slider"
                type="range"
                min={1}
                max={50}
                step={1}
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold mb-1" htmlFor="sim-hosting">
                Hosting & Server (Rp/bln)
              </label>
              <input
                id="sim-hosting"
                type="number"
                min={0}
                step={50000}
                value={hostingCost}
                onChange={(e) => setHostingCost(Number(e.target.value))}
                className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" htmlFor="sim-promo">
                Anggaran Promosi (Rp/bln)
              </label>
              <input
                id="sim-promo"
                type="number"
                min={0}
                step={50000}
                value={promoCost}
                onChange={(e) => setPromoCost(Number(e.target.value))}
                className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" htmlFor="sim-qris">
                Fee Gateway QRIS (%)
              </label>
              <input
                id="sim-qris"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={qrisFeePercent}
                onChange={(e) => setQrisFeePercent(Number(e.target.value))}
                className="w-full font-mono-num rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <ProfitCurveChart
            avgOrderValue={avgOrderValue}
            commissionPercent={commissionPercent}
            qrisFeePercent={qrisFeePercent}
            fixedOpex={hostingCost + promoCost}
            currentOrders={monthlyOrders}
          />
        </div>

        {/* Right: Net Profit & BEP Projection */}
        <div className="lg:col-span-5 pk-surface-card rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Proyeksi Laba Bersih Bulanan
                </h3>
              </div>
              <span
                className={`text-xs font-bold ${
                  sim.isProfitable
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {sim.isProfitable ? 'PROFITABEL' : 'DEFISIT'}
              </span>
            </div>

            <p
              className={`text-3xl font-extrabold font-mono-num ${
                sim.isProfitable
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
              data-testid="sim-net-profit"
            >
              {formatRupiah(sim.netProfit)}
            </p>

            <div className="space-y-2.5 pt-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Pendapatan Komisi Kotor</span>
                  <span className="font-mono-num font-semibold">
                    {formatRupiah(sim.grossPlatformCommission)}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{
                      width: `${Math.min(100, (sim.grossPlatformCommission / maxBarRef) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Total Beban Operasional & QRIS</span>
                  <span className="font-mono-num font-semibold">
                    {formatRupiah(sim.totalOperationalCost)}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                    style={{
                      width: `${Math.min(100, (sim.totalOperationalCost / maxBarRef) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Total GMV Kampus / Bulan</span>
                <span className="font-mono-num font-semibold">{formatRupiah(sim.grossGmv)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Penyaluran ke Mitra</span>
                <span className="font-mono-num font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(sim.mitraPayoutTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Biaya Gateway QRIS ({qrisFeePercent}%)</span>
                <span className="font-mono-num">{formatRupiah(sim.qrisGatewayCost)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Titik Impas (Break-Even Point)
              </p>
              <p className="text-[11px] text-slate-500">
                Minimal pesanan bulanan untuk menutup beban tetap
              </p>
            </div>
            <p className="text-lg font-extrabold font-mono-num text-slate-900 dark:text-white">
              {Number.isFinite(sim.breakEvenOrders)
                ? `${sim.breakEvenOrders.toLocaleString('id-ID')} order`
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
