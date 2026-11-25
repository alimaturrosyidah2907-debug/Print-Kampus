import type { Mitra, Order, OrderStatus } from '../types/printkampus';

export interface StateSyncResult {
  orders: Order[];
  mitras: Mitra[];
}

export function applyCreateOrder(
  orders: Order[],
  mitras: Mitra[],
  newOrder: Order,
): StateSyncResult {
  const updatedMitras = mitras.map((m) =>
    m.id === newOrder.mitraId ? { ...m, queueCount: m.queueCount + 1 } : m,
  );
  return {
    orders: [newOrder, ...orders],
    mitras: updatedMitras,
  };
}

export function applyUpdateOrderStatus(
  orders: Order[],
  mitras: Mitra[],
  orderId: string,
  nextStatus: OrderStatus,
  note: string,
  timestamp: string = new Date().toISOString(),
): StateSyncResult {
  const target = orders.find((o) => o.id === orderId);
  if (!target || target.status === nextStatus) {
    return { orders, mitras };
  }

  const wasActiveQueue =
    target.status !== 'selesai' && target.status !== 'dibatalkan';
  const willLeaveActiveQueue =
    nextStatus === 'selesai' || nextStatus === 'dibatalkan';

  const updatedOrders = orders.map((o) =>
    o.id === orderId
      ? {
          ...o,
          status: nextStatus,
          paymentStatus:
            nextStatus === 'selesai' && o.paymentStatus === 'bayar_di_tempat'
              ? ('lunas' as const)
              : o.paymentStatus,
          statusHistory: [
            ...o.statusHistory,
            { status: nextStatus, timestamp, note },
          ],
        }
      : o,
  );

  const updatedMitras = mitras.map((m) => {
    if (m.id !== target.mitraId) return m;
    let queueCount = m.queueCount;
    let totalCompletedOrders = m.totalCompletedOrders;
    let totalEarnings = m.totalEarnings;
    let pendingBalance = m.pendingBalance;

    if (wasActiveQueue && willLeaveActiveQueue) {
      queueCount = Math.max(0, queueCount - 1);
    }

    if (nextStatus === 'selesai' && target.status !== 'selesai') {
      totalCompletedOrders += 1;
      totalEarnings += target.mitraEarnings;
      pendingBalance += target.mitraEarnings;
    }

    return {
      ...m,
      queueCount,
      totalCompletedOrders,
      totalEarnings,
      pendingBalance,
    };
  });

  return { orders: updatedOrders, mitras: updatedMitras };
}

export function applyDeleteOrder(
  orders: Order[],
  mitras: Mitra[],
  orderId: string,
): StateSyncResult {
  const target = orders.find((o) => o.id === orderId);
  if (!target) return { orders, mitras };

  const wasActiveQueue =
    target.status !== 'selesai' && target.status !== 'dibatalkan';

  const updatedOrders = orders.filter((o) => o.id !== orderId);
  const updatedMitras = wasActiveQueue
    ? mitras.map((m) =>
        m.id === target.mitraId
          ? { ...m, queueCount: Math.max(0, m.queueCount - 1) }
          : m,
      )
    : mitras;

  return { orders: updatedOrders, mitras: updatedMitras };
}

export interface WithdrawResult {
  ok: boolean;
  error?: string;
  mitras: Mitra[];
  withdrawnAmount: number;
}

export function applyWithdrawMitraBalance(
  mitras: Mitra[],
  mitraId: string,
  amount: number,
  payoutMinimum: number,
): WithdrawResult {
  const target = mitras.find((m) => m.id === mitraId);
  if (!target) {
    return { ok: false, error: 'Mitra tidak ditemukan.', mitras, withdrawnAmount: 0 };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      error: 'Nominal pencairan harus lebih besar dari Rp 0.',
      mitras,
      withdrawnAmount: 0,
    };
  }
  if (amount < payoutMinimum) {
    return {
      ok: false,
      error: `Batas minimum pencairan adalah Rp ${payoutMinimum.toLocaleString('id-ID')}.`,
      mitras,
      withdrawnAmount: 0,
    };
  }
  if (amount > target.pendingBalance) {
    return {
      ok: false,
      error: 'Saldo siap cair tidak mencukupi.',
      mitras,
      withdrawnAmount: 0,
    };
  }

  const updatedMitras = mitras.map((m) =>
    m.id === mitraId ? { ...m, pendingBalance: m.pendingBalance - amount } : m,
  );

  return {
    ok: true,
    mitras: updatedMitras,
    withdrawnAmount: amount,
  };
}
