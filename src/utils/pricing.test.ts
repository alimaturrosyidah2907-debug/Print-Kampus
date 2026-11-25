import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrderPricing,
  calculateFinancialSimulation,
  generateOrderNumber,
} from './pricing';
import type { MitraPricing, Order } from '../types/printkampus';

const samplePricing: MitraPricing = {
  bwPerPage: 250,
  colorPerPage: 1000,
  duplexDiscountPerPage: 50,
  bindings: {
    none: 0,
    staples: 1000,
    lakban: 3500,
    spiral_plastik: 7000,
    spiral_kawat: 12000,
    hardcover: 35000,
  },
};

test('calculateOrderPricing computes B/W A4 70gr simplex without binding and 10% commission', () => {
  const res = calculateOrderPricing({
    pageCount: 20,
    copies: 2,
    colorType: 'bw',
    paperSize: 'A4',
    paperWeight: '70gr',
    duplex: false,
    binding: 'none',
    pricing: samplePricing,
    platformCommissionPercent: 10,
  });

  assert.equal(res.unitPrintPrice, 250);
  assert.equal(res.unitBindingPrice, 0);
  assert.equal(res.subtotal, 10000);
  assert.equal(res.platformFee, 1000);
  assert.equal(res.mitraEarnings, 9000);
  assert.equal(res.totalAmount, 10000);
});

test('calculateOrderPricing applies A3 x2, 100gr +250, duplex discount, and spiral kawat binding', () => {
  const res = calculateOrderPricing({
    pageCount: 10,
    copies: 1,
    colorType: 'color',
    paperSize: 'A3',
    paperWeight: '100gr',
    duplex: true,
    binding: 'spiral_kawat',
    pricing: samplePricing,
    platformCommissionPercent: 10,
  });

  // 1000 * 2 (A3) + 250 (100gr) - 50 (duplex) = 2200
  assert.equal(res.unitPrintPrice, 2200);
  assert.equal(res.unitBindingPrice, 12000);
  assert.equal(res.subtotal, 10 * 2200 + 12000);
  assert.equal(res.platformFee, 3400);
  assert.equal(res.mitraEarnings, 30600);
});

test('calculateOrderPricing enforces Rp 100 minimum page floor on duplex discount', () => {
  const cheapPricing: MitraPricing = {
    ...samplePricing,
    bwPerPage: 120,
    duplexDiscountPerPage: 80,
  };
  const res = calculateOrderPricing({
    pageCount: 5,
    copies: 1,
    colorType: 'bw',
    paperSize: 'A4',
    paperWeight: '70gr',
    duplex: true,
    binding: 'none',
    pricing: cheapPricing,
    platformCommissionPercent: 10,
  });

  assert.equal(res.unitPrintPrice, 100);
  assert.equal(res.subtotal, 500);
});

test('calculateFinancialSimulation computes net profit, BEP, and profitability', () => {
  const sim = calculateFinancialSimulation({
    monthlyOrders: 500,
    avgOrderValue: 20000,
    commissionPercent: 10,
    hostingCost: 300000,
    promoCost: 200000,
    qrisFeePercent: 0.7,
  });

  assert.equal(sim.grossGmv, 10000000);
  assert.equal(sim.grossPlatformCommission, 1000000);
  assert.equal(sim.mitraPayoutTotal, 9000000);
  assert.equal(sim.qrisGatewayCost, 70000);
  assert.equal(sim.totalOperationalCost, 570000);
  assert.equal(sim.netProfit, 430000);
  assert.equal(sim.isProfitable, true);
  assert.ok(sim.breakEvenOrders > 0 && Number.isFinite(sim.breakEvenOrders));
});

test('generateOrderNumber increments sequential order suffix for current month', () => {
  const now = new Date('2026-11-25T10:00:00Z');
  const existing = [
    { orderNumber: 'PK-202611-001' },
    { orderNumber: 'PK-202611-007' },
    { orderNumber: 'PK-202610-099' },
  ] as Order[];

  assert.equal(generateOrderNumber(existing, now), 'PK-202611-008');
  assert.equal(generateOrderNumber([], now), 'PK-202611-001');
});
