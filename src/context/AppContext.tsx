import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import type {
  AdminAccount,
  CommissionSettings,
  IssueStatus,
  IssueTicket,
  Mitra,
  MitraPayout,
  Order,
  OrderStatus,
  PortalRoute,
  PrintServiceItem,
  ToastMessage,
  ToastType,
  UserProfile,
} from '../types/printkampus';
import { apiRequest } from '../utils/api';

const DEFAULT_SETTINGS: CommissionSettings = {
  platformCommissionPercent: 10,
  minimumOrderAmount: 2000,
  firstOrderDiscount: 0,
  payoutMinimum: 50000,
  supportHotline: 'support@printkampus.id',
};

function parseRouteFromPath(pathname: string): PortalRoute {
  const clean = pathname.toLowerCase();
  if (clean.startsWith('/user')) return 'user';
  if (clean.startsWith('/mitra')) return 'mitra';
  if (clean.startsWith('/admin')) return 'admin';
  return 'home';
}

interface AppContextValue {
  portalRoute: PortalRoute;
  navigatePortal: (route: PortalRoute) => void;
  isDark: boolean;
  toggleDark: () => void;
  toasts: ToastMessage[];
  addToast: (type: ToastType, title: string, message: string) => void;
  dismissToast: (id: string) => void;

  // Public directory (from DB, initially empty)
  publicMitras: Mitra[];
  publicServices: PrintServiceItem[];
  commissionSettings: CommissionSettings;
  refreshPublicBootstrap: () => Promise<void>;

  // User (Mahasiswa) Google Auth + Workspace
  userToken: string | null;
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

  // Mitra Percetakan Auth + Workspace
  mitraToken: string | null;
  mitraProfile: Mitra | null;
  mitraOrders: Order[];
  mitraServices: PrintServiceItem[];
  mitraPayouts: MitraPayout[];
  loginMitra: (loginEmail: string, password: string) => Promise<boolean>;
  logoutMitra: () => void;
  updateMitraProfile: (payload: Record<string, unknown>) => Promise<boolean>;
  toggleMitraSelfOpen: () => Promise<boolean>;
  updateMitraOrderStatus: (orderId: string, status: OrderStatus, note: string) => Promise<boolean>;
  createMitraService: (payload: Record<string, unknown>) => Promise<boolean>;
  updateMitraService: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  deleteMitraService: (id: string) => Promise<boolean>;
  requestMitraPayout: (amount: number, bankAccount: string) => Promise<boolean>;
  cancelMitraPayout: (id: string) => Promise<boolean>;

  // Admin Platform Auth + Workspace
  hasAdminInDb: boolean | null;
  adminToken: string | null;
  adminProfile: AdminAccount | null;
  adminOrders: Order[];
  adminMitras: Mitra[];
  adminServices: PrintServiceItem[];
  adminTickets: IssueTicket[];
  adminPayouts: MitraPayout[];
  adminUsers: UserProfile[];
  adminAccounts: AdminAccount[];
  checkAdminStatus: () => Promise<void>;
  setupFirstAdmin: (payload: {
    username: string;
    email: string;
    fullName: string;
    password: string;
  }) => Promise<boolean>;
  loginAdmin: (identifier: string, password: string) => Promise<boolean>;
  logoutAdmin: () => void;
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
  adminCreateAccount: (payload: {
    username: string;
    email: string;
    fullName: string;
    password: string;
  }) => Promise<boolean>;
  adminUpdateAccount: (
    id: string,
    payload: { fullName: string; email: string; password?: string },
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

  // Public state
  const [publicMitras, setPublicMitras] = useState<Mitra[]>([]);
  const [publicServices, setPublicServices] = useState<PrintServiceItem[]>([]);
  const [commissionSettings, setCommissionSettings] =
    useState<CommissionSettings>(DEFAULT_SETTINGS);

  // User state (token kept strictly in JS memory)
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userTickets, setUserTickets] = useState<IssueTicket[]>([]);

