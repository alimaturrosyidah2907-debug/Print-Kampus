import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  SUPER_ADMIN_EMAIL,
} from '../firebase';
import type {
  AdminAccount,
  AdminInvite,
  BindingType,
  ColorType,
  CommissionSettings,
  IssueCategory,
  IssueStatus,
  IssueTicket,
  Mitra,
  MitraPayout,
  MitraPricing,
  Order,
  OrderStatus,
  PaperSize,
  PaperWeight,
  PaymentMethod,
  PortalRoute,
  PrintServiceItem,
  ServiceCategory,
  StatusHistoryEntry,
  ToastMessage,
  ToastType,
  UserProfile,
} from '../types/printkampus';
import { calculateOrderPricing } from '../utils/pricing';

const DEFAULT_SETTINGS: CommissionSettings = {
  platformCommissionPercent: 10,
  minimumOrderAmount: 2000,
  firstOrderDiscount: 0,
  payoutMinimum: 50000,
  supportHotline: 'support@printkampus.id',
};

const DEFAULT_MITRA_SERVICES = ['Hitam Putih (B/W)', 'Berwarna (CLR)', 'Jilid Dokumen'];

function parseRouteFromPath(pathname: string): PortalRoute {
  const withoutBase = pathname.toLowerCase().replace(/^\/print-kampus(?=\/|$)/, '') || '/';
  if (withoutBase.startsWith('/user')) return 'user';
  if (withoutBase.startsWith('/mitra')) return 'mitra';
  if (withoutBase.startsWith('/admin')) return 'admin';
  return 'home';
}

function resolveTargetPath(route: PortalRoute): string {
  const usesRepoBase = window.location.pathname.toLowerCase().startsWith('/print-kampus');
  if (usesRepoBase) {
    return route === 'home' ? '/Print-Kampus/' : `/Print-Kampus/${route}`;
  }
  return route === 'home' ? '/' : `/${route}`;
}

function makeDocId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clip(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .trim()
    .slice(0, maxLen);
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function normalizeBindings(raw: unknown): MitraPricing['bindings'] {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    none: Math.max(0, Number(obj.none ?? 0)),
    staples: Math.max(0, Number(obj.staples ?? 1000)),
    lakban: Math.max(0, Number(obj.lakban ?? 3500)),
    spiral_plastik: Math.max(0, Number(obj.spiral_plastik ?? 7000)),
    spiral_kawat: Math.max(0, Number(obj.spiral_kawat ?? 12000)),
    hardcover: Math.max(0, Number(obj.hardcover ?? 35000)),
  };
}

function normalizePricing(raw: unknown): MitraPricing {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    bwPerPage: Math.max(50, Number(obj.bwPerPage ?? 250)),
    colorPerPage: Math.max(100, Number(obj.colorPerPage ?? 1000)),
    duplexDiscountPerPage: Math.max(0, Number(obj.duplexDiscountPerPage ?? 40)),
    bindings: normalizeBindings(obj.bindings),
  };
}

