import type {
  BindingType,
  ColorType,
  MitraPricing,
  Order,
  OrderStatus,
  PaperSize,
  PaperWeight,
} from '../types/printkampus';

export interface OrderPricingInput {
  pageCount: number;
  copies: number;
  colorType: ColorType;
  paperSize: PaperSize;
  paperWeight: PaperWeight;
  duplex: boolean;
  binding: BindingType;
  pricing: MitraPricing;
  platformCommissionPercent: number;
}

export interface OrderPricingResult {
  unitPrintPrice: number;
  unitBindingPrice: number;
  subtotal: number;
  platformFee: number;
  mitraEarnings: number;
  totalAmount: number;
}

export function calculateOrderPricing(input: OrderPricingInput): OrderPricingResult {
  const safePages = Math.max(1, Math.floor(input.pageCount));
  const safeCopies = Math.max(1, Math.floor(input.copies));

  let basePagePrice = input.pricing.bwPerPage;
  if (input.colorType === 'color') {
    basePagePrice = input.pricing.colorPerPage;
  } else if (input.colorType === 'mixed') {
    basePagePrice = Math.round((input.pricing.bwPerPage + input.pricing.colorPerPage) / 2);
  }

  let adjustedPrice = basePagePrice;
  if (input.paperSize === 'F4') {
    adjustedPrice += 50;
  } else if (input.paperSize === 'A3') {
    adjustedPrice *= 2;
  }

  if (input.paperWeight === '80gr') {
    adjustedPrice += 100;
  } else if (input.paperWeight === '100gr') {
    adjustedPrice += 250;
  }

  if (input.duplex) {
    adjustedPrice = Math.max(100, adjustedPrice - input.pricing.duplexDiscountPerPage);
  }

  const unitBindingPrice = input.pricing.bindings[input.binding] ?? 0;
  const printSubtotal = safePages * adjustedPrice * safeCopies;
  const bindingSubtotal = unitBindingPrice * safeCopies;
  const subtotal = printSubtotal + bindingSubtotal;

  const commissionRate = Math.min(50, Math.max(0, input.platformCommissionPercent));
  const platformFee = Math.round((subtotal * commissionRate) / 100);
  const mitraEarnings = subtotal - platformFee;

  return {
    unitPrintPrice: adjustedPrice,
    unitBindingPrice,
    subtotal,
    platformFee,
    mitraEarnings,
    totalAmount: subtotal,
  };
}

export interface FinancialSimInput {
  monthlyOrders: number;
  avgOrderValue: number;
  commissionPercent: number;
  hostingCost: number;
  promoCost: number;
  qrisFeePercent: number;
}

export interface FinancialSimResult {
  grossGmv: number;
  grossPlatformCommission: number;
  mitraPayoutTotal: number;
  qrisGatewayCost: number;
  totalOperationalCost: number;
  netProfit: number;
  isProfitable: boolean;
  breakEvenOrders: number;
  netCommissionPerOrder: number;
}

export function calculateFinancialSimulation(
  input: FinancialSimInput,
): FinancialSimResult {
  const orders = Math.max(0, input.monthlyOrders);
  const avgVal = Math.max(0, input.avgOrderValue);
  const commPct = Math.max(0, input.commissionPercent);
  const qrisPct = Math.max(0, input.qrisFeePercent);
  const fixedOpex = Math.max(0, input.hostingCost) + Math.max(0, input.promoCost);

  const grossGmv = Math.round(orders * avgVal);
  const grossPlatformCommission = Math.round((grossGmv * commPct) / 100);
  const mitraPayoutTotal = grossGmv - grossPlatformCommission;
  const qrisGatewayCost = Math.round((grossGmv * qrisPct) / 100);
  const totalOperationalCost = fixedOpex + qrisGatewayCost;
  const netProfit = grossPlatformCommission - totalOperationalCost;

  const netCommissionPerOrder = Math.round(avgVal * ((commPct - qrisPct) / 100));
  const breakEvenOrders =
    netCommissionPerOrder > 0 ? Math.ceil(fixedOpex / netCommissionPerOrder) : Infinity;

  return {
    grossGmv,
    grossPlatformCommission,
    mitraPayoutTotal,
    qrisGatewayCost,
    totalOperationalCost,
    netProfit,
    isProfitable: netProfit >= 0,
    breakEvenOrders,
    netCommissionPerOrder,
  };
}

export function generateOrderNumber(existingOrders: Order[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `PK-${year}${month}-`;

  let maxSeq = 0;
  for (const order of existingOrders) {
    if (order.orderNumber.startsWith(prefix)) {
      const seq = Number.parseInt(order.orderNumber.slice(prefix.length), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function formatRupiah(amount: number): string {
  const isNeg = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const formatted = new Intl.NumberFormat('id-ID').format(abs);
  return `${isNeg ? '-' : ''}Rp ${formatted}`;
}

export function estimatePagesFromFileSize(bytes: number): number {
  if (bytes <= 0) return 1;
  const mb = bytes / (1024 * 1024);
  return Math.max(1, Math.min(350, Math.round(mb * 18 + 3)));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export const BINDING_LABELS: Record<BindingType, string> = {
  none: 'Tanpa Jilid',
  staples: 'Staples Pojok',
  lakban: 'Jilid Lakban',
  spiral_plastik: 'Spiral Plastik',
  spiral_kawat: 'Spiral Kawat',
  hardcover: 'Hardcover Skripsi',
};

export const COLOR_LABELS: Record<ColorType, string> = {
  bw: 'Hitam Putih (B/W)',
  color: 'Berwarna (CLR)',
  mixed: 'Campuran (B/W + CLR)',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  menunggu_konfirmasi: 'Menunggu Konfirmasi',
  diproses: 'Sedang Dicetak',
  siap_diambil: 'Siap Diambil',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};
