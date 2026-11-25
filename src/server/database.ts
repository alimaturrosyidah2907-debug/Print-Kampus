import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AdminAccount,
  CommissionSettings,
  IssueTicket,
  Mitra,
  MitraPayout,
  MitraPricing,
  Order,
  PrintServiceItem,
  UserProfile,
} from '../types/printkampus';
import { hashPassword } from './authCrypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'printkampus.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    nim TEXT NOT NULL DEFAULT '',
    faculty TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mitras (
    id TEXT PRIMARY KEY,
    login_email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    campus_area TEXT NOT NULL,
    address TEXT NOT NULL,
    operating_hours TEXT NOT NULL,
    is_open INTEGER NOT NULL DEFAULT 1,
    rating REAL NOT NULL DEFAULT 5.0,
    queue_count INTEGER NOT NULL DEFAULT 0,
    total_completed_orders INTEGER NOT NULL DEFAULT 0,
    total_earnings INTEGER NOT NULL DEFAULT 0,
    pending_balance INTEGER NOT NULL DEFAULT 0,
    services_offered TEXT NOT NULL DEFAULT '[]',
    pricing_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    base_price INTEGER NOT NULL,
    unit TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by_role TEXT NOT NULL DEFAULT 'admin'
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    user_id TEXT,
    student_name TEXT NOT NULL,
    student_nim TEXT NOT NULL,
    student_phone TEXT NOT NULL,
    student_email TEXT,
    mitra_id TEXT NOT NULL,
    mitra_name TEXT NOT NULL,
    mitra_location TEXT NOT NULL,
    document_title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    copies INTEGER NOT NULL,
    color_type TEXT NOT NULL,
    paper_size TEXT NOT NULL,
    paper_weight TEXT NOT NULL,
    duplex INTEGER NOT NULL,
    binding TEXT NOT NULL,
    notes TEXT NOT NULL,
    unit_print_price INTEGER NOT NULL,
    unit_binding_price INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    platform_fee INTEGER NOT NULL,
    mitra_earnings INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    status TEXT NOT NULL,
    status_history_json TEXT NOT NULL,
    pickup_deadline TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    order_number TEXT NOT NULL,
    user_id TEXT,
    reporter_name TEXT NOT NULL,
    reporter_role TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    admin_note TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY,
    mitra_id TEXT NOT NULL,
    mitra_name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    bank_account TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    platform_commission_percent REAL NOT NULL,
    minimum_order_amount INTEGER NOT NULL,
    first_order_discount INTEGER NOT NULL,
    payout_minimum INTEGER NOT NULL,
    support_hotline TEXT NOT NULL
  );
`);

// Initialize default commission settings row if empty (operational lists remain completely empty!)
const settingsCount = (
  db.prepare('SELECT COUNT(*) AS cnt FROM settings').get() as { cnt: number }
).cnt;
if (settingsCount === 0) {
  db.prepare(
    `INSERT INTO settings (id, platform_commission_percent, minimum_order_amount, first_order_discount, payout_minimum, support_hotline)
     VALUES (1, 10, 2000, 0, 50000, 'support@printkampus.id')`,
  ).run();
}

// Optional env-based initial admin bootstrap (never hardcoded literals)
const envAdminUser = process.env.ADMIN_USERNAME?.trim();
const envAdminPass = process.env.ADMIN_PASSWORD?.trim();
if (envAdminUser && envAdminPass && envAdminPass.length >= 8) {
  const adminCount = (
    db.prepare('SELECT COUNT(*) AS cnt FROM admins').get() as { cnt: number }
  ).cnt;
  if (adminCount === 0) {
    const email = envAdminUser.includes('@')
      ? envAdminUser.toLowerCase()
      : `${envAdminUser.toLowerCase()}@printkampus.id`;
    db.prepare(
      `INSERT INTO admins (id, username, email, full_name, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      `adm-${Date.now()}`,
      envAdminUser.toLowerCase(),
      email,
      'Administrator PRINT KAMPUS',
      hashPassword(envAdminPass),
      new Date().toISOString(),
    );
  }
}

export function mapAdminRow(row: Record<string, unknown>): AdminAccount {
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    fullName: String(row.full_name),
    createdAt: String(row.created_at),
  };
}

