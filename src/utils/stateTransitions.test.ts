import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCreateOrder,
  applyDeleteOrder,
  applyUpdateOrderStatus,
  applyWithdrawMitraBalance,
} from './stateTransitions';
import type { Mitra, Order } from '../types/printkampus';

const baseMitra: Mitra = {
  id: 'mitra-1',
  loginEmail: 'berkah@mitra.id',
  name: 'Berkah Digital Copy & Print',
  campusArea: 'Gerbang Utama',
  address: 'Jl. Kampus No. 1',
  operatingHours: '07.00 - 21.00',
  isOpen: true,
  rating: 4.9,
  queueCount: 2,
  totalCompletedOrders: 10,
  totalEarnings: 500000,
  pendingBalance: 120000,
  servicesOffered: ['B/W', 'Color'],
  pricing: {
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
  },
};

const baseOrder: Order = {
  id: 'ord-1',
  orderNumber: 'PK-202611-001',
  studentName: 'Budi',
  studentNim: '123456',
  studentPhone: '081234',
  mitraId: 'mitra-1',
  mitraName: 'Berkah Digital Copy & Print',
  mitraLocation: 'Gerbang Utama',
  documentTitle: 'Bab 1 Skripsi',
  fileName: 'bab1.pdf',
  fileSize: '1.2 MB',
  pageCount: 20,
  copies: 1,
  colorType: 'bw',
  paperSize: 'A4',
  paperWeight: '70gr',
  duplex: false,
  binding: 'lakban',
  notes: '',
  unitPrintPrice: 250,
  unitBindingPrice: 3500,
  subtotal: 8500,
  platformFee: 850,
  mitraEarnings: 7650,
  totalAmount: 8500,
  paymentMethod: 'QRIS',
  paymentStatus: 'lunas',
  status: 'menunggu_konfirmasi',
  statusHistory: [
    { status: 'menunggu_konfirmasi', timestamp: '2026-11-25T08:00:00Z', note: 'Dibuat' },
  ],
  pickupDeadline: 'Hari ini, 14:00',
  createdAt: '2026-11-25T08:00:00Z',
};

test('applyCreateOrder adds order and increments mitra queueCount', () => {
  const res = applyCreateOrder([], [baseMitra], baseOrder);
  assert.equal(res.orders.length, 1);
  assert.equal(res.mitras[0].queueCount, 3);
});

test('applyUpdateOrderStatus to selesai decrements queue and credits mitra balance', () => {
  const step1 = applyUpdateOrderStatus([baseOrder], [baseMitra], 'ord-1', 'diproses', 'Mulai cetak');
  assert.equal(step1.mitras[0].queueCount, 2);
  assert.equal(step1.mitras[0].pendingBalance, 120000);

  const step2 = applyUpdateOrderStatus(
    step1.orders,
    step1.mitras,
    'ord-1',
    'selesai',
    'Sudah diambil',
  );
  assert.equal(step2.orders[0].status, 'selesai');
  assert.equal(step2.mitras[0].queueCount, 1);
  assert.equal(step2.mitras[0].totalCompletedOrders, 11);
  assert.equal(step2.mitras[0].totalEarnings, 507650);
  assert.equal(step2.mitras[0].pendingBalance, 127650);
});

test('applyDeleteOrder before completion decrements active queueCount', () => {
  const res = applyDeleteOrder([baseOrder], [baseMitra], 'ord-1');
  assert.equal(res.orders.length, 0);
  assert.equal(res.mitras[0].queueCount, 1);
});

test('applyWithdrawMitraBalance validates minimum payout and deducts pendingBalance', () => {
  const tooLow = applyWithdrawMitraBalance([baseMitra], 'mitra-1', 30000, 50000);
  assert.equal(tooLow.ok, false);

  const tooHigh = applyWithdrawMitraBalance([baseMitra], 'mitra-1', 200000, 50000);
  assert.equal(tooHigh.ok, false);

  const valid = applyWithdrawMitraBalance([baseMitra], 'mitra-1', 100000, 50000);
  assert.equal(valid.ok, true);
  assert.equal(valid.mitras[0].pendingBalance, 20000);
});
