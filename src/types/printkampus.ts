export type UserRole = 'user' | 'mitra' | 'admin';

export type PortalRoute = 'home' | 'user' | 'mitra' | 'admin';

export type OrderStatus =
  | 'menunggu_konfirmasi'
  | 'diproses'
  | 'siap_diambil'
  | 'selesai'
  | 'dibatalkan';

export type ColorType = 'bw' | 'color' | 'mixed';
export type PaperSize = 'A4' | 'F4' | 'A3';
export type PaperWeight = '70gr' | '80gr' | '100gr';
export type BindingType =
  | 'none'
  | 'staples'
  | 'lakban'
  | 'spiral_plastik'
  | 'spiral_kawat'
  | 'hardcover';

export type PaymentMethod =
  | 'QRIS'
  | 'GoPay'
  | 'DANA'
  | 'ShopeePay'
  | 'Transfer VA'
  | 'COD';

export type PaymentStatus = 'lunas' | 'menunggu_bayar' | 'bayar_di_tempat';

export type ServiceCategory = 'kertas' | 'warna' | 'jilid' | 'finishing';

export type IssueCategory =
  | 'salah_cetak'
  | 'keterlambatan'
  | 'kertas_rusak'
  | 'salah_jilid'
  | 'pembayaran'
  | 'lainnya';

export type IssueStatus = 'terbuka' | 'investigasi' | 'selesai' | 'ditolak';

export type PayoutStatus = 'pending' | 'selesai' | 'ditolak';

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note: string;
}

export interface MitraPricing {
  bwPerPage: number;
  colorPerPage: number;
  duplexDiscountPerPage: number;
  bindings: Record<BindingType, number>;
}

export interface Mitra {
  id: string;
  loginEmail: string;
  ownerUid?: string;
  name: string;
  campusArea: string;
  address: string;
  operatingHours: string;
  isOpen: boolean;
  rating: number;
  queueCount: number;
  totalCompletedOrders: number;
  totalEarnings: number;
  pendingBalance: number;
  servicesOffered: string[];
  pricing: MitraPricing;
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  studentName: string;
  studentNim: string;
  studentPhone: string;
  studentEmail?: string;
  mitraId: string;
  mitraOwnerUid?: string;
  mitraName: string;
  mitraLocation: string;
  documentTitle: string;
  fileName: string;
  fileSize: string;
  pageCount: number;
  copies: number;
  colorType: ColorType;
  paperSize: PaperSize;
  paperWeight: PaperWeight;
  duplex: boolean;
  binding: BindingType;
  notes: string;
  unitPrintPrice: number;
  unitBindingPrice: number;
  subtotal: number;
  platformFee: number;
  mitraEarnings: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  pickupDeadline: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PrintServiceItem {
  id: string;
  code: string;
  category: ServiceCategory;
  name: string;
  description: string;
  basePrice: number;
  unit: string;
  isActive: boolean;
  createdByRole?: UserRole;
  ownerUid?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueTicket {
  id: string;
  orderId: string;
  orderNumber: string;
  userId?: string;
  reporterName: string;
  reporterRole: UserRole;
  category: IssueCategory;
  description: string;
  status: IssueStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface MitraPayout {
  id: string;
  mitraId: string;
  mitraLoginEmail?: string;
  mitraName: string;
  amount: number;
  bankAccount: string;
  status: PayoutStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CommissionSettings {
  platformCommissionPercent: number;
  minimumOrderAmount: number;
  firstOrderDiscount: number;
  payoutMinimum: number;
  supportHotline: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  nim: string;
  faculty: string;
  phone: string;
  photoUrl?: string;
  createdAt?: string;
}

export interface AdminAccount {
  id: string;
  username: string;
  email: string;
  fullName: string;
  inviteId?: string;
  createdAt: string;
}

export interface AdminInvite {
  id: string;
  email: string;
  username: string;
  fullName: string;
  invitedByUid: string;
  createdAt: string;
}

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message: string;
}