function mapMitraDoc(id: string, data: Record<string, unknown>): Mitra {
  return {
    id,
    loginEmail: String(data.loginEmail ?? ''),
    ownerUid: data.ownerUid ? String(data.ownerUid) : undefined,
    name: String(data.name ?? ''),
    campusArea: String(data.campusArea ?? ''),
    address: String(data.address ?? ''),
    operatingHours: String(data.operatingHours ?? ''),
    isOpen: Boolean(data.isOpen),
    rating: Number(data.rating ?? 5),
    queueCount: Number(data.queueCount ?? 0),
    totalCompletedOrders: Number(data.totalCompletedOrders ?? 0),
    totalEarnings: Number(data.totalEarnings ?? 0),
    pendingBalance: Number(data.pendingBalance ?? 0),
    servicesOffered: Array.isArray(data.servicesOffered)
      ? data.servicesOffered.map(String)
      : [...DEFAULT_MITRA_SERVICES],
    pricing: normalizePricing(data.pricing),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function mapOrderDoc(id: string, data: Record<string, unknown>): Order {
  return {
    id,
    orderNumber: String(data.orderNumber ?? ''),
    userId: data.userId ? String(data.userId) : undefined,
    studentName: String(data.studentName ?? ''),
    studentNim: String(data.studentNim ?? ''),
    studentPhone: String(data.studentPhone ?? ''),
    studentEmail: data.studentEmail ? String(data.studentEmail) : undefined,
    mitraId: String(data.mitraId ?? ''),
    mitraOwnerUid: data.mitraOwnerUid ? String(data.mitraOwnerUid) : undefined,
    mitraName: String(data.mitraName ?? ''),
    mitraLocation: String(data.mitraLocation ?? ''),
    documentTitle: String(data.documentTitle ?? ''),
    fileName: String(data.fileName ?? ''),
    fileSize: String(data.fileSize ?? ''),
    pageCount: Number(data.pageCount ?? 1),
    copies: Number(data.copies ?? 1),
    colorType: (data.colorType as ColorType) ?? 'bw',
    paperSize: (data.paperSize as PaperSize) ?? 'A4',
    paperWeight: (data.paperWeight as PaperWeight) ?? '70gr',
    duplex: Boolean(data.duplex),
    binding: (data.binding as BindingType) ?? 'none',
    notes: String(data.notes ?? ''),
    unitPrintPrice: Number(data.unitPrintPrice ?? 0),
    unitBindingPrice: Number(data.unitBindingPrice ?? 0),
    subtotal: Number(data.subtotal ?? 0),
    platformFee: Number(data.platformFee ?? 0),
    mitraEarnings: Number(data.mitraEarnings ?? 0),
    totalAmount: Number(data.totalAmount ?? 0),
    paymentMethod: (data.paymentMethod as PaymentMethod) ?? 'QRIS',
    paymentStatus: (data.paymentStatus as Order['paymentStatus']) ?? 'lunas',
    status: (data.status as OrderStatus) ?? 'menunggu_konfirmasi',
    statusHistory: Array.isArray(data.statusHistory)
      ? (data.statusHistory as StatusHistoryEntry[])
      : [],
    pickupDeadline: String(data.pickupDeadline ?? ''),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function mapServiceDoc(id: string, data: Record<string, unknown>): PrintServiceItem {
  return {
    id,
    code: String(data.code ?? ''),
    category: (data.category as ServiceCategory) ?? 'kertas',
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    basePrice: Number(data.basePrice ?? 0),
    unit: String(data.unit ?? 'per halaman'),
    isActive: Boolean(data.isActive),
    createdByRole: (data.createdByRole as PrintServiceItem['createdByRole']) ?? 'admin',
    ownerUid: data.ownerUid ? String(data.ownerUid) : undefined,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function mapTicketDoc(id: string, data: Record<string, unknown>): IssueTicket {
  return {
    id,
    orderId: String(data.orderId ?? ''),
    orderNumber: String(data.orderNumber ?? ''),
    userId: data.userId ? String(data.userId) : undefined,
    reporterName: String(data.reporterName ?? ''),
    reporterRole: (data.reporterRole as IssueTicket['reporterRole']) ?? 'user',
    category: (data.category as IssueCategory) ?? 'lainnya',
    description: String(data.description ?? ''),
    status: (data.status as IssueStatus) ?? 'terbuka',
    adminNote: String(data.adminNote ?? ''),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function mapPayoutDoc(id: string, data: Record<string, unknown>): MitraPayout {
  return {
    id,
    mitraId: String(data.mitraId ?? ''),
    mitraLoginEmail: data.mitraLoginEmail ? String(data.mitraLoginEmail) : undefined,
    mitraName: String(data.mitraName ?? ''),
    amount: Number(data.amount ?? 0),
    bankAccount: String(data.bankAccount ?? ''),
    status: (data.status as MitraPayout['status']) ?? 'pending',
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function mapUserDoc(id: string, data: Record<string, unknown>): UserProfile {
  return {
    id,
    email: String(data.email ?? ''),
    name: String(data.name ?? ''),
    nim: String(data.nim ?? ''),
    faculty: String(data.faculty ?? ''),
    phone: String(data.phone ?? ''),
    photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
    createdAt: toIso(data.createdAt),
  };
}

function mapAdminDoc(id: string, data: Record<string, unknown>): AdminAccount {
  return {
    id,
    username: String(data.username ?? ''),
    email: String(data.email ?? ''),
    fullName: String(data.fullName ?? ''),
    inviteId: data.inviteId ? String(data.inviteId) : undefined,
    createdAt: toIso(data.createdAt),
  };
}

function mapAdminInviteDoc(id: string, data: Record<string, unknown>): AdminInvite {
  return {
    id,
    email: String(data.email ?? ''),
    username: String(data.username ?? ''),
    fullName: String(data.fullName ?? ''),
    invitedByUid: String(data.invitedByUid ?? ''),
    createdAt: toIso(data.createdAt),
  };
}

function sortByCreatedDesc<T extends { createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  );
}

interface AppContextValue {
  portalRoute: PortalRoute;
  navigatePortal: (route: PortalRoute) => void;
  isDark: boolean;
  toggleDark: () => void;
  toasts: ToastMessage[];
  addToast: (type: ToastType, title: string, message: string) => void;
  dismissToast: (id: string) => void;

  // Public directory (Cloud Firestore)
  publicMitras: Mitra[];
  publicServices: PrintServiceItem[];
  commissionSettings: CommissionSettings;

  // User (Mahasiswa) Firebase Google Auth + Firestore Workspace
  userUid: string | null;
  userProfile: UserProfile | null;
  userOrders: Order[];
  userTickets: IssueTicket[];
  loginUserWithGoogle: () => Promise<boolean>;
  logoutUser: () => Promise<void>;
  updateUserProfile: (patch: {
    name: string;
    nim: string;
    faculty: string;
    phone: string;
  }) => Promise<boolean>;
  createUserOrder: (payload: Record<string, unknown>) => Promise<boolean>;
  updateUserOrder: (orderId: string, payload: Record<string, unknown>) => Promise<boolean>;
  cancelUserOrder: (orderId: string) => Promise<boolean>;
  deleteUserOrder: (orderId: string) => Promise<boolean>;
  createUserTicket: (payload: {
    orderId: string;
    category: string;
    description: string;
  }) => Promise<boolean>;
  updateUserTicket: (
    id: string,
    payload: { category: string; description: string },
  ) => Promise<boolean>;
  deleteUserTicket: (id: string) => Promise<boolean>;

  // Mitra Percetakan Firebase Google Auth + Firestore Workspace
  mitraUid: string | null;
  mitraProfile: Mitra | null;
  mitraAuthError: string | null;
  mitraOrders: Order[];
  mitraServices: PrintServiceItem[];
  mitraPayouts: MitraPayout[];
  loginMitraWithGoogle: () => Promise<boolean>;
  logoutMitra: () => Promise<void>;
  updateMitraProfile: (payload: Record<string, unknown>) => Promise<boolean>;
  toggleMitraSelfOpen: () => Promise<boolean>;
  updateMitraOrderStatus: (orderId: string, status: OrderStatus, note: string) => Promise<boolean>;
  createMitraService: (payload: Record<string, unknown>) => Promise<boolean>;
  updateMitraService: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  deleteMitraService: (id: string) => Promise<boolean>;
  requestMitraPayout: (amount: number, bankAccount: string) => Promise<boolean>;
  cancelMitraPayout: (id: string) => Promise<boolean>;

  // Admin Platform Firebase Google Auth + Firestore Workspace
  adminUid: string | null;
  adminProfile: AdminAccount | null;
  adminAuthError: string | null;
  adminOrders: Order[];
  adminMitras: Mitra[];
  adminServices: PrintServiceItem[];
  adminTickets: IssueTicket[];
  adminPayouts: MitraPayout[];
  adminUsers: UserProfile[];
  adminAccounts: AdminAccount[];
  adminInvites: AdminInvite[];
  loginAdminWithGoogle: () => Promise<boolean>;
  logoutAdmin: () => Promise<void>;
  updateCommissionSettings: (settings: CommissionSettings) => Promise<boolean>;
  adminCreateMitra: (payload: Record<string, unknown>) => Promise<boolean>;
  adminUpdateMitra: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  adminToggleMitraOpen: (id: string) => Promise<boolean>;
  adminDeleteMitra: (id: string) => Promise<boolean>;
  adminCreateService: (payload: Record<string, unknown>) => Promise<boolean>;
  adminUpdateService: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  adminDeleteService: (id: string) => Promise<boolean>;
  adminCreateOrder: (payload: Record<string, unknown>) => Promise<boolean>;
  adminUpdateOrderStatus: (orderId: string, status: OrderStatus, note: string) => Promise<boolean>;
  adminDeleteOrder: (orderId: string) => Promise<boolean>;
  adminCreateTicket: (payload: Record<string, unknown>) => Promise<boolean>;
  adminUpdateTicket: (id: string, status: IssueStatus, adminNote: string) => Promise<boolean>;
  adminDeleteTicket: (id: string) => Promise<boolean>;
  adminProcessPayout: (id: string, status: 'selesai' | 'ditolak') => Promise<boolean>;
  adminInviteAccount: (payload: {
    username: string;
    email: string;
    fullName: string;
  }) => Promise<boolean>;
  adminDeleteInvite: (id: string) => Promise<boolean>;
  adminUpdateAccount: (
    id: string,
    payload: { username: string; fullName: string; email: string },
  ) => Promise<boolean>;
  adminDeleteAccount: (id: string) => Promise<boolean>;
  adminDeleteUser: (id: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [portalRoute, setPortalRoute] = useState<PortalRoute>(() =>
    parseRouteFromPath(window.location.pathname),
  );
  const [isDark, setIsDark] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Public state synced in real-time with Cloud Firestore
  const [publicMitras, setPublicMitras] = useState<Mitra[]>([]);
  const [publicServices, setPublicServices] = useState<PrintServiceItem[]>([]);
  const [commissionSettings, setCommissionSettings] =
    useState<CommissionSettings>(DEFAULT_SETTINGS);

  // User state
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userTickets, setUserTickets] = useState<IssueTicket[]>([]);

  // Mitra state
  const [mitraUid, setMitraUid] = useState<string | null>(null);
  const [mitraProfile, setMitraProfile] = useState<Mitra | null>(null);
  const [mitraAuthError, setMitraAuthError] = useState<string | null>(null);
  const [mitraOrders, setMitraOrders] = useState<Order[]>([]);
  const [mitraPayouts, setMitraPayouts] = useState<MitraPayout[]>([]);

  // Admin state
  const [adminUid, setAdminUid] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminAccount | null>(null);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminMitras, setAdminMitras] = useState<Mitra[]>([]);
  const [adminTickets, setAdminTickets] = useState<IssueTicket[]>([]);
  const [adminPayouts, setAdminPayouts] = useState<MitraPayout[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [adminInvites, setAdminInvites] = useState<AdminInvite[]>([]);

  const mitraServices = useMemo(() => {
    if (!mitraUid) return [];
    return publicServices.filter((s) => s.ownerUid === mitraUid);
  }, [publicServices, mitraUid]);

  const adminServices = publicServices;

  useEffect(() => {
    const onPopState = () => {
      setPortalRoute(parseRouteFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigatePortal = useCallback((route: PortalRoute) => {
    const targetPath = resolveTargetPath(route);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setPortalRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDark]);

  const toggleDark = useCallback(() => setIsDark((p) => !p), []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, title: string, message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-1), { id, type, title, message }]);
      window.setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast],
  );

  // =========================================================================
  // PUBLIC REALTIME LISTENERS (mitra_public, services, settings/platform)
  // =========================================================================
  useEffect(() => {
    if (!db) return;

    const unsubMitras = onSnapshot(
      collection(db, 'mitra_public'),
      (snap) => {
        const list = snap.docs.map((d) => mapMitraDoc(d.id, d.data()));
        setPublicMitras(sortByCreatedDesc(list));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'mitra_public'),
    );

    const unsubServices = onSnapshot(
      collection(db, 'services'),
      (snap) => {
        const list = snap.docs.map((d) => mapServiceDoc(d.id, d.data()));
        setPublicServices(sortByCreatedDesc(list));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'services'),
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'platform'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setCommissionSettings({
            platformCommissionPercent: Number(d.platformCommissionPercent ?? 10),
            minimumOrderAmount: Number(d.minimumOrderAmount ?? 2000),
            firstOrderDiscount: Number(d.firstOrderDiscount ?? 0),
            payoutMinimum: Number(d.payoutMinimum ?? 50000),
            supportHotline: String(d.supportHotline ?? 'support@printkampus.id'),
          });
        } else {
          setCommissionSettings(DEFAULT_SETTINGS);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/platform'),
    );

    return () => {
      unsubMitras();
      unsubServices();
      unsubSettings();
    };
  }, []);

  // =========================================================================
  // USER REALTIME WORKSPACE LISTENERS
  // =========================================================================
  useEffect(() => {
    if (!db || !userUid) {
      setUserOrders([]);
      setUserTickets([]);
      return;
    }

    const unsubProfile = onSnapshot(
      doc(db, 'users', userUid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(mapUserDoc(snap.id, snap.data()));
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${userUid}`),
    );

    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), where('userId', '==', userUid)),
      (snap) => {
        setUserOrders(sortByCreatedDesc(snap.docs.map((d) => mapOrderDoc(d.id, d.data()))));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders'),
    );

    const unsubTickets = onSnapshot(
      query(collection(db, 'tickets'), where('userId', '==', userUid)),
      (snap) => {
        setUserTickets(sortByCreatedDesc(snap.docs.map((d) => mapTicketDoc(d.id, d.data()))));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tickets'),
    );

    return () => {
      unsubProfile();
      unsubOrders();
      unsubTickets();
    };
  }, [userUid]);

  // =========================================================================
  // MITRA REALTIME WORKSPACE LISTENERS
  // =========================================================================
  const mitraIdActive = mitraProfile?.id ?? null;
  const mitraLoginEmailActive = mitraProfile?.loginEmail ?? null;

  useEffect(() => {
    if (!db || !mitraUid || !mitraIdActive || !mitraLoginEmailActive) {
      setMitraOrders([]);
      setMitraPayouts([]);
      return;
    }

    const unsubMitra = onSnapshot(
      doc(db, 'mitras', mitraIdActive),
      (snap) => {
        if (snap.exists()) {
          setMitraProfile(mapMitraDoc(snap.id, snap.data()));
        } else {
          setMitraUid(null);
          setMitraProfile(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `mitras/${mitraIdActive}`),
    );

    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), where('mitraOwnerUid', '==', mitraUid)),
      (snap) => {
        setMitraOrders(sortByCreatedDesc(snap.docs.map((d) => mapOrderDoc(d.id, d.data()))));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders'),
    );

    const unsubPayouts = onSnapshot(
      query(collection(db, 'payouts'), where('mitraLoginEmail', '==', mitraLoginEmailActive)),
      (snap) => {
        setMitraPayouts(sortByCreatedDesc(snap.docs.map((d) => mapPayoutDoc(d.id, d.data()))));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payouts'),
    );

    return () => {
      unsubMitra();
      unsubOrders();
      unsubPayouts();
    };
  }, [mitraUid, mitraIdActive, mitraLoginEmailActive]);

  // =========================================================================
  // ADMIN REALTIME WORKSPACE LISTENERS
  // =========================================================================
  useEffect(() => {
    if (!db || !adminUid) {
      setAdminOrders([]);
      setAdminMitras([]);
      setAdminTickets([]);
      setAdminPayouts([]);
      setAdminUsers([]);
      setAdminAccounts([]);
      setAdminInvites([]);
      return;
    }

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => setAdminOrders(sortByCreatedDesc(snap.docs.map((d) => mapOrderDoc(d.id, d.data())))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders'),
    );
    const unsubMitras = onSnapshot(
      collection(db, 'mitras'),
      (snap) => setAdminMitras(sortByCreatedDesc(snap.docs.map((d) => mapMitraDoc(d.id, d.data())))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'mitras'),
    );
    const unsubTickets = onSnapshot(
      collection(db, 'tickets'),
      (snap) =>
        setAdminTickets(sortByCreatedDesc(snap.docs.map((d) => mapTicketDoc(d.id, d.data())))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'tickets'),
    );
    const unsubPayouts = onSnapshot(
      collection(db, 'payouts'),
      (snap) =>
        setAdminPayouts(sortByCreatedDesc(snap.docs.map((d) => mapPayoutDoc(d.id, d.data())))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'payouts'),
    );
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => setAdminUsers(sortByCreatedDesc(snap.docs.map((d) => mapUserDoc(d.id, d.data())))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'users'),
    );
    const unsubAdmins = onSnapshot(
      collection(db, 'admins'),
      (snap) =>
        setAdminAccounts(sortByCreatedDesc(snap.docs.map((d) => mapAdminDoc(d.id, d.data())))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'admins'),
    );
    const unsubInvites = onSnapshot(
      collection(db, 'admin_invites'),
      (snap) =>
        setAdminInvites(
          sortByCreatedDesc(snap.docs.map((d) => mapAdminInviteDoc(d.id, d.data()))),
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'admin_invites'),
    );

    return () => {
      unsubOrders();
      unsubMitras();
      unsubTickets();
      unsubPayouts();
      unsubUsers();
      unsubAdmins();
      unsubInvites();
    };
  }, [adminUid]);

  // =========================================================================
  // USER ACTIONS (FIREBASE GOOGLE AUTH + CLOUD FIRESTORE)
  // =========================================================================
  const loginUserWithGoogle = useCallback(async () => {
    if (!auth || !db) {
      addToast(
        'error',
        'Konfigurasi Firebase Belum Tersedia',
        'Pastikan firebase-applet-config.json atau VITE_FIREBASE_* sudah dikonfigurasi.',
      );
      return false;
    }
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      if (!user.emailVerified || !user.email) {
        addToast('error', 'Email Belum Terverifikasi', 'Gunakan akun Google dengan email terverifikasi.');
        return false;
      }

      const userRef = doc(db, 'users', user.uid);
      let snap;
      try {
        snap = await getDoc(userRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

      if (!snap.exists()) {
        const newUser: Record<string, unknown> = {
          uid: user.uid,
          email: clip(user.email.toLowerCase(), 180),
          name: clip(user.displayName || user.email.split('@')[0], 120),
          nim: '',
          faculty: '',
          phone: '',
          ...(user.photoURL ? { photoUrl: clip(user.photoURL, 500) } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        try {
          await setDoc(userRef, newUser);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        }
        setUserProfile({
          id: user.uid,
          email: String(newUser.email),
          name: String(newUser.name),
          nim: '',
          faculty: '',
          phone: '',
          photoUrl: user.photoURL || undefined,
        });
      } else {
        setUserProfile(mapUserDoc(snap.id, snap.data()));
      }

      setUserUid(user.uid);
      addToast('success', 'Berhasil Masuk', `Selamat datang, ${user.displayName || user.email}.`);
      return true;
    } catch (err) {
      addToast(
        'error',
        'Login Google Gagal',
        err instanceof Error ? err.message : 'Gagal masuk dengan Google.',
      );
      return false;
    }
  }, [addToast]);

  const logoutUser = useCallback(async () => {
    try {
      if (auth) await signOut(auth);
    } catch {
      // ignore signOut failure
    }
    setUserUid(null);
    setUserProfile(null);
    setUserOrders([]);
    setUserTickets([]);
    addToast('info', 'Keluar Portal User', 'Sesi akun Google Anda telah ditutup.');
  }, [addToast]);

  const updateUserProfile = useCallback(
    async (patch: { name: string; nim: string; faculty: string; phone: string }) => {
      if (!db || !userUid) return false;
      try {
        await updateDoc(doc(db, 'users', userUid), {
          name: clip(patch.name, 120) || 'Mahasiswa',
          nim: clip(patch.nim, 40),
          faculty: clip(patch.faculty, 120),
          phone: clip(patch.phone, 40),
          updatedAt: serverTimestamp(),
        });
        addToast('success', 'Profil Disimpan', 'Data mahasiswa diperbarui di Firestore.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userUid}`);
      }
    },
    [userUid, addToast],
  );

  const createUserOrder = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!db || !userUid || !userProfile) return false;
      const mitraId = String(payload.mitraId ?? '');
      const mitra = publicMitras.find((m) => m.id === mitraId);
      if (!mitra) {
        addToast('error', 'Mitra Tidak Ditemukan', 'Pilih mitra percetakan yang valid.');
        return false;
      }

      const pageCount = Math.min(5000, Math.max(1, Number(payload.pageCount ?? 1)));
      const copies = Math.min(500, Math.max(1, Number(payload.copies ?? 1)));
      const colorType = (payload.colorType as ColorType) ?? 'bw';
      const paperSize = (payload.paperSize as PaperSize) ?? 'A4';
      const paperWeight = (payload.paperWeight as PaperWeight) ?? '70gr';
      const duplex = Boolean(payload.duplex);
      const binding = (payload.binding as BindingType) ?? 'none';
      const paymentMethod = (payload.paymentMethod as PaymentMethod) ?? 'QRIS';

      const calc = calculateOrderPricing({
        pageCount,
        copies,
        colorType,
        paperSize,
        paperWeight,
        duplex,
        binding,
        pricing: mitra.pricing,
        platformCommissionPercent: commissionSettings.platformCommissionPercent,
      });

      const now = new Date();
      const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const orderId = makeDocId('ord');
      const orderNumber = `PK-${ym}-${Math.floor(1000 + Math.random() * 9000)}`;

      const orderDoc = {
        id: orderId,
        orderNumber,
        userId: userUid,
        studentName: clip(userProfile.name || 'Mahasiswa', 120),
        studentNim: clip(userProfile.nim, 40),
        studentPhone: clip(userProfile.phone, 40),
        studentEmail: clip(userProfile.email, 180),
        mitraId: mitra.id,
        mitraOwnerUid: clip(mitra.ownerUid ?? '', 128),
        mitraName: clip(mitra.name, 140),
        mitraLocation: clip(mitra.campusArea, 160),
        documentTitle: clip(payload.documentTitle || 'Dokumen Cetak', 200),
        fileName: clip(payload.fileName || 'dokumen.pdf', 200),
        fileSize: clip(payload.fileSize || '1.0 MB', 40),
        pageCount,
        copies,
        colorType,
        paperSize,
        paperWeight,
        duplex,
        binding,
        notes: clip(payload.notes, 500),
        unitPrintPrice: calc.unitPrintPrice,
        unitBindingPrice: calc.unitBindingPrice,
        subtotal: calc.subtotal,
        platformFee: calc.platformFee,
        mitraEarnings: calc.mitraEarnings,
        totalAmount: calc.totalAmount,
        paymentMethod,
        paymentStatus: paymentMethod === 'COD' ? 'bayar_di_tempat' : 'lunas',
        status: 'menunggu_konfirmasi',
        statusHistory: [
          {
            status: 'menunggu_konfirmasi',
            timestamp: now.toISOString(),
            note: 'Pesanan cetak dikirim oleh mahasiswa.',
          },
        ],
        pickupDeadline: clip(payload.pickupDeadline || 'Hari ini, 16.00 WIB', 80),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'orders', orderId), orderDoc);
        addToast('success', 'Pesanan Dibuat', `Pesanan ${orderNumber} dikirim ke mitra.`);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `orders/${orderId}`);
      }
    },
    [userUid, userProfile, publicMitras, commissionSettings.platformCommissionPercent, addToast],
  );

  const updateUserOrder = useCallback(
    async (orderId: string, payload: Record<string, unknown>) => {
      if (!db || !userUid) return false;
      const existing = userOrders.find((o) => o.id === orderId);
      if (!existing) return false;

      const mitra = publicMitras.find((m) => m.id === existing.mitraId);
      if (!mitra) return false;

      const pageCount = Math.min(5000, Math.max(1, Number(payload.pageCount ?? existing.pageCount)));
      const copies = Math.min(500, Math.max(1, Number(payload.copies ?? existing.copies)));
      const colorType = (payload.colorType as ColorType) ?? existing.colorType;
      const paperSize = (payload.paperSize as PaperSize) ?? existing.paperSize;
      const paperWeight = (payload.paperWeight as PaperWeight) ?? existing.paperWeight;
      const duplex = Boolean(payload.duplex ?? existing.duplex);
      const binding = (payload.binding as BindingType) ?? existing.binding;
      const paymentMethod = (payload.paymentMethod as PaymentMethod) ?? existing.paymentMethod;

      const calc = calculateOrderPricing({
        pageCount,
        copies,
        colorType,
        paperSize,
        paperWeight,
        duplex,
        binding,
        pricing: mitra.pricing,
        platformCommissionPercent: commissionSettings.platformCommissionPercent,
      });

      try {
        await updateDoc(doc(db, 'orders', orderId), {
          documentTitle: clip(payload.documentTitle ?? existing.documentTitle, 200),
          fileName: clip(payload.fileName ?? existing.fileName, 200),
          fileSize: clip(payload.fileSize ?? existing.fileSize, 40),
          pageCount,
          copies,
          colorType,
          paperSize,
          paperWeight,
          duplex,
          binding,
          notes: clip(payload.notes ?? existing.notes, 500),
          unitPrintPrice: calc.unitPrintPrice,
          unitBindingPrice: calc.unitBindingPrice,
          subtotal: calc.subtotal,
          platformFee: calc.platformFee,
          mitraEarnings: calc.mitraEarnings,
          totalAmount: calc.totalAmount,
          paymentMethod,
          paymentStatus: paymentMethod === 'COD' ? 'bayar_di_tempat' : 'lunas',
          pickupDeadline: clip(payload.pickupDeadline ?? existing.pickupDeadline, 80),
          statusHistory: [
            ...existing.statusHistory.slice(-18),
            {
              status: existing.status,
              timestamp: new Date().toISOString(),
              note: 'Spesifikasi pesanan diperbarui oleh pemesan.',
            },
          ],
          updatedAt: serverTimestamp(),
        });
        addToast('info', 'Pesanan Diperbarui', 'Spesifikasi pesanan disimpan.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    [userUid, userOrders, publicMitras, commissionSettings.platformCommissionPercent, addToast],
  );

  const cancelUserOrder = useCallback(
    async (orderId: string) => {
      if (!db || !userUid) return false;
      const existing = userOrders.find((o) => o.id === orderId);
      if (!existing) return false;

      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'dibatalkan',
          statusHistory: [
            ...existing.statusHistory.slice(-18),
            {
              status: 'dibatalkan',
              timestamp: new Date().toISOString(),
              note: 'Pesanan dibatalkan oleh pemesan.',
            },
          ],
          updatedAt: serverTimestamp(),
        });
        addToast('warning', 'Pesanan Dibatalkan', 'Pesanan telah dibatalkan.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    [userUid, userOrders, addToast],
  );

  const deleteUserOrder = useCallback(
    async (orderId: string) => {
      if (!db || !userUid) return false;
      try {
        await deleteDoc(doc(db, 'orders', orderId));
        addToast('warning', 'Pesanan Dihapus', 'Riwayat pesanan dihapus dari Firestore.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `orders/${orderId}`);
      }
    },
    [userUid, addToast],
  );

  const createUserTicket = useCallback(
    async (payload: { orderId: string; category: string; description: string }) => {
      if (!db || !userUid || !userProfile) return false;
      const order = userOrders.find((o) => o.id === payload.orderId);
      if (!order) return false;

      const ticketId = makeDocId('tkt');
      try {
        await setDoc(doc(db, 'tickets', ticketId), {
          id: ticketId,
          orderId: order.id,
          orderNumber: clip(order.orderNumber, 40),
          userId: userUid,
          reporterName: clip(userProfile.name || 'Mahasiswa', 120),
          reporterRole: 'user',
          category: payload.category || 'lainnya',
          description: clip(payload.description, 1000),
          status: 'terbuka',
          adminNote: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addToast('info', 'Kendala Dilaporkan', 'Tiket kendala dikirim ke Admin.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tickets/${ticketId}`);
      }
    },
    [userUid, userProfile, userOrders, addToast],
  );

  const updateUserTicket = useCallback(
    async (id: string, payload: { category: string; description: string }) => {
      if (!db || !userUid) return false;
      try {
        await updateDoc(doc(db, 'tickets', id), {
          category: payload.category,
          description: clip(payload.description, 1000),
          updatedAt: serverTimestamp(),
        });
        addToast('success', 'Tiket Diperbarui', 'Detail kendala diperbarui.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${id}`);
      }
    },
    [userUid, addToast],
  );

  const deleteUserTicket = useCallback(
    async (id: string) => {
      if (!db || !userUid) return false;
      try {
        await deleteDoc(doc(db, 'tickets', id));
        addToast('warning', 'Tiket Dihapus', 'Tiket kendala telah dihapus.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tickets/${id}`);
      }
    },
    [userUid, addToast],
  );

  // =========================================================================
  // MITRA ACTIONS (FIREBASE GOOGLE AUTH + CLOUD FIRESTORE)
  // =========================================================================
  const loginMitraWithGoogle = useCallback(async () => {
    if (!auth || !db) {
      addToast('error', 'Firebase Belum Siap', 'Konfigurasi Firebase belum lengkap.');
      return false;
    }
    setMitraAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      if (!user.emailVerified || !user.email) {
        setMitraAuthError('Akun Google harus memiliki email yang terverifikasi.');
        return false;
      }
      const emailLower = user.email.toLowerCase();

      let snap;
      try {
        snap = await getDocs(
          query(collection(db, 'mitras'), where('loginEmail', '==', emailLower)),
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'mitras');
      }

      if (snap.empty) {
        const msg = `Email Google "${emailLower}" belum didaftarkan sebagai Mitra oleh Admin Platform.`;
        setMitraAuthError(msg);
        addToast('error', 'Akun Mitra Tidak Ditemukan', msg);
        return false;
      }

      const mitraDoc = snap.docs[0];
      const mapped = mapMitraDoc(mitraDoc.id, mitraDoc.data());

      // Bind Firebase Auth UID to both private & public Mitra records
      if (mapped.ownerUid !== user.uid) {
        const batch = writeBatch(db);
        batch.update(doc(db, 'mitras', mapped.id), {
          ownerUid: user.uid,
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'mitra_public', mapped.id), {
          ownerUid: user.uid,
          updatedAt: serverTimestamp(),
        });
        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `mitras/${mapped.id}`);
        }
        mapped.ownerUid = user.uid;
      }

      setMitraProfile(mapped);
      setMitraUid(user.uid);
      addToast('success', 'Login Mitra Berhasil', `Selamat bertugas, ${mapped.name}.`);
      return true;
    } catch (err) {
      addToast(
        'error',
        'Login Mitra Gagal',
        err instanceof Error ? err.message : 'Gagal masuk dengan Google.',
      );
      return false;
    }
  }, [addToast]);

  const logoutMitra = useCallback(async () => {
    try {
      if (auth) await signOut(auth);
    } catch {
      // ignore
    }
    setMitraUid(null);
    setMitraProfile(null);
    setMitraOrders([]);
    setMitraPayouts([]);
    setMitraAuthError(null);
    addToast('info', 'Keluar Portal Mitra', 'Anda telah keluar dari akun Mitra.');
  }, [addToast]);

  const updateMitraProfile = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!db || !mitraUid || !mitraProfile) return false;
      const pricing = normalizePricing(payload.pricing ?? mitraProfile.pricing);
      const patch = {
        name: clip(payload.name ?? mitraProfile.name, 140) || mitraProfile.name,
        campusArea: clip(payload.campusArea ?? mitraProfile.campusArea, 120) || mitraProfile.campusArea,
        address: clip(payload.address ?? mitraProfile.address, 240) || mitraProfile.address,
        operatingHours:
          clip(payload.operatingHours ?? mitraProfile.operatingHours, 80) ||
          mitraProfile.operatingHours,
        pricing,
        updatedAt: serverTimestamp(),
      };
      const batch = writeBatch(db);
      batch.update(doc(db, 'mitras', mitraProfile.id), patch);
      batch.update(doc(db, 'mitra_public', mitraProfile.id), patch);
      try {
        await batch.commit();
        addToast('success', 'Profil & Tarif Disimpan', 'Perubahan toko tersimpan ke Firestore.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `mitras/${mitraProfile.id}`);
      }
    },
    [mitraUid, mitraProfile, addToast],
  );

  const toggleMitraSelfOpen = useCallback(async () => {
    if (!db || !mitraUid || !mitraProfile) return false;
    const nextOpen = !mitraProfile.isOpen;
    const batch = writeBatch(db);
    batch.update(doc(db, 'mitras', mitraProfile.id), {
      isOpen: nextOpen,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'mitra_public', mitraProfile.id), {
      isOpen: nextOpen,
      updatedAt: serverTimestamp(),
    });
    try {
      await batch.commit();
      addToast('info', 'Status Toko Diubah', `Toko sekarang ${nextOpen ? 'BUKA' : 'TUTUP'}.`);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `mitras/${mitraProfile.id}`);
    }
  }, [mitraUid, mitraProfile, addToast]);

  const updateMitraOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus, note: string) => {
      if (!db || !mitraUid || !mitraProfile) return false;
      const orderRef = doc(db, 'orders', orderId);
      const mitraRef = doc(db, 'mitras', mitraProfile.id);
      const mitraPublicRef = doc(db, 'mitra_public', mitraProfile.id);

      let orderSnap;
      let mitraSnap;
      try {
        [orderSnap, mitraSnap] = await Promise.all([getDoc(orderRef), getDoc(mitraRef)]);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `orders/${orderId}`);
      }

      if (!orderSnap.exists() || !mitraSnap.exists()) return false;
      const existingOrder = mapOrderDoc(orderSnap.id, orderSnap.data());
      const currentMitra = mapMitraDoc(mitraSnap.id, mitraSnap.data());

      if (existingOrder.status === status) return true;

      const wasActive =
        existingOrder.status !== 'selesai' && existingOrder.status !== 'dibatalkan';
      const leavesActive = status === 'selesai' || status === 'dibatalkan';

      let nextQueue = currentMitra.queueCount;
      if (wasActive && leavesActive) {
        nextQueue = Math.max(0, nextQueue - 1);
      }

      let nextCompleted = currentMitra.totalCompletedOrders;
      let nextEarnings = currentMitra.totalEarnings;
      let nextPending = currentMitra.pendingBalance;

      if (status === 'selesai' && existingOrder.status !== 'selesai') {
        nextCompleted += 1;
        nextEarnings += existingOrder.mitraEarnings;
        nextPending += existingOrder.mitraEarnings;
      }

      const batch = writeBatch(db);
      batch.update(orderRef, {
        mitraOwnerUid: mitraUid,
        status,
        paymentStatus:
          status === 'selesai' && existingOrder.paymentStatus === 'bayar_di_tempat'
            ? 'lunas'
            : existingOrder.paymentStatus,
        statusHistory: [
          ...existingOrder.statusHistory.slice(-18),
          { status, timestamp: new Date().toISOString(), note: clip(note, 200) },
        ],
        updatedAt: serverTimestamp(),
      });
      batch.update(mitraRef, {
        queueCount: nextQueue,
        totalCompletedOrders: nextCompleted,
        totalEarnings: nextEarnings,
        pendingBalance: nextPending,
        updatedAt: serverTimestamp(),
      });
      batch.update(mitraPublicRef, {
        queueCount: nextQueue,
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        addToast('success', 'Status Pesanan Diperbarui', note);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
      }
    },
    [mitraUid, mitraProfile, addToast],
  );

  const createMitraService = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!db || !mitraUid) return false;
      const id = makeDocId('srv');
      try {
        await setDoc(doc(db, 'services', id), {
          id,
          code: clip(payload.code, 32).toUpperCase() || 'SRV',
          category: (payload.category as ServiceCategory) ?? 'kertas',
          name: clip(payload.name, 120),
          description: clip(payload.description, 400),
          basePrice: Math.max(0, Number(payload.basePrice ?? 0)),
          unit: clip(payload.unit || 'per halaman', 40),
          isActive: true,
          createdByRole: 'mitra',
          ownerUid: mitraUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addToast('success', 'Layanan Ditambahkan', 'Item layanan disimpan ke katalog.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `services/${id}`);
      }
    },
    [mitraUid, addToast],
  );

  const updateMitraService = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      if (!db || !mitraUid) return false;
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (payload.code !== undefined) patch.code = clip(payload.code, 32).toUpperCase();
      if (payload.category !== undefined) patch.category = payload.category;
      if (payload.name !== undefined) patch.name = clip(payload.name, 120);
      if (payload.description !== undefined) patch.description = clip(payload.description, 400);
      if (payload.basePrice !== undefined) patch.basePrice = Math.max(0, Number(payload.basePrice));
      if (payload.unit !== undefined) patch.unit = clip(payload.unit, 40);
      if (payload.isActive !== undefined) patch.isActive = Boolean(payload.isActive);

      try {
        await updateDoc(doc(db, 'services', id), patch);
        addToast('info', 'Layanan Diperbarui', 'Perubahan katalog disimpan.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `services/${id}`);
      }
    },
    [mitraUid, addToast],
  );

  const deleteMitraService = useCallback(
    async (id: string) => {
      if (!db || !mitraUid) return false;
      try {
        await deleteDoc(doc(db, 'services', id));
        addToast('warning', 'Layanan Dihapus', 'Item katalog telah dihapus.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `services/${id}`);
      }
    },
    [mitraUid, addToast],
  );

  const requestMitraPayout = useCallback(
    async (amount: number, bankAccount: string) => {
      if (!db || !mitraUid || !mitraProfile) return false;
      if (!Number.isFinite(amount) || amount < commissionSettings.payoutMinimum) {
        addToast(
          'error',
          'Nominal Terlalu Kecil',
          `Minimum pencairan adalah Rp ${commissionSettings.payoutMinimum.toLocaleString('id-ID')}.`,
        );
        return false;
      }
      if (amount > mitraProfile.pendingBalance) {
        addToast('error', 'Saldo Tidak Cukup', 'Saldo siap cair Anda tidak mencukupi.');
        return false;
      }
      if (bankAccount.trim().length < 3) {
        addToast('error', 'Rekening Wajib Diisi', 'Masukkan nomor rekening / e-wallet tujuan.');
        return false;
      }

      const id = makeDocId('pay');
      try {
        await setDoc(doc(db, 'payouts', id), {
          id,
          mitraId: mitraProfile.id,
          mitraLoginEmail: mitraProfile.loginEmail,
          mitraName: clip(mitraProfile.name, 140),
          amount,
          bankAccount: clip(bankAccount, 140),
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addToast('success', 'Pencairan Diajukan', 'Menunggu persetujuan Admin Platform.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `payouts/${id}`);
      }
    },
    [mitraUid, mitraProfile, commissionSettings.payoutMinimum, addToast],
  );

  const cancelMitraPayout = useCallback(
    async (id: string) => {
      if (!db || !mitraUid) return false;
      try {
        await deleteDoc(doc(db, 'payouts', id));
        addToast('info', 'Pencairan Dibatalkan', 'Pengajuan pencairan dibatalkan.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `payouts/${id}`);
      }
    },
    [mitraUid, addToast],
  );

  // =========================================================================
  // ADMIN ACTIONS (FIREBASE GOOGLE AUTH + CLOUD FIRESTORE)
  // =========================================================================
  const loginAdminWithGoogle = useCallback(async () => {
    if (!auth || !db) {
      addToast('error', 'Firebase Belum Siap', 'Konfigurasi Firebase belum lengkap.');
      return false;
    }
    setAdminAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      if (!user.emailVerified || !user.email) {
        setAdminAuthError('Akun Google harus memiliki email terverifikasi.');
        return false;
      }
      const emailLower = user.email.toLowerCase();

      const adminRef = doc(db, 'admins', user.uid);
      let adminSnap;
      try {
        adminSnap = await getDoc(adminRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `admins/${user.uid}`);
      }

      if (adminSnap.exists()) {
        const mapped = mapAdminDoc(adminSnap.id, adminSnap.data());
        setAdminProfile(mapped);
        setAdminUid(user.uid);
        addToast('success', 'Login Admin Berhasil', `Masuk sebagai ${mapped.fullName}.`);
        return true;
      }

      // Super Admin bootstrap in Firestore
      if (emailLower === SUPER_ADMIN_EMAIL) {
        const record = {
          uid: user.uid,
          username: 'superadmin',
          email: emailLower,
          fullName: clip(user.displayName || 'Super Admin', 120),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        try {
          await setDoc(adminRef, record);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `admins/${user.uid}`);
        }
        setAdminProfile({
          id: user.uid,
          username: 'superadmin',
          email: emailLower,
          fullName: record.fullName,
          createdAt: new Date().toISOString(),
        });
        setAdminUid(user.uid);
        addToast('success', 'Login Super Admin Berhasil', `Selamat datang, ${record.fullName}.`);
        return true;
      }

      // Check pre-registered admin invite by verified email
      let inviteSnap;
      try {
        inviteSnap = await getDocs(
          query(collection(db, 'admin_invites'), where('email', '==', emailLower)),
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'admin_invites');
      }

      if (!inviteSnap.empty) {
        const inviteDoc = inviteSnap.docs[0];
        const inv = mapAdminInviteDoc(inviteDoc.id, inviteDoc.data());
        const batch = writeBatch(db);
        batch.set(adminRef, {
          uid: user.uid,
          username: clip(inv.username, 64),
          email: emailLower,
          fullName: clip(inv.fullName || user.displayName || 'Admin', 120),
          inviteId: inv.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.delete(doc(db, 'admin_invites', inv.id));
        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
        }
        setAdminProfile({
          id: user.uid,
          username: inv.username,
          email: emailLower,
          fullName: inv.fullName,
          inviteId: inv.id,
          createdAt: new Date().toISOString(),
        });
        setAdminUid(user.uid);
        addToast('success', 'Undangan Admin Diaktifkan', `Masuk sebagai ${inv.fullName}.`);
        return true;
      }

      const denied = `Email Google "${emailLower}" tidak terdaftar di database Admin / Undangan Admin.`;
      setAdminAuthError(denied);
      addToast('error', 'Akses Admin Ditolak', denied);
      return false;
    } catch (err) {
      addToast(
        'error',
        'Login Admin Gagal',
        err instanceof Error ? err.message : 'Gagal masuk dengan Google.',
      );
      return false;
    }
  }, [addToast]);

  const logoutAdmin = useCallback(async () => {
    try {
      if (auth) await signOut(auth);
    } catch {
      // ignore
    }
    setAdminUid(null);
    setAdminProfile(null);
    setAdminAuthError(null);
    addToast('info', 'Keluar Portal Admin', 'Sesi Admin telah ditutup.');
  }, [addToast]);

  const updateCommissionSettings = useCallback(
    async (settings: CommissionSettings) => {
      if (!db || !adminUid) return false;
      try {
        await setDoc(doc(db, 'settings', 'platform'), {
          platformCommissionPercent: Math.min(50, Math.max(0, Number(settings.platformCommissionPercent))),
          minimumOrderAmount: Math.max(0, Number(settings.minimumOrderAmount)),
          firstOrderDiscount: Math.max(0, Number(settings.firstOrderDiscount ?? 0)),
          payoutMinimum: Math.max(10000, Number(settings.payoutMinimum)),
          supportHotline: clip(settings.supportHotline || 'support@printkampus.id', 160),
          updatedAt: serverTimestamp(),
        });
        addToast(
          'success',
          'Komisi Disimpan',
          `Potongan komisi Mitra diatur ke ${settings.platformCommissionPercent}%.`,
        );
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'settings/platform');
      }
    },
    [adminUid, addToast],
  );

  const adminCreateMitra = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!db || !adminUid) return false;
      const loginEmail = clip(payload.loginEmail, 180).toLowerCase();
      if (!loginEmail.includes('@')) {
        addToast('error', 'Email Tidak Valid', 'Masukkan email Google Mitra yang valid.');
        return false;
      }
      const id = makeDocId('mtr');
      const pricing: MitraPricing = {
        bwPerPage: Math.max(50, Number(payload.bwPerPage ?? 250)),
        colorPerPage: Math.max(100, Number(payload.colorPerPage ?? 1000)),
        duplexDiscountPerPage: Math.max(0, Number(payload.duplexDiscountPerPage ?? 40)),
        bindings: {
          none: 0,
          staples: 1000,
          lakban: Math.max(0, Number(payload.lakbanPrice ?? 3500)),
          spiral_plastik: 7000,
          spiral_kawat: Math.max(0, Number(payload.spiralKawatPrice ?? 12000)),
          hardcover: Math.max(0, Number(payload.hardcoverPrice ?? 35000)),
        },
      };

      const sharedFields = {
        id,
        ownerUid: '',
        name: clip(payload.name, 140),
        campusArea: clip(payload.campusArea, 120),
        address: clip(payload.address || payload.campusArea, 240),
        operatingHours: clip(payload.operatingHours || '08.00 - 21.00 WIB', 80),
        isOpen: true,
        rating: 5.0,
        queueCount: 0,
        servicesOffered: [...DEFAULT_MITRA_SERVICES],
        pricing,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'mitras', id), {
        ...sharedFields,
        loginEmail,
        totalCompletedOrders: 0,
        totalEarnings: 0,
        pendingBalance: 0,
      });
      batch.set(doc(db, 'mitra_public', id), sharedFields);

      try {
        await batch.commit();
        addToast('success', 'Mitra Didaftarkan', `Mitra ${sharedFields.name} tersimpan ke Firestore.`);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `mitras/${id}`);
      }
    },
    [adminUid, addToast],
  );

  const adminUpdateMitra = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      if (!db || !adminUid) return false;
      const existing = adminMitras.find((m) => m.id === id);
      if (!existing) return false;

      const updatedPricing: MitraPricing = {
        ...existing.pricing,
        bwPerPage: Math.max(50, Number(payload.bwPerPage ?? existing.pricing.bwPerPage)),
        colorPerPage: Math.max(100, Number(payload.colorPerPage ?? existing.pricing.colorPerPage)),
      };
      const sharedPatch = {
        name: clip(payload.name ?? existing.name, 140),
        campusArea: clip(payload.campusArea ?? existing.campusArea, 120),
        pricing: updatedPricing,
        updatedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.update(doc(db, 'mitras', id), {
        ...sharedPatch,
        loginEmail: clip(payload.loginEmail ?? existing.loginEmail, 180).toLowerCase(),
      });
      batch.update(doc(db, 'mitra_public', id), sharedPatch);

      try {
        await batch.commit();
        addToast('success', 'Mitra Diperbarui', 'Data mitra diperbarui di Firestore.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `mitras/${id}`);
      }
    },
    [adminUid, adminMitras, addToast],
  );

  const adminToggleMitraOpen = useCallback(
    async (id: string) => {
      if (!db || !adminUid) return false;
      const existing = adminMitras.find((m) => m.id === id);
      if (!existing) return false;
      const nextOpen = !existing.isOpen;
      const batch = writeBatch(db);
      batch.update(doc(db, 'mitras', id), { isOpen: nextOpen, updatedAt: serverTimestamp() });
      batch.update(doc(db, 'mitra_public', id), {
        isOpen: nextOpen,
        updatedAt: serverTimestamp(),
      });
      try {
        await batch.commit();
        addToast('info', 'Status Mitra Diubah', `${existing.name} sekarang ${nextOpen ? 'BUKA' : 'TUTUP'}.`);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `mitras/${id}`);
      }
    },
    [adminUid, adminMitras, addToast],
  );

  const adminDeleteMitra = useCallback(
    async (id: string) => {
      if (!db || !adminUid) return false;
      const batch = writeBatch(db);
      batch.delete(doc(db, 'mitras', id));
      batch.delete(doc(db, 'mitra_public', id));
      try {
        await batch.commit();
        addToast('warning', 'Mitra Dihapus', 'Data & akses mitra dihapus dari Firestore.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `mitras/${id}`);
      }
    },
    [adminUid, addToast],
  );

  const adminCreateService = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!db || !adminUid) return false;
      const id = makeDocId('srv');
      try {
        await setDoc(doc(db, 'services', id), {
          id,
          code: clip(payload.code, 32).toUpperCase() || 'SRV',
          category: (payload.category as ServiceCategory) ?? 'kertas',
          name: clip(payload.name, 120),
          description: clip(payload.description, 400),
          basePrice: Math.max(0, Number(payload.basePrice ?? 0)),
          unit: clip(payload.unit || 'per halaman', 40),
          isActive: true,
          createdByRole: 'admin',
          ownerUid: adminUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addToast('success', 'Layanan Ditambahkan', 'Item katalog disimpan ke Firestore.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `services/${id}`);
      }
    },
    [adminUid, addToast],
  );

  const adminUpdateService = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      if (!db || !adminUid) return false;
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (payload.code !== undefined) patch.code = clip(payload.code, 32).toUpperCase();
      if (payload.category !== undefined) patch.category = payload.category;
      if (payload.name !== undefined) patch.name = clip(payload.name, 120);
      if (payload.description !== undefined) patch.description = clip(payload.description, 400);
      if (payload.basePrice !== undefined) patch.basePrice = Math.max(0, Number(payload.basePrice));
      if (payload.unit !== undefined) patch.unit = clip(payload.unit, 40);
      if (payload.isActive !== undefined) patch.isActive = Boolean(payload.isActive);

      try {
        await updateDoc(doc(db, 'services', id), patch);
        addToast('info', 'Katalog Diperbarui', 'Perubahan layanan disimpan.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `services/${id}`);
      }
    },
    [adminUid, addToast],
  );

  const adminDeleteService = useCallback(
    async (id: string) => {
      if (!db || !adminUid) return false;
      try {
        await deleteDoc(doc(db, 'services', id));
        addToast('warning', 'Layanan Dihapus', 'Item tarif dihapus dari Firestore.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `services/${id}`);
      }
    },
    [adminUid, addToast],
  );

  const adminCreateOrder = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!db || !adminUid) return false;
      const mitra = adminMitras.find((m) => m.id === String(payload.mitraId ?? ''));
      if (!mitra) return false;

      const pageCount = Math.min(5000, Math.max(1, Number(payload.pageCount ?? 10)));
      const copies = Math.min(500, Math.max(1, Number(payload.copies ?? 1)));
      const calc = calculateOrderPricing({
        pageCount,
        copies,
        colorType: 'bw',
        paperSize: 'A4',
        paperWeight: '70gr',
        duplex: false,
        binding: 'none',
        pricing: mitra.pricing,
        platformCommissionPercent: commissionSettings.platformCommissionPercent,
      });

      const now = new Date();
      const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const id = makeDocId('ord');
      const orderNumber = `PK-${ym}-${Math.floor(1000 + Math.random() * 9000)}`;

      const batch = writeBatch(db);
      batch.set(doc(db, 'orders', id), {
        id,
        orderNumber,
        userId: adminUid,
        studentName: clip(payload.studentName || 'Mahasiswa Walk-In', 120),
        studentNim: '',
        studentPhone: '',
        mitraId: mitra.id,
        mitraOwnerUid: clip(mitra.ownerUid ?? '', 128),
        mitraName: clip(mitra.name, 140),
        mitraLocation: clip(mitra.campusArea, 160),
        documentTitle: clip(payload.documentTitle || 'Pesanan Manual', 200),
        fileName: 'manual_input.pdf',
        fileSize: '1.0 MB',
        pageCount,
        copies,
        colorType: 'bw',
        paperSize: 'A4',
        paperWeight: '70gr',
        duplex: false,
        binding: 'none',
        notes: 'Dicatat manual oleh Admin Platform.',
        unitPrintPrice: calc.unitPrintPrice,
        unitBindingPrice: calc.unitBindingPrice,
        subtotal: calc.subtotal,
        platformFee: calc.platformFee,
        mitraEarnings: calc.mitraEarnings,
        totalAmount: calc.totalAmount,
        paymentMethod: 'COD',
        paymentStatus: 'bayar_di_tempat',
        status: 'menunggu_konfirmasi',
        statusHistory: [
          {
            status: 'menunggu_konfirmasi',
            timestamp: now.toISOString(),
            note: 'Pesanan dicatat manual oleh Admin.',
          },
        ],
        pickupDeadline: 'Hari ini, 16.00 WIB',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'mitras', mitra.id), {
        queueCount: mitra.queueCount + 1,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'mitra_public', mitra.id), {
        queueCount: mitra.queueCount + 1,
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        addToast('success', 'Pesanan Dicatat', `Pesanan ${orderNumber} disimpan ke Firestore.`);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `orders/${id}`);
      }
    },
    [adminUid, adminMitras, commissionSettings.platformCommissionPercent, addToast],
  );

  const adminUpdateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus, note: string) => {
      if (!db || !adminUid) return false;
      const existing = adminOrders.find((o) => o.id === orderId);
      const mitra = adminMitras.find((m) => m.id === existing?.mitraId);
      if (!existing) return false;
      if (existing.status === status) return true;

      const wasActive = existing.status !== 'selesai' && existing.status !== 'dibatalkan';
      const leavesActive = status === 'selesai' || status === 'dibatalkan';

      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', orderId), {
        status,
        paymentStatus:
          status === 'selesai' && existing.paymentStatus === 'bayar_di_tempat'
            ? 'lunas'
            : existing.paymentStatus,
        statusHistory: [
          ...existing.statusHistory.slice(-18),
          { status, timestamp: new Date().toISOString(), note: clip(note, 200) },
        ],
        updatedAt: serverTimestamp(),
      });

      if (mitra) {
        let queueCount = mitra.queueCount;
        if (wasActive && leavesActive) queueCount = Math.max(0, queueCount - 1);
        let totalCompletedOrders = mitra.totalCompletedOrders;
        let totalEarnings = mitra.totalEarnings;
        let pendingBalance = mitra.pendingBalance;
        if (status === 'selesai' && existing.status !== 'selesai') {
          totalCompletedOrders += 1;
          totalEarnings += existing.mitraEarnings;
          pendingBalance += existing.mitraEarnings;
        }
        batch.update(doc(db, 'mitras', mitra.id), {
          queueCount,
          totalCompletedOrders,
          totalEarnings,
          pendingBalance,
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'mitra_public', mitra.id), {
          queueCount,
          updatedAt: serverTimestamp(),
        });
      }

      try {
        await batch.commit();
        addToast('info', 'Status Order Diperbarui', note);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
      }
    },
    [adminUid, adminOrders, adminMitras, addToast],
  );

  const adminDeleteOrder = useCallback(
    async (orderId: string) => {
      if (!db || !adminUid) return false;
      try {
        await deleteDoc(doc(db, 'orders', orderId));
        addToast('warning', 'Order Dihapus', 'Data transaksi dihapus dari Firestore.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `orders/${orderId}`);
      }
    },
    [adminUid, addToast],
  );

  const adminCreateTicket = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!db || !adminUid || !adminProfile) return false;
      const id = makeDocId('tkt');
      try {
        await setDoc(doc(db, 'tickets', id), {
          id,
          orderId: 'MANUAL',
          orderNumber: clip(payload.orderNumber || 'MANUAL', 40),
          userId: adminUid,
          reporterName: clip(adminProfile.fullName, 120),
          reporterRole: 'admin',
          category: 'lainnya',
          description: clip(payload.description, 1000),
          status: 'terbuka',
          adminNote: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addToast('success', 'Tiket Dibuat', 'Tiket kendala disimpan ke Firestore.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tickets/${id}`);
      }
    },
    [adminUid, adminProfile, addToast],
  );

  const adminUpdateTicket = useCallback(
    async (id: string, status: IssueStatus, adminNote: string) => {
      if (!db || !adminUid) return false;
      try {
        await updateDoc(doc(db, 'tickets', id), {
          status,
          adminNote: clip(adminNote, 500),
          updatedAt: serverTimestamp(),
        });
        addToast('success', 'Tiket Diperbarui', `Status tiket diubah ke ${status}.`);
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tickets/${id}`);
      }
    },
    [adminUid, addToast],
  );

  const adminDeleteTicket = useCallback(
    async (id: string) => {
      if (!db || !adminUid) return false;
      try {
        await deleteDoc(doc(db, 'tickets', id));
        addToast('warning', 'Tiket Dihapus', 'Tiket kendala dihapus.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tickets/${id}`);
      }
    },
    [adminUid, addToast],
  );

  const adminProcessPayout = useCallback(
    async (id: string, status: 'selesai' | 'ditolak') => {
      if (!db || !adminUid) return false;
      const payout = adminPayouts.find((p) => p.id === id);
      if (!payout || payout.status !== 'pending') return false;

      const batch = writeBatch(db);
      batch.update(doc(db, 'payouts', id), {
        status,
        updatedAt: serverTimestamp(),
      });

      if (status === 'selesai') {
        const mitraSnap = await getDoc(doc(db, 'mitras', payout.mitraId)).catch((err) =>
          handleFirestoreError(err, OperationType.GET, `mitras/${payout.mitraId}`),
        );
        if (mitraSnap.exists()) {
          const currentBalance = Number(mitraSnap.data().pendingBalance ?? 0);
          batch.update(doc(db, 'mitras', payout.mitraId), {
            pendingBalance: Math.max(0, currentBalance - payout.amount),
            updatedAt: serverTimestamp(),
          });
        }
      }

      try {
        await batch.commit();
        addToast(
          status === 'selesai' ? 'success' : 'warning',
          'Pencairan Diproses',
          status === 'selesai'
            ? 'Pencairan saldo mitra disetujui.'
            : 'Pengajuan pencairan ditolak.',
        );
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `payouts/${id}`);
      }
    },
    [adminUid, adminPayouts, addToast],
  );

  const adminInviteAccount = useCallback(
    async (payload: { username: string; email: string; fullName: string }) => {
      if (!db || !adminUid) return false;
      const id = makeDocId('inv');
      try {
        await setDoc(doc(db, 'admin_invites', id), {
          id,
          email: clip(payload.email, 180).toLowerCase(),
          username: clip(payload.username, 64),
          fullName: clip(payload.fullName, 120),
          invitedByUid: adminUid,
          createdAt: serverTimestamp(),
        });
        addToast(
          'success',
          'Undangan Admin Dibuat',
          `${payload.email} sekarang dapat masuk ke Portal Admin via Google.`,
        );
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `admin_invites/${id}`);
      }
    },
    [adminUid, addToast],
  );

  const adminDeleteInvite = useCallback(
    async (id: string) => {
      if (!db || !adminUid) return false;
      try {
        await deleteDoc(doc(db, 'admin_invites', id));
        addToast('warning', 'Undangan Dihapus', 'Undangan admin dibatalkan.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `admin_invites/${id}`);
      }
    },
    [adminUid, addToast],
  );

  const adminUpdateAccount = useCallback(
    async (id: string, payload: { username: string; fullName: string; email: string }) => {
      if (!db || !adminUid) return false;
      try {
        await updateDoc(doc(db, 'admins', id), {
          username: clip(payload.username, 64),
          fullName: clip(payload.fullName, 120),
          email: clip(payload.email, 180).toLowerCase(),
          updatedAt: serverTimestamp(),
        });
        addToast('success', 'Admin Diperbarui', 'Data admin diperbarui di Firestore.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `admins/${id}`);
      }
    },
    [adminUid, addToast],
  );

  const adminDeleteAccount = useCallback(
    async (id: string) => {
      if (!db || !adminUid) return false;
      try {
        await deleteDoc(doc(db, 'admins', id));
        addToast('warning', 'Admin Dihapus', 'Hak akses admin dihapus dari Firestore.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `admins/${id}`);
      }
    },
    [adminUid, addToast],
  );

  const adminDeleteUser = useCallback(
    async (id: string) => {
      if (!db || !adminUid) return false;
      try {
        await deleteDoc(doc(db, 'users', id));
        addToast('warning', 'Pengguna Dihapus', 'Profil pengguna Google dihapus.');
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
      }
    },
    [adminUid, addToast],
  );

  return (
    <AppContext.Provider
      value={{
        portalRoute,
        navigatePortal,
        isDark,
        toggleDark,
        toasts,
        addToast,
        dismissToast,
        publicMitras,
        publicServices,
        commissionSettings,
        userUid,
        userProfile,
        userOrders,
        userTickets,
        loginUserWithGoogle,
        logoutUser,
        updateUserProfile,
        createUserOrder,
        updateUserOrder,
        cancelUserOrder,
        deleteUserOrder,
        createUserTicket,
        updateUserTicket,
        deleteUserTicket,
        mitraUid,
        mitraProfile,
        mitraAuthError,
        mitraOrders,
        mitraServices,
        mitraPayouts,
        loginMitraWithGoogle,
        logoutMitra,
        updateMitraProfile,
        toggleMitraSelfOpen,
        updateMitraOrderStatus,
        createMitraService,
        updateMitraService,
        deleteMitraService,
        requestMitraPayout,
        cancelMitraPayout,
        adminUid,
        adminProfile,
        adminAuthError,
        adminOrders,
        adminMitras,
        adminServices,
        adminTickets,
        adminPayouts,
        adminUsers,
        adminAccounts,
        adminInvites,
        loginAdminWithGoogle,
        logoutAdmin,
        updateCommissionSettings,
        adminCreateMitra,
        adminUpdateMitra,
        adminToggleMitraOpen,
        adminDeleteMitra,
        adminCreateService,
        adminUpdateService,
        adminDeleteService,
        adminCreateOrder,
        adminUpdateOrderStatus,
        adminDeleteOrder,
        adminCreateTicket,
        adminUpdateTicket,
        adminDeleteTicket,
        adminProcessPayout,
        adminInviteAccount,
        adminDeleteInvite,
        adminUpdateAccount,
        adminDeleteAccount,
        adminDeleteUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
