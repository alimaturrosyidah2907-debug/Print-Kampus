import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createServer as createViteServer } from 'vite';
import {
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
  type SessionTokenPayload,
} from './src/server/authCrypto';
import {
  db,
  getCommissionSettings,
  mapAdminRow,
  mapMitraRow,
  mapOrderRow,
  mapPayoutRow,
  mapServiceRow,
  mapTicketRow,
  mapUserRow,
} from './src/server/database';
import type {
  BindingType,
  ColorType,
  MitraPricing,
  OrderStatus,
  PaperSize,
  PaperWeight,
  PaymentMethod,
  UserRole,
} from './src/types/printkampus';
import { calculateOrderPricing, generateOrderNumber } from './src/utils/pricing';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = fs.existsSync(firebaseConfigPath)
  ? (JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8')) as { projectId?: string })
  : {};

const firebaseAdminApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig.projectId ? { projectId: firebaseConfig.projectId } : undefined);

interface AuthedRequest extends Request {
  session?: SessionTokenPayload;
}

function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Sesi otentikasi tidak ditemukan. Silakan masuk terlebih dahulu.' });
    return;
  }
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi kedaluwarsa atau tidak valid. Silakan masuk ulang.' });
    return;
  }
  req.session = payload;
  next();
}

function requireRole(role: UserRole) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    authMiddleware(req, res, () => {
      if (!req.session || req.session.role !== role) {
        res.status(403).json({ error: 'Akses ditolak untuk peran akun Anda.' });
        return;
      }
      next();
    });
  };
}

function defaultPricing(bw = 250, color = 1000): MitraPricing {
  return {
    bwPerPage: bw,
    colorPerPage: color,
    duplexDiscountPerPage: 40,
    bindings: {
      none: 0,
      staples: 1000,
      lakban: 3500,
      spiral_plastik: 7000,
      spiral_kawat: 12000,
      hardcover: 35000,
    },
  };
}