export function mapUserRow(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    nim: String(row.nim ?? ''),
    faculty: String(row.faculty ?? ''),
    phone: String(row.phone ?? ''),
    photoUrl: String(row.photo_url ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

export function mapMitraRow(row: Record<string, unknown>): Mitra {
  return {
    id: String(row.id),
    loginEmail: String(row.login_email),
    name: String(row.name),
    campusArea: String(row.campus_area),
    address: String(row.address),
    operatingHours: String(row.operating_hours),
    isOpen: Boolean(row.is_open),
    rating: Number(row.rating),
    queueCount: Number(row.queue_count),
    totalCompletedOrders: Number(row.total_completed_orders),
    totalEarnings: Number(row.total_earnings),
    pendingBalance: Number(row.pending_balance),
    servicesOffered: JSON.parse(String(row.services_offered || '[]')) as string[],
    pricing: JSON.parse(String(row.pricing_json)) as MitraPricing,
    createdAt: String(row.created_at ?? ''),
  };
}

export function mapServiceRow(row: Record<string, unknown>): PrintServiceItem {
  return {
    id: String(row.id),
    code: String(row.code),
    category: row.category as PrintServiceItem['category'],
    name: String(row.name),
    description: String(row.description),
    basePrice: Number(row.base_price),
    unit: String(row.unit),
    isActive: Boolean(row.is_active),
    createdByRole: (row.created_by_role as PrintServiceItem['createdByRole']) ?? 'admin',
  };
}

export function mapOrderRow(row: Record<string, unknown>): Order {
  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    userId: row.user_id ? String(row.user_id) : undefined,
    studentName: String(row.student_name),
    studentNim: String(row.student_nim),
    studentPhone: String(row.student_phone),
    studentEmail: row.student_email ? String(row.student_email) : undefined,
    mitraId: String(row.mitra_id),
    mitraName: String(row.mitra_name),
    mitraLocation: String(row.mitra_location),
    documentTitle: String(row.document_title),
    fileName: String(row.file_name),
    fileSize: String(row.file_size),
    pageCount: Number(row.page_count),
    copies: Number(row.copies),
    colorType: row.color_type as Order['colorType'],
    paperSize: row.paper_size as Order['paperSize'],
    paperWeight: row.paper_weight as Order['paperWeight'],
    duplex: Boolean(row.duplex),
    binding: row.binding as Order['binding'],
    notes: String(row.notes),
    unitPrintPrice: Number(row.unit_print_price),
    unitBindingPrice: Number(row.unit_binding_price),
    subtotal: Number(row.subtotal),
    platformFee: Number(row.platform_fee),
    mitraEarnings: Number(row.mitra_earnings),
    totalAmount: Number(row.total_amount),
    paymentMethod: row.payment_method as Order['paymentMethod'],
    paymentStatus: row.payment_status as Order['paymentStatus'],
    status: row.status as Order['status'],
    statusHistory: JSON.parse(String(row.status_history_json || '[]')),
    pickupDeadline: String(row.pickup_deadline),
    createdAt: String(row.created_at),
  };
}

export function mapTicketRow(row: Record<string, unknown>): IssueTicket {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    orderNumber: String(row.order_number),
    userId: row.user_id ? String(row.user_id) : undefined,
    reporterName: String(row.reporter_name),
    reporterRole: row.reporter_role as IssueTicket['reporterRole'],
    category: row.category as IssueTicket['category'],
    description: String(row.description),
    status: row.status as IssueTicket['status'],
    adminNote: String(row.admin_note),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapPayoutRow(row: Record<string, unknown>): MitraPayout {
  return {
    id: String(row.id),
    mitraId: String(row.mitra_id),
    mitraName: String(row.mitra_name),
    amount: Number(row.amount),
    bankAccount: String(row.bank_account),
    status: row.status as MitraPayout['status'],
    createdAt: String(row.created_at),
  };
}

export function getCommissionSettings(): CommissionSettings {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<
    string,
    unknown
  >;
  return {
    platformCommissionPercent: Number(row.platform_commission_percent),
    minimumOrderAmount: Number(row.minimum_order_amount),
    firstOrderDiscount: Number(row.first_order_discount),
    payoutMinimum: Number(row.payout_minimum),
    supportHotline: String(row.support_hotline),
  };
}