  // Mitra state
  const [mitraToken, setMitraToken] = useState<string | null>(null);
  const [mitraProfile, setMitraProfile] = useState<Mitra | null>(null);
  const [mitraOrders, setMitraOrders] = useState<Order[]>([]);
  const [mitraServices, setMitraServices] = useState<PrintServiceItem[]>([]);
  const [mitraPayouts, setMitraPayouts] = useState<MitraPayout[]>([]);

  // Admin state
  const [hasAdminInDb, setHasAdminInDb] = useState<boolean | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminAccount | null>(null);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminMitras, setAdminMitras] = useState<Mitra[]>([]);
  const [adminServices, setAdminServices] = useState<PrintServiceItem[]>([]);
  const [adminTickets, setAdminTickets] = useState<IssueTicket[]>([]);
  const [adminPayouts, setAdminPayouts] = useState<MitraPayout[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);

  useEffect(() => {
    const onPopState = () => {
      setPortalRoute(parseRouteFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigatePortal = useCallback((route: PortalRoute) => {
    const targetPath = route === 'home' ? '/' : `/${route}`;
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

  const refreshPublicBootstrap = useCallback(async () => {
    try {
      const data = await apiRequest<{
        mitras: Mitra[];
        services: PrintServiceItem[];
        settings: CommissionSettings;
      }>('/api/public/bootstrap');
      setPublicMitras(data.mitras);
      setPublicServices(data.services);
      setCommissionSettings(data.settings);
    } catch {
      // ignore boot fetch failure
    }
  }, []);

  const checkAdminStatus = useCallback(async () => {
    try {
      const res = await apiRequest<{ hasAdmin: boolean }>('/api/auth/admin/status');
      setHasAdminInDb(res.hasAdmin);
    } catch {
      setHasAdminInDb(true);
    }
  }, []);

  useEffect(() => {
    void refreshPublicBootstrap();
    void checkAdminStatus();
  }, [portalRoute, refreshPublicBootstrap, checkAdminStatus]);

  // Helper workspace loaders
  const loadUserWorkspace = useCallback(async (token: string) => {
    const data = await apiRequest<{
      user: UserProfile;
      orders: Order[];
      tickets: IssueTicket[];
    }>('/api/user/workspace', { token });
    setUserProfile(data.user);
    setUserOrders(data.orders);
    setUserTickets(data.tickets);
  }, []);

  const loadMitraWorkspace = useCallback(async (token: string) => {
    const data = await apiRequest<{
      mitra: Mitra;
      orders: Order[];
      services: PrintServiceItem[];
      payouts: MitraPayout[];
      settings: CommissionSettings;
    }>('/api/mitra/workspace', { token });
    setMitraProfile(data.mitra);
    setMitraOrders(data.orders);
    setMitraServices(data.services);
    setMitraPayouts(data.payouts);
    setCommissionSettings(data.settings);
  }, []);

  const loadAdminWorkspace = useCallback(async (token: string) => {
    const data = await apiRequest<{
      orders: Order[];
      mitras: Mitra[];
      services: PrintServiceItem[];
      tickets: IssueTicket[];
      payouts: MitraPayout[];
      users: UserProfile[];
      admins: AdminAccount[];
      settings: CommissionSettings;
    }>('/api/admin/workspace', { token });
    setAdminOrders(data.orders);
    setAdminMitras(data.mitras);
    setAdminServices(data.services);
    setAdminTickets(data.tickets);
    setAdminPayouts(data.payouts);
    setAdminUsers(data.users);
    setAdminAccounts(data.admins);
    setCommissionSettings(data.settings);
  }, []);

  // =========================================================================
  // USER ACTIONS (GOOGLE LOGIN + CRUD)
  // =========================================================================
  const loginUserWithGoogle = useCallback(async () => {
    if (!auth) {
      addToast(
        'error',
        'Konfigurasi Firebase Belum Tersedia',
        'Lengkapi firebase-applet-config.json atau variabel VITE_FIREBASE_* terlebih dahulu.',
      );
      return false;
    }
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const idToken = await cred.user.getIdToken();
      const res = await apiRequest<{ token: string; user: UserProfile }>(
        '/api/auth/user/google',
        { method: 'POST', body: { idToken } },
      );
      setUserToken(res.token);
      setUserProfile(res.user);
      await loadUserWorkspace(res.token);
      addToast('success', 'Berhasil Masuk', `Selamat datang, ${res.user.name}.`);
      return true;
    } catch (err) {
      addToast(
        'error',
        'Login Google Gagal',
        err instanceof Error ? err.message : 'Gagal masuk dengan Google.',
      );
      return false;
    }
  }, [addToast, loadUserWorkspace]);

  const logoutUser = useCallback(async () => {
    try {
      if (auth) await signOut(auth);
    } catch {
      // ignore firebase signout error
    }
    setUserToken(null);
    setUserProfile(null);
    setUserOrders([]);
    setUserTickets([]);
    addToast('info', 'Keluar Portal User', 'Sesi akun Google Anda telah ditutup.');
  }, [addToast]);

  const updateUserProfile = useCallback(
    async (patch: { name: string; nim: string; faculty: string; phone: string }) => {
      if (!userToken) return false;
      try {
        const res = await apiRequest<{ user: UserProfile }>('/api/user/profile', {
          method: 'PUT',
          token: userToken,
          body: patch,
        });
        setUserProfile(res.user);
        addToast('success', 'Profil Disimpan', 'Data mahasiswa diperbarui di database.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Gagal menyimpan profil.');
        return false;
      }
    },
    [userToken, addToast],
  );

  const createUserOrder = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!userToken) return false;
      try {
        await apiRequest<{ order: Order }>('/api/user/orders', {
          method: 'POST',
          token: userToken,
          body: payload,
        });
        await Promise.all([loadUserWorkspace(userToken), refreshPublicBootstrap()]);
        addToast('success', 'Pesanan Dibuat', 'Pesanan cetak dikirim ke mitra.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal Membuat Pesanan', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [userToken, loadUserWorkspace, refreshPublicBootstrap, addToast],
  );

  const updateUserOrder = useCallback(
    async (orderId: string, payload: Record<string, unknown>) => {
      if (!userToken) return false;
      try {
        await apiRequest<{ order: Order }>(`/api/user/orders/${orderId}`, {
          method: 'PUT',
          token: userToken,
          body: payload,
        });
        await loadUserWorkspace(userToken);
        addToast('info', 'Pesanan Diperbarui', 'Spesifikasi pesanan disimpan.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal Memperbarui', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [userToken, loadUserWorkspace, addToast],
  );

  const cancelUserOrder = useCallback(
    async (orderId: string) => {
      if (!userToken) return false;
      try {
        await apiRequest(`/api/user/orders/${orderId}/cancel`, {
          method: 'PATCH',
          token: userToken,
        });
        await Promise.all([loadUserWorkspace(userToken), refreshPublicBootstrap()]);
        addToast('warning', 'Pesanan Dibatalkan', 'Pesanan telah dibatalkan.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal Membatalkan', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [userToken, loadUserWorkspace, refreshPublicBootstrap, addToast],
  );

  const deleteUserOrder = useCallback(
    async (orderId: string) => {
      if (!userToken) return false;
      try {
        await apiRequest(`/api/user/orders/${orderId}`, {
          method: 'DELETE',
          token: userToken,
        });
        await Promise.all([loadUserWorkspace(userToken), refreshPublicBootstrap()]);
        addToast('warning', 'Pesanan Dihapus', 'Riwayat pesanan dihapus.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal Menghapus', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [userToken, loadUserWorkspace, refreshPublicBootstrap, addToast],
  );

  const createUserTicket = useCallback(
    async (payload: { orderId: string; category: string; description: string }) => {
      if (!userToken) return false;
      try {
        await apiRequest('/api/user/tickets', {
          method: 'POST',
          token: userToken,
          body: payload,
        });
        await loadUserWorkspace(userToken);
        addToast('info', 'Kendala Dilaporkan', 'Tiket kendala dikirim ke Admin.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal Melapor', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [userToken, loadUserWorkspace, addToast],
  );

  const updateUserTicket = useCallback(
    async (id: string, payload: { category: string; description: string }) => {
      if (!userToken) return false;
      try {
        await apiRequest(`/api/user/tickets/${id}`, {
          method: 'PUT',
          token: userToken,
          body: payload,
        });
        await loadUserWorkspace(userToken);
        addToast('success', 'Tiket Diperbarui', 'Detail kendala diperbarui.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [userToken, loadUserWorkspace, addToast],
  );

  const deleteUserTicket = useCallback(
    async (id: string) => {
      if (!userToken) return false;
      try {
        await apiRequest(`/api/user/tickets/${id}`, {
          method: 'DELETE',
          token: userToken,
        });
        await loadUserWorkspace(userToken);
        addToast('warning', 'Tiket Dihapus', 'Tiket kendala telah dihapus.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [userToken, loadUserWorkspace, addToast],
  );

  // =========================================================================
  // MITRA ACTIONS
  // =========================================================================
  const loginMitra = useCallback(
    async (loginEmail: string, password: string) => {
      try {
        const res = await apiRequest<{ token: string; mitra: Mitra }>(
          '/api/auth/mitra/login',
          { method: 'POST', body: { loginEmail, password } },
        );
        setMitraToken(res.token);
        setMitraProfile(res.mitra);
        await loadMitraWorkspace(res.token);
        addToast('success', 'Login Mitra Berhasil', `Selamat bertugas, ${res.mitra.name}.`);
        return true;
      } catch (err) {
        addToast('error', 'Login Mitra Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [addToast, loadMitraWorkspace],
  );

  const logoutMitra = useCallback(() => {
    setMitraToken(null);
    setMitraProfile(null);
    setMitraOrders([]);
    setMitraServices([]);
    setMitraPayouts([]);
    addToast('info', 'Keluar Portal Mitra', 'Anda telah keluar dari akun Mitra.');
  }, [addToast]);

  const updateMitraProfile = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!mitraToken) return false;
      try {
        await apiRequest('/api/mitra/profile', {
          method: 'PUT',
          token: mitraToken,
          body: payload,
        });
        await Promise.all([loadMitraWorkspace(mitraToken), refreshPublicBootstrap()]);
        addToast('success', 'Profil & Tarif Disimpan', 'Perubahan toko tersimpan ke database.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal Menyimpan', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [mitraToken, loadMitraWorkspace, refreshPublicBootstrap, addToast],
  );

  const toggleMitraSelfOpen = useCallback(async () => {
    if (!mitraToken) return false;
    try {
      const res = await apiRequest<{ mitra: Mitra }>('/api/mitra/toggle', {
        method: 'PATCH',
        token: mitraToken,
      });
      setMitraProfile(res.mitra);
      await refreshPublicBootstrap();
      addToast(
        'info',
        'Status Toko Diubah',
        `Toko sekarang berstatus ${res.mitra.isOpen ? 'BUKA' : 'TUTUP'}.`,
      );
      return true;
    } catch (err) {
      addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
      return false;
    }
  }, [mitraToken, refreshPublicBootstrap, addToast]);

  const updateMitraOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus, note: string) => {
      if (!mitraToken) return false;
      try {
        await apiRequest(`/api/mitra/orders/${orderId}/status`, {
          method: 'PATCH',
          token: mitraToken,
          body: { status, note },
        });
        await Promise.all([loadMitraWorkspace(mitraToken), refreshPublicBootstrap()]);
        addToast('success', 'Status Pesanan Diperbarui', note);
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [mitraToken, loadMitraWorkspace, refreshPublicBootstrap, addToast],
  );

  const createMitraService = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!mitraToken) return false;
      try {
        await apiRequest('/api/mitra/services', {
          method: 'POST',
          token: mitraToken,
          body: payload,
        });
        await Promise.all([loadMitraWorkspace(mitraToken), refreshPublicBootstrap()]);
        addToast('success', 'Layanan Ditambahkan', 'Item layanan disimpan ke katalog.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [mitraToken, loadMitraWorkspace, refreshPublicBootstrap, addToast],
  );

  const updateMitraService = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      if (!mitraToken) return false;
      try {
        await apiRequest(`/api/mitra/services/${id}`, {
          method: 'PUT',
          token: mitraToken,
          body: payload,
        });
        await Promise.all([loadMitraWorkspace(mitraToken), refreshPublicBootstrap()]);
        addToast('info', 'Layanan Diperbarui', 'Perubahan katalog disimpan.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [mitraToken, loadMitraWorkspace, refreshPublicBootstrap, addToast],
  );

  const deleteMitraService = useCallback(
    async (id: string) => {
      if (!mitraToken) return false;
      try {
        await apiRequest(`/api/mitra/services/${id}`, {
          method: 'DELETE',
          token: mitraToken,
        });
        await Promise.all([loadMitraWorkspace(mitraToken), refreshPublicBootstrap()]);
        addToast('warning', 'Layanan Dihapus', 'Item katalog telah dihapus.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [mitraToken, loadMitraWorkspace, refreshPublicBootstrap, addToast],
  );

  const requestMitraPayout = useCallback(
    async (amount: number, bankAccount: string) => {
      if (!mitraToken) return false;
      try {
        await apiRequest('/api/mitra/payouts', {
          method: 'POST',
          token: mitraToken,
          body: { amount, bankAccount },
        });
        await loadMitraWorkspace(mitraToken);
        addToast('success', 'Pencairan Diajukan', 'Permintaan pencairan saldo tercatat.');
        return true;
      } catch (err) {
        addToast('error', 'Pencairan Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [mitraToken, loadMitraWorkspace, addToast],
  );

  const cancelMitraPayout = useCallback(
    async (id: string) => {
      if (!mitraToken) return false;
      try {
        await apiRequest(`/api/mitra/payouts/${id}`, {
          method: 'DELETE',
          token: mitraToken,
        });
        await loadMitraWorkspace(mitraToken);
        addToast('info', 'Pencairan Dibatalkan', 'Saldo dikembalikan ke akun Mitra.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [mitraToken, loadMitraWorkspace, addToast],
  );

  // =========================================================================
  // ADMIN ACTIONS
  // =========================================================================
  const setupFirstAdmin = useCallback(
    async (payload: {
      username: string;
      email: string;
      fullName: string;
      password: string;
    }) => {
      try {
        const res = await apiRequest<{ token: string; admin: AdminAccount }>(
          '/api/auth/admin/setup',
          { method: 'POST', body: payload },
        );
        setHasAdminInDb(true);
        setAdminToken(res.token);
        setAdminProfile(res.admin);
        await loadAdminWorkspace(res.token);
        addToast('success', 'Admin Database Dibuat', `Akun ${res.admin.username} siap digunakan.`);
        return true;
      } catch (err) {
        addToast('error', 'Setup Admin Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [addToast, loadAdminWorkspace],
  );

  const loginAdmin = useCallback(
    async (identifier: string, password: string) => {
      try {
        const res = await apiRequest<{ token: string; admin: AdminAccount }>(
          '/api/auth/admin/login',
          { method: 'POST', body: { identifier, password } },
        );
        setAdminToken(res.token);
        setAdminProfile(res.admin);
        await loadAdminWorkspace(res.token);
        addToast('success', 'Login Admin Berhasil', `Masuk sebagai ${res.admin.fullName}.`);
        return true;
      } catch (err) {
        addToast('error', 'Login Admin Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [addToast, loadAdminWorkspace],
  );

  const logoutAdmin = useCallback(() => {
    setAdminToken(null);
    setAdminProfile(null);
    setAdminOrders([]);
    setAdminMitras([]);
    setAdminServices([]);
    setAdminTickets([]);
    setAdminPayouts([]);
    setAdminUsers([]);
    setAdminAccounts([]);
    addToast('info', 'Keluar Portal Admin', 'Sesi Admin telah ditutup.');
  }, [addToast]);

  const updateCommissionSettings = useCallback(
    async (settings: CommissionSettings) => {
      if (!adminToken) return false;
      try {
        await apiRequest('/api/admin/settings', {
          method: 'PUT',
          token: adminToken,
          body: settings,
        });
        await Promise.all([loadAdminWorkspace(adminToken), refreshPublicBootstrap()]);
        addToast(
          'success',
          'Komisi Disimpan',
          `Potongan komisi Mitra diatur ke ${settings.platformCommissionPercent}%.`,
        );
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, refreshPublicBootstrap, addToast],
  );

  const adminCreateMitra = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!adminToken) return false;
      try {
        await apiRequest('/api/admin/mitras', {
          method: 'POST',
          token: adminToken,
          body: payload,
        });
        await Promise.all([loadAdminWorkspace(adminToken), refreshPublicBootstrap()]);
        addToast('success', 'Mitra Didaftarkan', 'Akun & profil mitra disimpan ke database.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal Mendaftarkan Mitra', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, refreshPublicBootstrap, addToast],
  );

  const adminUpdateMitra = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/mitras/${id}`, {
          method: 'PUT',
          token: adminToken,
          body: payload,
        });
        await Promise.all([loadAdminWorkspace(adminToken), refreshPublicBootstrap()]);
        addToast('success', 'Mitra Diperbarui', 'Data & kredensial mitra diperbarui.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, refreshPublicBootstrap, addToast],
  );

  const adminToggleMitraOpen = useCallback(
    async (id: string) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/mitras/${id}/toggle`, {
          method: 'PATCH',
          token: adminToken,
        });
        await Promise.all([loadAdminWorkspace(adminToken), refreshPublicBootstrap()]);
        addToast('info', 'Status Mitra Diubah', 'Status operasional toko diperbarui.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, refreshPublicBootstrap, addToast],
  );

  const adminDeleteMitra = useCallback(
    async (id: string) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/mitras/${id}`, {
          method: 'DELETE',
          token: adminToken,
        });
        await Promise.all([loadAdminWorkspace(adminToken), refreshPublicBootstrap()]);
        addToast('warning', 'Mitra Dihapus', 'Data & akun mitra dihapus dari database.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, refreshPublicBootstrap, addToast],
  );

  const adminCreateService = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!adminToken) return false;
      try {
        await apiRequest('/api/admin/services', {
          method: 'POST',
          token: adminToken,
          body: payload,
        });
        await Promise.all([loadAdminWorkspace(adminToken), refreshPublicBootstrap()]);
        addToast('success', 'Layanan Ditambahkan', 'Item layanan disimpan ke katalog.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, refreshPublicBootstrap, addToast],
  );

  const adminUpdateService = useCallback(
    async (id: string, payload: Record<string, unknown>) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/services/${id}`, {
          method: 'PUT',
          token: adminToken,
          body: payload,
        });
        await Promise.all([loadAdminWorkspace(adminToken), refreshPublicBootstrap()]);
        addToast('info', 'Katalog Diperbarui', 'Perubahan tarif/status layanan disimpan.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, refreshPublicBootstrap, addToast],
  );

  const adminDeleteService = useCallback(
    async (id: string) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/services/${id}`, {
          method: 'DELETE',
          token: adminToken,
        });
        await Promise.all([loadAdminWorkspace(adminToken), refreshPublicBootstrap()]);
        addToast('warning', 'Layanan Dihapus', 'Item tarif dihapus dari katalog.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, refreshPublicBootstrap, addToast],
  );

  const adminCreateOrder = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!adminToken) return false;
      try {
        await apiRequest('/api/admin/orders', {
          method: 'POST',
          token: adminToken,
          body: payload,
        });
        await Promise.all([loadAdminWorkspace(adminToken), refreshPublicBootstrap()]);
        addToast('success', 'Pesanan Dicatat', 'Transaksi manual disimpan ke database.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, refreshPublicBootstrap, addToast],
  );

  const adminUpdateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus, note: string) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/orders/${orderId}/status`, {
          method: 'PATCH',
          token: adminToken,
          body: { status, note },
        });
        await Promise.all([loadAdminWorkspace(adminToken), refreshPublicBootstrap()]);
        addToast('info', 'Status Order Diperbarui', note);
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, refreshPublicBootstrap, addToast],
  );

  const adminDeleteOrder = useCallback(
    async (orderId: string) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/orders/${orderId}`, {
          method: 'DELETE',
          token: adminToken,
        });
        await Promise.all([loadAdminWorkspace(adminToken), refreshPublicBootstrap()]);
        addToast('warning', 'Order Dihapus', 'Data transaksi dihapus dari database.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, refreshPublicBootstrap, addToast],
  );

  const adminCreateTicket = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!adminToken) return false;
      try {
        await apiRequest('/api/admin/tickets', {
          method: 'POST',
          token: adminToken,
          body: payload,
        });
        await loadAdminWorkspace(adminToken);
        addToast('success', 'Tiket Dibuat', 'Tiket kendala ditambahkan.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, addToast],
  );

  const adminUpdateTicket = useCallback(
    async (id: string, status: IssueStatus, adminNote: string) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/tickets/${id}`, {
          method: 'PUT',
          token: adminToken,
          body: { status, adminNote },
        });
        await loadAdminWorkspace(adminToken);
        addToast('success', 'Tiket Diperbarui', `Status tiket diubah ke ${status}.`);
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, addToast],
  );

  const adminDeleteTicket = useCallback(
    async (id: string) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/tickets/${id}`, {
          method: 'DELETE',
          token: adminToken,
        });
        await loadAdminWorkspace(adminToken);
        addToast('warning', 'Tiket Dihapus', 'Tiket kendala dihapus.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, addToast],
  );

  const adminProcessPayout = useCallback(
    async (id: string, status: 'selesai' | 'ditolak') => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/payouts/${id}`, {
          method: 'PATCH',
          token: adminToken,
          body: { status },
        });
        await loadAdminWorkspace(adminToken);
        addToast(
          status === 'selesai' ? 'success' : 'warning',
          'Pencairan Diproses',
          status === 'selesai'
            ? 'Pencairan saldo mitra disetujui.'
            : 'Pencairan ditolak dan saldo dikembalikan.',
        );
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, addToast],
  );

  const adminCreateAccount = useCallback(
    async (payload: {
      username: string;
      email: string;
      fullName: string;
      password: string;
    }) => {
      if (!adminToken) return false;
      try {
        await apiRequest('/api/admin/accounts', {
          method: 'POST',
          token: adminToken,
          body: payload,
        });
        await loadAdminWorkspace(adminToken);
        addToast('success', 'Admin Ditambahkan', 'Akun admin baru tersimpan di database.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, addToast],
  );

  const adminUpdateAccount = useCallback(
    async (
      id: string,
      payload: { fullName: string; email: string; password?: string },
    ) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/accounts/${id}`, {
          method: 'PUT',
          token: adminToken,
          body: payload,
        });
        await loadAdminWorkspace(adminToken);
        addToast('success', 'Admin Diperbarui', 'Kredensial admin diperbarui.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, addToast],
  );

  const adminDeleteAccount = useCallback(
    async (id: string) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/accounts/${id}`, {
          method: 'DELETE',
          token: adminToken,
        });
        await loadAdminWorkspace(adminToken);
        addToast('warning', 'Admin Dihapus', 'Akun admin dihapus dari database.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, addToast],
  );

  const adminDeleteUser = useCallback(
    async (id: string) => {
      if (!adminToken) return false;
      try {
        await apiRequest(`/api/admin/users/${id}`, {
          method: 'DELETE',
          token: adminToken,
        });
        await loadAdminWorkspace(adminToken);
        addToast('warning', 'Pengguna Dihapus', 'Data pengguna Google dihapus.');
        return true;
      } catch (err) {
        addToast('error', 'Gagal', err instanceof Error ? err.message : 'Error');
        return false;
      }
    },
    [adminToken, loadAdminWorkspace, addToast],
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
        refreshPublicBootstrap,
        userToken,
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
        mitraToken,
        mitraProfile,
        mitraOrders,
        mitraServices,
        mitraPayouts,
        loginMitra,
        logoutMitra,
        updateMitraProfile,
        toggleMitraSelfOpen,
        updateMitraOrderStatus,
        createMitraService,
        updateMitraService,
        deleteMitraService,
        requestMitraPayout,
        cancelMitraPayout,
        hasAdminInDb,
        adminToken,
        adminProfile,
        adminOrders,
        adminMitras,
        adminServices,
        adminTickets,
        adminPayouts,
        adminUsers,
        adminAccounts,
        checkAdminStatus,
        setupFirstAdmin,
        loginAdmin,
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
        adminCreateAccount,
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
