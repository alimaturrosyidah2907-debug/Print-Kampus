import React from 'react';
import {
  CheckCircle2,
  Clock,
  PackageCheck,
  Printer,
  XCircle,
  AlertTriangle,
  Search,
} from 'lucide-react';
import type { IssueStatus, OrderStatus } from '../types/printkampus';
import { ORDER_STATUS_LABELS } from '../utils/pricing';

const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { textClass: string; Icon: React.FC<{ className?: string }> }
> = {
  menunggu_konfirmasi: {
    textClass: 'text-amber-700 dark:text-amber-400',
    Icon: Clock,
  },
  diproses: {
    textClass: 'text-blue-700 dark:text-blue-400',
    Icon: Printer,
  },
  siap_diambil: {
    textClass: 'text-emerald-700 dark:text-emerald-400',
    Icon: PackageCheck,
  },
  selesai: {
    textClass: 'text-slate-700 dark:text-slate-300',
    Icon: CheckCircle2,
  },
  dibatalkan: {
    textClass: 'text-rose-700 dark:text-rose-400',
    Icon: XCircle,
  },
};

export const OrderStatusText: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const cfg = ORDER_STATUS_CONFIG[status];
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cfg.textClass} whitespace-nowrap`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{ORDER_STATUS_LABELS[status]}</span>
    </span>
  );
};

const ISSUE_STATUS_CONFIG: Record<
  IssueStatus,
  { label: string; textClass: string; Icon: React.FC<{ className?: string }> }
> = {
  terbuka: {
    label: 'Terbuka',
    textClass: 'text-amber-700 dark:text-amber-400',
    Icon: AlertTriangle,
  },
  investigasi: {
    label: 'Investigasi',
    textClass: 'text-blue-700 dark:text-blue-400',
    Icon: Search,
  },
  selesai: {
    label: 'Selesai',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  ditolak: {
    label: 'Ditolak',
    textClass: 'text-rose-700 dark:text-rose-400',
    Icon: XCircle,
  },
};

export const IssueStatusText: React.FC<{ status: IssueStatus }> = ({ status }) => {
  const cfg = ISSUE_STATUS_CONFIG[status];
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cfg.textClass} whitespace-nowrap`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{cfg.label}</span>
    </span>
  );
};