function applyOrderStatusTransitionTx(
  orderId: string,
  nextStatus: OrderStatus,
  note: string,
) {
  const tx = db.transaction(() => {
    const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
      | Record<string, unknown>
      | undefined;
    if (!orderRow) return { error: 'Pesanan tidak ditemukan.', status: 404 as const };

    const order = mapOrderRow(orderRow);
    if (order.status === nextStatus) {
      return { order, status: 200 as const };
    }

    const wasActive = order.status !== 'selesai' && order.status !== 'dibatalkan';
    const willLeave = nextStatus === 'selesai' || nextStatus === 'dibatalkan';
    const nextPaymentStatus =
      nextStatus === 'selesai' && order.paymentStatus === 'bayar_di_tempat'
        ? 'lunas'
        : order.paymentStatus;

    const history = [
      ...order.statusHistory,
      { status: nextStatus, timestamp: new Date().toISOString(), note },
    ];

    db.prepare(
      `UPDATE orders SET status = ?, payment_status = ?, status_history_json = ? WHERE id = ?`,
    ).run(nextStatus, nextPaymentStatus, JSON.stringify(history), orderId);

    const mitraRow = db
      .prepare('SELECT * FROM mitras WHERE id = ?')
      .get(order.mitraId) as Record<string, unknown> | undefined;

    if (mitraRow) {
      let queueCount = Number(mitraRow.queue_count);
      let completed = Number(mitraRow.total_completed_orders);
      let totalEarnings = Number(mitraRow.total_earnings);
      let pendingBalance = Number(mitraRow.pending_balance);

      if (wasActive && willLeave) {
        queueCount = Math.max(0, queueCount - 1);
      }
      if (nextStatus === 'selesai' && order.status !== 'selesai') {
        completed += 1;
        totalEarnings += order.mitraEarnings;
        pendingBalance += order.mitraEarnings;
      }

      db.prepare(
        `UPDATE mitras
         SET queue_count = ?, total_completed_orders = ?, total_earnings = ?, pending_balance = ?
         WHERE id = ?`,
      ).run(queueCount, completed, totalEarnings, pendingBalance, order.mitraId);
    }

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<
      string,
      unknown
    >;
    return { order: mapOrderRow(updated), status: 200 as const };
  });

  return tx();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // =========================================================================
  // 1. PUBLIC READ-ONLY DIRECTORY & SETTINGS
  // =========================================================================
  app.get('/api/public/bootstrap', (_req, res) => {
    const mitras = (
      db.prepare('SELECT * FROM mitras ORDER BY created_at DESC').all() as Record<
        string,
        unknown
      >[]
    ).map(mapMitraRow);

    const services = (
      db
        .prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY code ASC')
        .all() as Record<string, unknown>[]
    ).map(mapServiceRow);

    const settings = getCommissionSettings();
    res.json({ mitras, services, settings });
  });

  // =========================================================================
  // 2. AUTHENTICATION ENDPOINTS (3 ACTORS)
  // =========================================================================
  app.get('/api/auth/me', authMiddleware, (req: AuthedRequest, res) => {
    const sess = req.session!;
    if (sess.role === 'admin') {
      const row = db.prepare('SELECT * FROM admins WHERE id = ?').get(sess.sub) as
        | Record<string, unknown>
        | undefined;
      if (!row) {
        res.status(401).json({ error: 'Akun admin tidak ditemukan.' });
        return;
      }
      res.json({ role: 'admin', admin: mapAdminRow(row) });
      return;
    }
    if (sess.role === 'mitra') {
      const row = db.prepare('SELECT * FROM mitras WHERE id = ?').get(sess.sub) as
        | Record<string, unknown>
        | undefined;
      if (!row) {
        res.status(401).json({ error: 'Akun mitra tidak ditemukan.' });
        return;
      }
      res.json({ role: 'mitra', mitra: mapMitraRow(row) });
      return;
    }
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(sess.sub) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      res.status(401).json({ error: 'Akun user tidak ditemukan.' });
      return;
    }
    res.json({ role: 'user', user: mapUserRow(row) });
  });

  app.get('/api/auth/admin/status', (_req, res) => {
    const cnt = (
      db.prepare('SELECT COUNT(*) AS cnt FROM admins').get() as { cnt: number }
    ).cnt;
    res.json({ hasAdmin: cnt > 0 });
  });

  app.post('/api/auth/admin/setup', (req, res) => {
    const existingCount = (
      db.prepare('SELECT COUNT(*) AS cnt FROM admins').get() as { cnt: number }
    ).cnt;
    if (existingCount > 0) {
      res.status(403).json({
        error: 'Akun Admin sudah dibuat di database. Silakan login menggunakan akun yang terdaftar.',
      });
      return;
    }

    const username = String(req.body?.username ?? '').trim().toLowerCase();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const fullName = String(req.body?.fullName ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!username || username.length < 3 || !email.includes('@') || password.length < 8) {
      res.status(400).json({
        error: 'Username min. 3 karakter, email valid, dan kata sandi min. 8 karakter.',
      });
      return;
    }

    const id = `adm-${Date.now()}`;
    const now = new Date().toISOString();
    try {
      db.prepare(
        `INSERT INTO admins (id, username, email, full_name, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        username,
        email,
        fullName || 'Administrator PRINT KAMPUS',
        hashPassword(password),
        now,
      );
    } catch {
      res.status(409).json({ error: 'Username atau email sudah digunakan.' });
      return;
    }

    const row = db.prepare('SELECT * FROM admins WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    const admin = mapAdminRow(row);
    const token = signSessionToken({ sub: admin.id, role: 'admin', email: admin.email });
    res.status(201).json({ token, admin });
  });

  app.post('/api/auth/admin/login', (req, res) => {
    const identifier = String(req.body?.identifier ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!identifier || !password) {
      res.status(400).json({ error: 'Username/email dan kata sandi wajib diisi.' });
      return;
    }

    const row = db
      .prepare('SELECT * FROM admins WHERE username = ? OR email = ?')
      .get(identifier, identifier) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(password, String(row.password_hash))) {
      res.status(401).json({ error: 'Username/email atau kata sandi Admin salah.' });
      return;
    }

    const admin = mapAdminRow(row);
    const token = signSessionToken({ sub: admin.id, role: 'admin', email: admin.email });
    res.json({ token, admin });
  });

  app.post('/api/auth/mitra/login', (req, res) => {
    const loginEmail = String(req.body?.loginEmail ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!loginEmail || !password) {
      res.status(400).json({ error: 'Email mitra dan kata sandi wajib diisi.' });
      return;
    }

    const row = db
      .prepare('SELECT * FROM mitras WHERE login_email = ?')
      .get(loginEmail) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(password, String(row.password_hash))) {
      res.status(401).json({ error: 'Email atau kata sandi Mitra tidak cocok.' });
      return;
    }

    const mitra = mapMitraRow(row);
    const token = signSessionToken({
      sub: mitra.id,
      role: 'mitra',
      email: mitra.loginEmail,
    });
    res.json({ token, mitra });
  });

  app.post('/api/auth/user/google', async (req, res) => {
    const idToken = String(req.body?.idToken ?? '').trim();
    if (!idToken) {
      res.status(400).json({ error: 'Token Google tidak valid.' });
      return;
    }

    try {
      const decoded = await getAuth(firebaseAdminApp).verifyIdToken(idToken);
      const uid = decoded.uid;
      const email = (decoded.email ?? '').toLowerCase();
      const name = decoded.name ?? email.split('@')[0] ?? 'Mahasiswa';
      const photoUrl = decoded.picture ?? '';

      if (!email) {
        res.status(400).json({ error: 'Akun Google tidak memiliki alamat email.' });
        return;
      }

      const existing = db
        .prepare('SELECT * FROM users WHERE id = ? OR email = ?')
        .get(uid, email) as Record<string, unknown> | undefined;

      if (!existing) {
        db.prepare(
          `INSERT INTO users (id, email, name, nim, faculty, phone, photo_url, created_at)
           VALUES (?, ?, ?, '', '', '', ?, ?)`,
        ).run(uid, email, name, photoUrl, new Date().toISOString());
      } else {
        db.prepare(
          `UPDATE users SET name = COALESCE(NULLIF(name, ''), ?), photo_url = ? WHERE id = ?`,
        ).run(name, photoUrl, String(existing.id));
      }

      const row = db
        .prepare('SELECT * FROM users WHERE id = ? OR email = ?')
        .get(uid, email) as Record<string, unknown>;
      const user = mapUserRow(row);
      const token = signSessionToken({ sub: user.id, role: 'user', email: user.email });
      res.json({ token, user });
    } catch {
      res.status(401).json({ error: 'Verifikasi token Google gagal. Silakan masuk ulang.' });
    }
  });

  // =========================================================================
  // 3. USER (MAHASISWA) PORTAL ENDPOINTS
  // =========================================================================
  app.get('/api/user/workspace', requireRole('user'), (req: AuthedRequest, res) => {
    const userId = req.session!.sub;
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<
      string,
      unknown
    >;
    const orders = (
      db
        .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
        .all(userId) as Record<string, unknown>[]
    ).map(mapOrderRow);
    const tickets = (
      db
        .prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC')
        .all(userId) as Record<string, unknown>[]
    ).map(mapTicketRow);
    res.json({ user: mapUserRow(userRow), orders, tickets });
  });

  app.put('/api/user/profile', requireRole('user'), (req: AuthedRequest, res) => {
    const userId = req.session!.sub;
    const name = String(req.body?.name ?? '').trim();
    const nim = String(req.body?.nim ?? '').trim();
    const faculty = String(req.body?.faculty ?? '').trim();
    const phone = String(req.body?.phone ?? '').trim();

    if (!name) {
      res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
      return;
    }

    db.prepare(
      `UPDATE users SET name = ?, nim = ?, faculty = ?, phone = ? WHERE id = ?`,
    ).run(name, nim, faculty, phone, userId);

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<
      string,
      unknown
    >;
    res.json({ user: mapUserRow(row) });
  });

  app.post('/api/user/orders', requireRole('user'), (req: AuthedRequest, res) => {
    const userId = req.session!.sub;
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<
      string,
      unknown
    >;
    const user = mapUserRow(userRow);

    const mitraId = String(req.body?.mitraId ?? '').trim();
    const documentTitle = String(req.body?.documentTitle ?? '').trim();
    const fileName = String(req.body?.fileName ?? '').trim();
    const fileSize = String(req.body?.fileSize ?? '0.50 MB').trim();
    const pageCount = Math.max(1, Number.parseInt(String(req.body?.pageCount ?? '1'), 10) || 1);
    const copies = Math.max(1, Number.parseInt(String(req.body?.copies ?? '1'), 10) || 1);
    const colorType = (req.body?.colorType ?? 'bw') as ColorType;
    const paperSize = (req.body?.paperSize ?? 'A4') as PaperSize;
    const paperWeight = (req.body?.paperWeight ?? '70gr') as PaperWeight;
    const duplex = Boolean(req.body?.duplex);
    const binding = (req.body?.binding ?? 'none') as BindingType;
    const notes = String(req.body?.notes ?? '').trim();
    const paymentMethod = (req.body?.paymentMethod ?? 'QRIS') as PaymentMethod;
    const pickupDeadline = String(req.body?.pickupDeadline ?? 'Hari ini, 16.00 WIB').trim();

    if (!documentTitle || !mitraId) {
      res.status(400).json({ error: 'Judul dokumen dan mitra percetakan wajib dipilih.' });
      return;
    }

    const mitraRow = db.prepare('SELECT * FROM mitras WHERE id = ?').get(mitraId) as
      | Record<string, unknown>
      | undefined;
    if (!mitraRow) {
      res.status(404).json({ error: 'Mitra percetakan tidak ditemukan.' });
      return;
    }
    const mitra = mapMitraRow(mitraRow);
    if (!mitra.isOpen) {
      res.status(400).json({ error: 'Mitra percetakan sedang tutup.' });
      return;
    }

    const settings = getCommissionSettings();
    const pricingResult = calculateOrderPricing({
      pageCount,
      copies,
      colorType,
      paperSize,
      paperWeight,
      duplex,
      binding,
      pricing: mitra.pricing,
      platformCommissionPercent: settings.platformCommissionPercent,
    });

    if (pricingResult.totalAmount < settings.minimumOrderAmount) {
      res.status(400).json({
        error: `Minimum transaksi adalah Rp ${settings.minimumOrderAmount.toLocaleString('id-ID')}.`,
      });
      return;
    }

    const allOrders = (db.prepare('SELECT order_number FROM orders').all() as { order_number: string }[]).map(
      (r) => ({ orderNumber: r.order_number }),
    ) as unknown as Parameters<typeof generateOrderNumber>[0];

    const orderNumber = generateOrderNumber(allOrders);
    const id = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const paymentStatus = paymentMethod === 'COD' ? 'bayar_di_tempat' : 'lunas';
    const history = [
      {
        status: 'menunggu_konfirmasi',
        timestamp: nowIso,
        note: `Pesanan dibuat via ${paymentMethod} dan masuk antrean ${mitra.name}.`,
      },
    ];

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO orders (
          id, order_number, user_id, student_name, student_nim, student_phone, student_email,
          mitra_id, mitra_name, mitra_location, document_title, file_name, file_size,
          page_count, copies, color_type, paper_size, paper_weight, duplex, binding, notes,
          unit_print_price, unit_binding_price, subtotal, platform_fee, mitra_earnings, total_amount,
          payment_method, payment_status, status, status_history_json, pickup_deadline, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        orderNumber,
        user.id,
        user.name,
        user.nim || '-',
        user.phone || '-',
        user.email,
        mitra.id,
        mitra.name,
        mitra.campusArea,
        documentTitle,
        fileName || `${documentTitle.replace(/\s+/g, '_')}.pdf`,
        fileSize,
        pageCount,
        copies,
        colorType,
        paperSize,
        paperWeight,
        duplex ? 1 : 0,
        binding,
        notes,
        pricingResult.unitPrintPrice,
        pricingResult.unitBindingPrice,
        pricingResult.subtotal,
        pricingResult.platformFee,
        pricingResult.mitraEarnings,
        pricingResult.totalAmount,
        paymentMethod,
        paymentStatus,
        'menunggu_konfirmasi',
        JSON.stringify(history),
        pickupDeadline,
        nowIso,
      );

      db.prepare('UPDATE mitras SET queue_count = queue_count + 1 WHERE id = ?').run(
        mitra.id,
      );
    });
    tx();

    const created = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.status(201).json({ order: mapOrderRow(created) });
  });

  app.put('/api/user/orders/:id', requireRole('user'), (req: AuthedRequest, res) => {
    const userId = req.session!.sub;
    const orderId = String(req.params.id);
    const existingRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
      | Record<string, unknown>
      | undefined;
    if (!existingRow) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    const existing = mapOrderRow(existingRow);
    if (existing.userId !== userId) {
      res.status(403).json({ error: 'Anda tidak memiliki akses ke pesanan ini.' });
      return;
    }
    if (existing.status !== 'menunggu_konfirmasi') {
      res.status(400).json({ error: 'Pesanan yang sedang diproses tidak dapat diubah.' });
      return;
    }

    const mitraId = String(req.body?.mitraId ?? existing.mitraId);
    const mitraRow = db.prepare('SELECT * FROM mitras WHERE id = ?').get(mitraId) as
      | Record<string, unknown>
      | undefined;
    if (!mitraRow) {
      res.status(404).json({ error: 'Mitra tidak ditemukan.' });
      return;
    }
    const mitra = mapMitraRow(mitraRow);
    const settings = getCommissionSettings();

    const pageCount = Math.max(1, Number(req.body?.pageCount ?? existing.pageCount));
    const copies = Math.max(1, Number(req.body?.copies ?? existing.copies));
    const colorType = (req.body?.colorType ?? existing.colorType) as ColorType;
    const paperSize = (req.body?.paperSize ?? existing.paperSize) as PaperSize;
    const paperWeight = (req.body?.paperWeight ?? existing.paperWeight) as PaperWeight;
    const duplex = req.body?.duplex !== undefined ? Boolean(req.body.duplex) : existing.duplex;
    const binding = (req.body?.binding ?? existing.binding) as BindingType;
    const documentTitle = String(req.body?.documentTitle ?? existing.documentTitle).trim();
    const notes = String(req.body?.notes ?? existing.notes).trim();
    const paymentMethod = (req.body?.paymentMethod ?? existing.paymentMethod) as PaymentMethod;
    const pickupDeadline = String(req.body?.pickupDeadline ?? existing.pickupDeadline).trim();

    const pricingResult = calculateOrderPricing({
      pageCount,
      copies,
      colorType,
      paperSize,
      paperWeight,
      duplex,
      binding,
      pricing: mitra.pricing,
      platformCommissionPercent: settings.platformCommissionPercent,
    });

    const history = [
      ...existing.statusHistory,
      {
        status: existing.status,
        timestamp: new Date().toISOString(),
        note: 'Spesifikasi cetak diperbarui oleh mahasiswa.',
      },
    ];

    db.prepare(
      `UPDATE orders SET
        mitra_id = ?, mitra_name = ?, mitra_location = ?, document_title = ?,
        page_count = ?, copies = ?, color_type = ?, paper_size = ?, paper_weight = ?,
        duplex = ?, binding = ?, notes = ?, unit_print_price = ?, unit_binding_price = ?,
        subtotal = ?, platform_fee = ?, mitra_earnings = ?, total_amount = ?,
        payment_method = ?, payment_status = ?, pickup_deadline = ?, status_history_json = ?
       WHERE id = ?`,
    ).run(
      mitra.id,
      mitra.name,
      mitra.campusArea,
      documentTitle,
      pageCount,
      copies,
      colorType,
      paperSize,
      paperWeight,
      duplex ? 1 : 0,
      binding,
      notes,
      pricingResult.unitPrintPrice,
      pricingResult.unitBindingPrice,
      pricingResult.subtotal,
      pricingResult.platformFee,
      pricingResult.mitraEarnings,
      pricingResult.totalAmount,
      paymentMethod,
      paymentMethod === 'COD' ? 'bayar_di_tempat' : 'lunas',
      pickupDeadline,
      JSON.stringify(history),
      orderId,
    );

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<
      string,
      unknown
    >;
    res.json({ order: mapOrderRow(updated) });
  });

  app.patch('/api/user/orders/:id/cancel', requireRole('user'), (req: AuthedRequest, res) => {
    const userId = req.session!.sub;
    const orderId = String(req.params.id);
    const existingRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
      | Record<string, unknown>
      | undefined;
    if (!existingRow) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    const existing = mapOrderRow(existingRow);
    if (existing.userId !== userId) {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }
    if (existing.status !== 'menunggu_konfirmasi') {
      res.status(400).json({ error: 'Hanya pesanan yang belum diproses yang dapat dibatalkan.' });
      return;
    }
    const result = applyOrderStatusTransitionTx(
      orderId,
      'dibatalkan',
      'Pesanan dibatalkan oleh mahasiswa sebelum diproses.',
    );
    res.status(result.status).json({ order: result.order });
  });

  app.delete('/api/user/orders/:id', requireRole('user'), (req: AuthedRequest, res) => {
    const userId = req.session!.sub;
    const orderId = String(req.params.id);
    const existingRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
      | Record<string, unknown>
      | undefined;
    if (!existingRow) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    const existing = mapOrderRow(existingRow);
    if (existing.userId !== userId) {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }

    const tx = db.transaction(() => {
      if (existing.status !== 'selesai' && existing.status !== 'dibatalkan') {
        db.prepare(
          'UPDATE mitras SET queue_count = MAX(0, queue_count - 1) WHERE id = ?',
        ).run(existing.mitraId);
      }
      db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    });
    tx();
    res.json({ deleted: true });
  });

  app.post('/api/user/tickets', requireRole('user'), (req: AuthedRequest, res) => {
    const userId = req.session!.sub;
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<
      string,
      unknown
    >;
    const user = mapUserRow(userRow);
    const orderId = String(req.body?.orderId ?? '').trim();
    const category = String(req.body?.category ?? 'lainnya');
    const description = String(req.body?.description ?? '').trim();

    if (!orderId || !description) {
      res.status(400).json({ error: 'Pesanan dan deskripsi kendala wajib diisi.' });
      return;
    }

    const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
      | Record<string, unknown>
      | undefined;
    if (!orderRow || String(orderRow.user_id) !== userId) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }

    const id = `tkt-${Date.now()}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO tickets (id, order_id, order_number, user_id, reporter_name, reporter_role, category, description, status, admin_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'user', ?, ?, 'terbuka', '', ?, ?)`,
    ).run(id, orderId, String(orderRow.order_number), userId, user.name, category, description, now, now);

    const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.status(201).json({ ticket: mapTicketRow(row) });
  });

  app.put('/api/user/tickets/:id', requireRole('user'), (req: AuthedRequest, res) => {
    const userId = req.session!.sub;
    const id = String(req.params.id);
    const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row || String(row.user_id) !== userId) {
      res.status(404).json({ error: 'Tiket tidak ditemukan.' });
      return;
    }
    const description = String(req.body?.description ?? '').trim();
    const category = String(req.body?.category ?? row.category);
    if (!description) {
      res.status(400).json({ error: 'Deskripsi wajib diisi.' });
      return;
    }
    db.prepare('UPDATE tickets SET description = ?, category = ?, updated_at = ? WHERE id = ?').run(
      description,
      category,
      new Date().toISOString(),
      id,
    );
    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.json({ ticket: mapTicketRow(updated) });
  });

  app.delete('/api/user/tickets/:id', requireRole('user'), (req: AuthedRequest, res) => {
    const userId = req.session!.sub;
    const id = String(req.params.id);
    const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row || String(row.user_id) !== userId) {
      res.status(404).json({ error: 'Tiket tidak ditemukan.' });
      return;
    }
    db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  // =========================================================================
  // 4. MITRA PERCETAKAN PORTAL ENDPOINTS
  // =========================================================================
  app.get('/api/mitra/workspace', requireRole('mitra'), (req: AuthedRequest, res) => {
    const mitraId = req.session!.sub;
    const mitraRow = db.prepare('SELECT * FROM mitras WHERE id = ?').get(mitraId) as
      | Record<string, unknown>
      | undefined;
    if (!mitraRow) {
      res.status(404).json({ error: 'Akun mitra tidak ditemukan.' });
      return;
    }

    const orders = (
      db
        .prepare('SELECT * FROM orders WHERE mitra_id = ? ORDER BY created_at DESC')
        .all(mitraId) as Record<string, unknown>[]
    ).map(mapOrderRow);

    const services = (
      db.prepare('SELECT * FROM services ORDER BY code ASC').all() as Record<
        string,
        unknown
      >[]
    ).map(mapServiceRow);

    const payouts = (
      db
        .prepare('SELECT * FROM payouts WHERE mitra_id = ? ORDER BY created_at DESC')
        .all(mitraId) as Record<string, unknown>[]
    ).map(mapPayoutRow);

    const settings = getCommissionSettings();

    res.json({
      mitra: mapMitraRow(mitraRow),
      orders,
      services,
      payouts,
      settings,
    });
  });

  app.put('/api/mitra/profile', requireRole('mitra'), (req: AuthedRequest, res) => {
    const mitraId = req.session!.sub;
    const row = db.prepare('SELECT * FROM mitras WHERE id = ?').get(mitraId) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Mitra tidak ditemukan.' });
      return;
    }
    const existing = mapMitraRow(row);
    const name = String(req.body?.name ?? existing.name).trim();
    const campusArea = String(req.body?.campusArea ?? existing.campusArea).trim();
    const address = String(req.body?.address ?? existing.address).trim();
    const operatingHours = String(req.body?.operatingHours ?? existing.operatingHours).trim();
    const pricing: MitraPricing = req.body?.pricing
      ? {
          bwPerPage: Math.max(50, Number(req.body.pricing.bwPerPage ?? existing.pricing.bwPerPage)),
          colorPerPage: Math.max(100, Number(req.body.pricing.colorPerPage ?? existing.pricing.colorPerPage)),
          duplexDiscountPerPage: Math.max(
            0,
            Number(req.body.pricing.duplexDiscountPerPage ?? existing.pricing.duplexDiscountPerPage),
          ),
          bindings: {
            ...existing.pricing.bindings,
            ...(req.body.pricing.bindings ?? {}),
          },
        }
      : existing.pricing;

    const newPassword = String(req.body?.newPassword ?? '');
    if (newPassword && newPassword.length < 8) {
      res.status(400).json({ error: 'Kata sandi baru minimal 8 karakter.' });
      return;
    }

    if (newPassword) {
      db.prepare(
        `UPDATE mitras SET name = ?, campus_area = ?, address = ?, operating_hours = ?, pricing_json = ?, password_hash = ? WHERE id = ?`,
      ).run(
        name,
        campusArea,
        address,
        operatingHours,
        JSON.stringify(pricing),
        hashPassword(newPassword),
        mitraId,
      );
    } else {
      db.prepare(
        `UPDATE mitras SET name = ?, campus_area = ?, address = ?, operating_hours = ?, pricing_json = ? WHERE id = ?`,
      ).run(name, campusArea, address, operatingHours, JSON.stringify(pricing), mitraId);
    }

    const updated = db.prepare('SELECT * FROM mitras WHERE id = ?').get(mitraId) as Record<
      string,
      unknown
    >;
    res.json({ mitra: mapMitraRow(updated) });
  });

  app.patch('/api/mitra/toggle', requireRole('mitra'), (req: AuthedRequest, res) => {
    const mitraId = req.session!.sub;
    const row = db.prepare('SELECT is_open FROM mitras WHERE id = ?').get(mitraId) as
      | { is_open: number }
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Mitra tidak ditemukan.' });
      return;
    }
    const nextOpen = row.is_open ? 0 : 1;
    db.prepare('UPDATE mitras SET is_open = ? WHERE id = ?').run(nextOpen, mitraId);
    const updated = db.prepare('SELECT * FROM mitras WHERE id = ?').get(mitraId) as Record<
      string,
      unknown
    >;
    res.json({ mitra: mapMitraRow(updated) });
  });

  app.patch('/api/mitra/orders/:id/status', requireRole('mitra'), (req: AuthedRequest, res) => {
    const mitraId = req.session!.sub;
    const orderId = String(req.params.id);
    const existingRow = db.prepare('SELECT mitra_id FROM orders WHERE id = ?').get(orderId) as
      | { mitra_id: string }
      | undefined;
    if (!existingRow) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    if (existingRow.mitra_id !== mitraId) {
      res.status(403).json({ error: 'Pesanan bukan milik mitra ini.' });
      return;
    }

    const nextStatus = req.body?.status as OrderStatus;
    const note = String(req.body?.note ?? 'Status pesanan diperbarui oleh Mitra.').trim();
    const result = applyOrderStatusTransitionTx(orderId, nextStatus, note);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ order: result.order });
  });

  app.post('/api/mitra/services', requireRole('mitra'), (req, res) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    const category = String(req.body?.category ?? 'kertas');
    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const basePrice = Math.max(0, Number(req.body?.basePrice ?? 0));
    const unit = String(req.body?.unit ?? 'per halaman').trim();

    if (!code || !name) {
      res.status(400).json({ error: 'Kode dan nama layanan wajib diisi.' });
      return;
    }

    const id = `srv-${Date.now()}`;
    try {
      db.prepare(
        `INSERT INTO services (id, code, category, name, description, base_price, unit, is_active, created_by_role)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'mitra')`,
      ).run(id, code, category, name, description || 'Layanan percetakan mitra.', basePrice, unit);
    } catch {
      res.status(409).json({ error: 'Kode layanan sudah digunakan.' });
      return;
    }
    const row = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.status(201).json({ service: mapServiceRow(row) });
  });

  app.put('/api/mitra/services/:id', requireRole('mitra'), (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Layanan tidak ditemukan.' });
      return;
    }
    const name = String(req.body?.name ?? existing.name).trim();
    const description = String(req.body?.description ?? existing.description).trim();
    const basePrice = Math.max(0, Number(req.body?.basePrice ?? existing.base_price));
    const unit = String(req.body?.unit ?? existing.unit).trim();
    const isActive =
      req.body?.isActive !== undefined ? (req.body.isActive ? 1 : 0) : Number(existing.is_active);

    db.prepare(
      `UPDATE services SET name = ?, description = ?, base_price = ?, unit = ?, is_active = ? WHERE id = ?`,
    ).run(name, description, basePrice, unit, isActive, id);

    const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.json({ service: mapServiceRow(updated) });
  });

  app.delete('/api/mitra/services/:id', requireRole('mitra'), (req, res) => {
    const id = String(req.params.id);
    db.prepare('DELETE FROM services WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  app.post('/api/mitra/payouts', requireRole('mitra'), (req: AuthedRequest, res) => {
    const mitraId = req.session!.sub;
    const amount = Number(req.body?.amount ?? 0);
    const bankAccount = String(req.body?.bankAccount ?? '').trim();
    const settings = getCommissionSettings();

    if (!bankAccount) {
      res.status(400).json({ error: 'Nomor & nama rekening tujuan wajib diisi.' });
      return;
    }
    if (!Number.isFinite(amount) || amount < settings.payoutMinimum) {
      res.status(400).json({
        error: `Nominal minimal pencairan adalah Rp ${settings.payoutMinimum.toLocaleString('id-ID')}.`,
      });
      return;
    }

    const tx = db.transaction(() => {
      const mRow = db.prepare('SELECT * FROM mitras WHERE id = ?').get(mitraId) as
        | Record<string, unknown>
        | undefined;
      if (!mRow) return { error: 'Mitra tidak ditemukan.', status: 404 as const };
      const pending = Number(mRow.pending_balance);
      if (amount > pending) {
        return { error: 'Saldo siap cair tidak mencukupi.', status: 400 as const };
      }

      const payoutId = `pay-${Date.now()}`;
      const now = new Date().toISOString();
      db.prepare('UPDATE mitras SET pending_balance = pending_balance - ? WHERE id = ?').run(
        amount,
        mitraId,
      );
      db.prepare(
        `INSERT INTO payouts (id, mitra_id, mitra_name, amount, bank_account, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      ).run(payoutId, mitraId, String(mRow.name), amount, bankAccount, now);

      const payoutRow = db.prepare('SELECT * FROM payouts WHERE id = ?').get(payoutId) as Record<
        string,
        unknown
      >;
      return { payout: mapPayoutRow(payoutRow), status: 201 as const };
    });

    const result = tx();
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({ payout: result.payout });
  });

  app.delete('/api/mitra/payouts/:id', requireRole('mitra'), (req: AuthedRequest, res) => {
    const mitraId = req.session!.sub;
    const payoutId = String(req.params.id);

    const tx = db.transaction(() => {
      const pRow = db.prepare('SELECT * FROM payouts WHERE id = ?').get(payoutId) as
        | Record<string, unknown>
        | undefined;
      if (!pRow || String(pRow.mitra_id) !== mitraId) {
        return { error: 'Data pencairan tidak ditemukan.', status: 404 as const };
      }
      if (String(pRow.status) !== 'pending') {
        return { error: 'Hanya pengajuan berstatus pending yang dapat dibatalkan.', status: 400 as const };
      }
      db.prepare('UPDATE mitras SET pending_balance = pending_balance + ? WHERE id = ?').run(
        Number(pRow.amount),
        mitraId,
      );
      db.prepare('DELETE FROM payouts WHERE id = ?').run(payoutId);
      return { deleted: true, status: 200 as const };
    });

    const result = tx();
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ deleted: true });
  });

  // =========================================================================
  // 5. ADMIN PLATFORM PORTAL ENDPOINTS (FULL CRUD ACROSS ALL ENTITIES)
  // =========================================================================
  app.get('/api/admin/workspace', requireRole('admin'), (_req, res) => {
    const orders = (
      db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as Record<
        string,
        unknown
      >[]
    ).map(mapOrderRow);
    const mitras = (
      db.prepare('SELECT * FROM mitras ORDER BY created_at DESC').all() as Record<
        string,
        unknown
      >[]
    ).map(mapMitraRow);
    const services = (
      db.prepare('SELECT * FROM services ORDER BY code ASC').all() as Record<
        string,
        unknown
      >[]
    ).map(mapServiceRow);
    const tickets = (
      db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all() as Record<
        string,
        unknown
      >[]
    ).map(mapTicketRow);
    const payouts = (
      db.prepare('SELECT * FROM payouts ORDER BY created_at DESC').all() as Record<
        string,
        unknown
      >[]
    ).map(mapPayoutRow);
    const users = (
      db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as Record<
        string,
        unknown
      >[]
    ).map(mapUserRow);
    const admins = (
      db.prepare('SELECT * FROM admins ORDER BY created_at ASC').all() as Record<
        string,
        unknown
      >[]
    ).map(mapAdminRow);
    const settings = getCommissionSettings();

    res.json({ orders, mitras, services, tickets, payouts, users, admins, settings });
  });

  // Commission & Global Policy CRUD
  app.put('/api/admin/settings', requireRole('admin'), (req, res) => {
    const pct = Math.min(50, Math.max(0, Number(req.body?.platformCommissionPercent ?? 10)));
    const minOrder = Math.max(0, Number(req.body?.minimumOrderAmount ?? 2000));
    const firstDiscount = Math.max(0, Number(req.body?.firstOrderDiscount ?? 0));
    const payoutMin = Math.max(10000, Number(req.body?.payoutMinimum ?? 50000));
    const hotline = String(req.body?.supportHotline ?? 'support@printkampus.id').trim();

    db.prepare(
      `UPDATE settings
       SET platform_commission_percent = ?, minimum_order_amount = ?, first_order_discount = ?, payout_minimum = ?, support_hotline = ?
       WHERE id = 1`,
    ).run(pct, minOrder, firstDiscount, payoutMin, hotline);

    res.json({ settings: getCommissionSettings() });
  });

  // Mitra Account + Profile CRUD (Admin registers Mitra credentials into DB)
  app.post('/api/admin/mitras', requireRole('admin'), (req, res) => {
    const loginEmail = String(req.body?.loginEmail ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const name = String(req.body?.name ?? '').trim();
    const campusArea = String(req.body?.campusArea ?? '').trim();
    const address = String(req.body?.address ?? '').trim();
    const operatingHours = String(req.body?.operatingHours ?? '08.00 - 21.00 WIB').trim();
    const bwPerPage = Math.max(50, Number(req.body?.bwPerPage ?? 250));
    const colorPerPage = Math.max(100, Number(req.body?.colorPerPage ?? 1000));
    const lakbanPrice = Math.max(0, Number(req.body?.lakbanPrice ?? 3500));
    const spiralKawatPrice = Math.max(0, Number(req.body?.spiralKawatPrice ?? 12000));
    const hardcoverPrice = Math.max(0, Number(req.body?.hardcoverPrice ?? 35000));

    if (!loginEmail.includes('@') || password.length < 6 || !name || !campusArea) {
      res.status(400).json({
        error: 'Email login valid, sandi min. 6 karakter, nama mitra, dan area kampus wajib diisi.',
      });
      return;
    }

    const id = `mitra-${Date.now()}`;
    const now = new Date().toISOString();
    const pricing = defaultPricing(bwPerPage, colorPerPage);
    pricing.bindings.lakban = lakbanPrice;
    pricing.bindings.spiral_kawat = spiralKawatPrice;
    pricing.bindings.hardcover = hardcoverPrice;

    try {
      db.prepare(
        `INSERT INTO mitras (
          id, login_email, password_hash, name, campus_area, address, operating_hours,
          is_open, rating, queue_count, total_completed_orders, total_earnings, pending_balance,
          services_offered, pricing_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 5.0, 0, 0, 0, 0, ?, ?, ?)`,
      ).run(
        id,
        loginEmail,
        hashPassword(password),
        name,
        campusArea,
        address || campusArea,
        operatingHours,
        JSON.stringify(['Hitam Putih', 'Berwarna', 'Jilid Dokumen']),
        JSON.stringify(pricing),
        now,
      );
    } catch {
      res.status(409).json({ error: 'Email login mitra sudah terdaftar.' });
      return;
    }

    const row = db.prepare('SELECT * FROM mitras WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.status(201).json({ mitra: mapMitraRow(row) });
  });

  app.put('/api/admin/mitras/:id', requireRole('admin'), (req, res) => {
    const id = String(req.params.id);
    const row = db.prepare('SELECT * FROM mitras WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Mitra tidak ditemukan.' });
      return;
    }
    const existing = mapMitraRow(row);
    const loginEmail = String(req.body?.loginEmail ?? existing.loginEmail).trim().toLowerCase();
    const name = String(req.body?.name ?? existing.name).trim();
    const campusArea = String(req.body?.campusArea ?? existing.campusArea).trim();
    const address = String(req.body?.address ?? existing.address).trim();
    const operatingHours = String(req.body?.operatingHours ?? existing.operatingHours).trim();
    const bwPerPage = Math.max(50, Number(req.body?.bwPerPage ?? existing.pricing.bwPerPage));
    const colorPerPage = Math.max(100, Number(req.body?.colorPerPage ?? existing.pricing.colorPerPage));
    const pricing: MitraPricing = {
      ...existing.pricing,
      bwPerPage,
      colorPerPage,
      bindings: {
        ...existing.pricing.bindings,
        lakban: Number(req.body?.lakbanPrice ?? existing.pricing.bindings.lakban),
        spiral_kawat: Number(req.body?.spiralKawatPrice ?? existing.pricing.bindings.spiral_kawat),
        hardcover: Number(req.body?.hardcoverPrice ?? existing.pricing.bindings.hardcover),
      },
    };
    const newPassword = String(req.body?.password ?? '');

    try {
      if (newPassword && newPassword.length >= 6) {
        db.prepare(
          `UPDATE mitras SET login_email = ?, password_hash = ?, name = ?, campus_area = ?, address = ?, operating_hours = ?, pricing_json = ? WHERE id = ?`,
        ).run(
          loginEmail,
          hashPassword(newPassword),
          name,
          campusArea,
          address,
          operatingHours,
          JSON.stringify(pricing),
          id,
        );
      } else {
        db.prepare(
          `UPDATE mitras SET login_email = ?, name = ?, campus_area = ?, address = ?, operating_hours = ?, pricing_json = ? WHERE id = ?`,
        ).run(
          loginEmail,
          name,
          campusArea,
          address,
          operatingHours,
          JSON.stringify(pricing),
          id,
        );
      }
    } catch {
      res.status(409).json({ error: 'Email login mitra bentrok dengan mitra lain.' });
      return;
    }

    const updated = db.prepare('SELECT * FROM mitras WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.json({ mitra: mapMitraRow(updated) });
  });

  app.patch('/api/admin/mitras/:id/toggle', requireRole('admin'), (req, res) => {
    const id = String(req.params.id);
    const row = db.prepare('SELECT is_open FROM mitras WHERE id = ?').get(id) as
      | { is_open: number }
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Mitra tidak ditemukan.' });
      return;
    }
    db.prepare('UPDATE mitras SET is_open = ? WHERE id = ?').run(row.is_open ? 0 : 1, id);
    const updated = db.prepare('SELECT * FROM mitras WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.json({ mitra: mapMitraRow(updated) });
  });

  app.delete('/api/admin/mitras/:id', requireRole('admin'), (req, res) => {
    const id = String(req.params.id);
    db.prepare('DELETE FROM mitras WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  // Services Catalog CRUD (Admin)
  app.post('/api/admin/services', requireRole('admin'), (req, res) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    const category = String(req.body?.category ?? 'kertas');
    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const basePrice = Math.max(0, Number(req.body?.basePrice ?? 0));
    const unit = String(req.body?.unit ?? 'per halaman').trim();

    if (!code || !name) {
      res.status(400).json({ error: 'Kode dan nama layanan wajib diisi.' });
      return;
    }

    const id = `srv-${Date.now()}`;
    try {
      db.prepare(
        `INSERT INTO services (id, code, category, name, description, base_price, unit, is_active, created_by_role)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'admin')`,
      ).run(id, code, category, name, description || 'Layanan standar platform.', basePrice, unit);
    } catch {
      res.status(409).json({ error: 'Kode layanan sudah terdaftar.' });
      return;
    }

    const row = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.status(201).json({ service: mapServiceRow(row) });
  });

  app.put('/api/admin/services/:id', requireRole('admin'), (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Layanan tidak ditemukan.' });
      return;
    }
    const code = String(req.body?.code ?? existing.code).trim().toUpperCase();
    const category = String(req.body?.category ?? existing.category);
    const name = String(req.body?.name ?? existing.name).trim();
    const description = String(req.body?.description ?? existing.description).trim();
    const basePrice = Math.max(0, Number(req.body?.basePrice ?? existing.base_price));
    const unit = String(req.body?.unit ?? existing.unit).trim();
    const isActive =
      req.body?.isActive !== undefined ? (req.body.isActive ? 1 : 0) : Number(existing.is_active);

    db.prepare(
      `UPDATE services SET code = ?, category = ?, name = ?, description = ?, base_price = ?, unit = ?, is_active = ? WHERE id = ?`,
    ).run(code, category, name, description, basePrice, unit, isActive, id);

    const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.json({ service: mapServiceRow(updated) });
  });

  app.delete('/api/admin/services/:id', requireRole('admin'), (req, res) => {
    const id = String(req.params.id);
    db.prepare('DELETE FROM services WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  // Orders CRUD (Admin)
  app.post('/api/admin/orders', requireRole('admin'), (req, res) => {
    const studentName = String(req.body?.studentName ?? '').trim();
    const studentNim = String(req.body?.studentNim ?? '-').trim();
    const studentPhone = String(req.body?.studentPhone ?? '-').trim();
    const mitraId = String(req.body?.mitraId ?? '').trim();
    const documentTitle = String(req.body?.documentTitle ?? '').trim();
    const pageCount = Math.max(1, Number(req.body?.pageCount ?? 10));
    const copies = Math.max(1, Number(req.body?.copies ?? 1));
    const colorType = (req.body?.colorType ?? 'bw') as ColorType;
    const paperSize = (req.body?.paperSize ?? 'A4') as PaperSize;
    const paperWeight = (req.body?.paperWeight ?? '70gr') as PaperWeight;
    const duplex = Boolean(req.body?.duplex);
    const binding = (req.body?.binding ?? 'none') as BindingType;
    const notes = String(req.body?.notes ?? '').trim();
    const paymentMethod = (req.body?.paymentMethod ?? 'QRIS') as PaymentMethod;
    const pickupDeadline = String(req.body?.pickupDeadline ?? 'Hari ini, 16.00 WIB').trim();

    if (!studentName || !mitraId || !documentTitle) {
      res.status(400).json({ error: 'Nama pemesan, mitra, dan judul dokumen wajib diisi.' });
      return;
    }

    const mitraRow = db.prepare('SELECT * FROM mitras WHERE id = ?').get(mitraId) as
      | Record<string, unknown>
      | undefined;
    if (!mitraRow) {
      res.status(404).json({ error: 'Mitra tidak ditemukan.' });
      return;
    }
    const mitra = mapMitraRow(mitraRow);
    const settings = getCommissionSettings();
    const pricingResult = calculateOrderPricing({
      pageCount,
      copies,
      colorType,
      paperSize,
      paperWeight,
      duplex,
      binding,
      pricing: mitra.pricing,
      platformCommissionPercent: settings.platformCommissionPercent,
    });

    const allOrders = (
      db.prepare('SELECT order_number FROM orders').all() as { order_number: string }[]
    ).map((r) => ({ orderNumber: r.order_number })) as unknown as Parameters<
      typeof generateOrderNumber
    >[0];
    const orderNumber = generateOrderNumber(allOrders);
    const id = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const history = [
      {
        status: 'menunggu_konfirmasi',
        timestamp: nowIso,
        note: 'Pesanan dicatat manual oleh Admin Platform.',
      },
    ];

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO orders (
          id, order_number, user_id, student_name, student_nim, student_phone, student_email,
          mitra_id, mitra_name, mitra_location, document_title, file_name, file_size,
          page_count, copies, color_type, paper_size, paper_weight, duplex, binding, notes,
          unit_print_price, unit_binding_price, subtotal, platform_fee, mitra_earnings, total_amount,
          payment_method, payment_status, status, status_history_json, pickup_deadline, created_at
        ) VALUES (?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?, '0.50 MB', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu_konfirmasi', ?, ?, ?)`,
      ).run(
        id,
        orderNumber,
        studentName,
        studentNim,
        studentPhone,
        mitra.id,
        mitra.name,
        mitra.campusArea,
        documentTitle,
        `${documentTitle.replace(/\s+/g, '_')}.pdf`,
        pageCount,
        copies,
        colorType,
        paperSize,
        paperWeight,
        duplex ? 1 : 0,
        binding,
        notes,
        pricingResult.unitPrintPrice,
        pricingResult.unitBindingPrice,
        pricingResult.subtotal,
        pricingResult.platformFee,
        pricingResult.mitraEarnings,
        pricingResult.totalAmount,
        paymentMethod,
        paymentMethod === 'COD' ? 'bayar_di_tempat' : 'lunas',
        JSON.stringify(history),
        pickupDeadline,
        nowIso,
      );
      db.prepare('UPDATE mitras SET queue_count = queue_count + 1 WHERE id = ?').run(
        mitra.id,
      );
    });
    tx();

    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.status(201).json({ order: mapOrderRow(row) });
  });

  app.patch('/api/admin/orders/:id/status', requireRole('admin'), (req, res) => {
    const orderId = String(req.params.id);
    const nextStatus = req.body?.status as OrderStatus;
    const note = String(req.body?.note ?? `Status diubah menjadi ${nextStatus} oleh Admin.`).trim();
    const result = applyOrderStatusTransitionTx(orderId, nextStatus, note);
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ order: result.order });
  });

  app.delete('/api/admin/orders/:id', requireRole('admin'), (req, res) => {
    const orderId = String(req.params.id);
    const existingRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as
      | Record<string, unknown>
      | undefined;
    if (!existingRow) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    const existing = mapOrderRow(existingRow);
    const tx = db.transaction(() => {
      if (existing.status !== 'selesai' && existing.status !== 'dibatalkan') {
        db.prepare(
          'UPDATE mitras SET queue_count = MAX(0, queue_count - 1) WHERE id = ?',
        ).run(existing.mitraId);
      }
      db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
    });
    tx();
    res.json({ deleted: true });
  });

  // Tickets CRUD (Admin)
  app.post('/api/admin/tickets', requireRole('admin'), (req, res) => {
    const orderId = String(req.body?.orderId ?? '').trim();
    const orderNumber = String(req.body?.orderNumber ?? 'MANUAL').trim();
    const reporterName = String(req.body?.reporterName ?? 'Admin Platform').trim();
    const category = String(req.body?.category ?? 'lainnya');
    const description = String(req.body?.description ?? '').trim();
    if (!description) {
      res.status(400).json({ error: 'Deskripsi tiket wajib diisi.' });
      return;
    }
    const id = `tkt-${Date.now()}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO tickets (id, order_id, order_number, user_id, reporter_name, reporter_role, category, description, status, admin_note, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, 'admin', ?, ?, 'terbuka', '', ?, ?)`,
    ).run(id, orderId || id, orderNumber, reporterName, category, description, now, now);
    const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.status(201).json({ ticket: mapTicketRow(row) });
  });

  app.put('/api/admin/tickets/:id', requireRole('admin'), (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Tiket tidak ditemukan.' });
      return;
    }
    const status = String(req.body?.status ?? existing.status);
    const adminNote = String(req.body?.adminNote ?? existing.admin_note);
    db.prepare('UPDATE tickets SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?').run(
      status,
      adminNote,
      new Date().toISOString(),
      id,
    );
    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.json({ ticket: mapTicketRow(updated) });
  });

  app.delete('/api/admin/tickets/:id', requireRole('admin'), (req, res) => {
    const id = String(req.params.id);
    db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  // Payouts status update (Admin)
  app.patch('/api/admin/payouts/:id', requireRole('admin'), (req, res) => {
    const id = String(req.params.id);
    const nextStatus = String(req.body?.status ?? '');
    if (!['selesai', 'ditolak'].includes(nextStatus)) {
      res.status(400).json({ error: 'Status pencairan tidak valid.' });
      return;
    }
    const tx = db.transaction(() => {
      const pRow = db.prepare('SELECT * FROM payouts WHERE id = ?').get(id) as
        | Record<string, unknown>
        | undefined;
      if (!pRow) return { error: 'Data pencairan tidak ditemukan.', status: 404 as const };
      if (String(pRow.status) !== 'pending') {
        return { error: 'Pencairan sudah diproses sebelumnya.', status: 400 as const };
      }
      db.prepare('UPDATE payouts SET status = ? WHERE id = ?').run(nextStatus, id);
      if (nextStatus === 'ditolak') {
        db.prepare('UPDATE mitras SET pending_balance = pending_balance + ? WHERE id = ?').run(
          Number(pRow.amount),
          String(pRow.mitra_id),
        );
      }
      const updated = db.prepare('SELECT * FROM payouts WHERE id = ?').get(id) as Record<
        string,
        unknown
      >;
      return { payout: mapPayoutRow(updated), status: 200 as const };
    });
    const result = tx();
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ payout: result.payout });
  });

  // Admin DB Accounts CRUD
  app.post('/api/admin/accounts', requireRole('admin'), (req, res) => {
    const username = String(req.body?.username ?? '').trim().toLowerCase();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const fullName = String(req.body?.fullName ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!username || username.length < 3 || !email.includes('@') || password.length < 8) {
      res.status(400).json({
        error: 'Username min. 3 karakter, email valid, dan kata sandi min. 8 karakter.',
      });
      return;
    }

    const id = `adm-${Date.now()}`;
    try {
      db.prepare(
        `INSERT INTO admins (id, username, email, full_name, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        username,
        email,
        fullName || username,
        hashPassword(password),
        new Date().toISOString(),
      );
    } catch {
      res.status(409).json({ error: 'Username atau email admin sudah terdaftar.' });
      return;
    }
    const row = db.prepare('SELECT * FROM admins WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.status(201).json({ admin: mapAdminRow(row) });
  });

  app.put('/api/admin/accounts/:id', requireRole('admin'), (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare('SELECT * FROM admins WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }
    const fullName = String(req.body?.fullName ?? existing.full_name).trim();
    const email = String(req.body?.email ?? existing.email).trim().toLowerCase();
    const newPassword = String(req.body?.password ?? '');
    if (newPassword && newPassword.length < 8) {
      res.status(400).json({ error: 'Kata sandi baru minimal 8 karakter.' });
      return;
    }
    try {
      if (newPassword) {
        db.prepare(
          'UPDATE admins SET full_name = ?, email = ?, password_hash = ? WHERE id = ?',
        ).run(fullName, email, hashPassword(newPassword), id);
      } else {
        db.prepare('UPDATE admins SET full_name = ?, email = ? WHERE id = ?').run(
          fullName,
          email,
          id,
        );
      }
    } catch {
      res.status(409).json({ error: 'Email sudah digunakan oleh admin lain.' });
      return;
    }
    const updated = db.prepare('SELECT * FROM admins WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    res.json({ admin: mapAdminRow(updated) });
  });

  app.delete('/api/admin/accounts/:id', requireRole('admin'), (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const count = (
      db.prepare('SELECT COUNT(*) AS cnt FROM admins').get() as { cnt: number }
    ).cnt;
    if (count <= 1) {
      res.status(400).json({ error: 'Minimal 1 akun admin harus tersisa di database.' });
      return;
    }
    if (req.session!.sub === id) {
      res.status(400).json({ error: 'Anda tidak dapat menghapus akun admin yang sedang aktif.' });
      return;
    }
    db.prepare('DELETE FROM admins WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  // Google Users Management (Admin)
  app.delete('/api/admin/users/:id', requireRole('admin'), (req, res) => {
    const id = String(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  // =========================================================================
  // 6. VITE / STATIC ASSET SERVING + SPA ROUTE FALLBACK
  // =========================================================================
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  const PORT = Number(process.env.PORT ?? 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PRINT KAMPUS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
