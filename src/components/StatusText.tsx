import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, MinusCircle, XCircle } from 'lucide-react';

const STATUS_STYLES: Record<string, { color: string; icon: 'check' | 'clock' | 'warn' | 'error' | 'neutral'; label?: string }> = {
  ACTIVE: { color: 'text-[#15803D]', icon: 'check', label: 'Active' },
  INACTIVE: { color: 'text-[#64748B]', icon: 'neutral', label: 'Inactive' },
  SCHEDULED: { color: 'text-[#1D4ED8]', icon: 'clock', label: 'Scheduled' },
  COMPLETED: { color: 'text-[#15803D]', icon: 'check', label: 'Completed' },
  CANCELLED: { color: 'text-[#DC2626]', icon: 'error', label: 'Cancelled' },
  PENDING: { color: 'text-[#B45309]', icon: 'clock', label: 'Pending' },
  PARTIAL: { color: 'text-[#B45309]', icon: 'warn', label: 'Partial' },
  PAID: { color: 'text-[#15803D]', icon: 'check', label: 'Paid' },
  DISPENSED: { color: 'text-[#15803D]', icon: 'check', label: 'Dispensed' },
  VERIFIED: { color: 'text-[#15803D]', icon: 'check', label: 'Verified' },
  REQUESTED: { color: 'text-[#1D4ED8]', icon: 'clock', label: 'Requested' },
  IN_PROGRESS: { color: 'text-[#B45309]', icon: 'clock', label: 'In Progress' },
  STABLE: { color: 'text-[#15803D]', icon: 'check', label: 'Stable' },
  IMPROVING: { color: 'text-[#1D4ED8]', icon: 'check', label: 'Improving' },
  RECOVERED: { color: 'text-[#15803D]', icon: 'check', label: 'Recovered' },
  UNDER_OBSERVATION: { color: 'text-[#B45309]', icon: 'warn', label: 'Under Observation' },
  CRITICAL: { color: 'text-[#DC2626]', icon: 'error', label: 'Critical' },
  URGENT: { color: 'text-[#DC2626]', icon: 'warn', label: 'Urgent' },
  ROUTINE: { color: 'text-[#475569]', icon: 'neutral', label: 'Routine' },
  EXPIRED: { color: 'text-[#DC2626]', icon: 'error', label: 'Expired' },
  NEAR_EXPIRY: { color: 'text-[#B45309]', icon: 'warn', label: 'Near Expiry' },
  LOW_STOCK: { color: 'text-[#B45309]', icon: 'warn', label: 'Low Stock' },
  IN_HOSPITAL: { color: 'text-[#0284C7]', icon: 'clock', label: 'In Hospital' },
  CHECKED_OUT: { color: 'text-[#15803D]', icon: 'check', label: 'Checked Out' },
};

export const StatusText: React.FC<{ status: string | null | undefined }> = ({ status }) => {
  const key = String(status ?? 'PENDING').toUpperCase();
  const cfg = STATUS_STYLES[key] ?? { color: 'text-[#475569]', icon: 'neutral', label: key };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${cfg.color}`}>
      {cfg.icon === 'check' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
      {cfg.icon === 'clock' && <Clock className="h-3.5 w-3.5 shrink-0" />}
      {cfg.icon === 'warn' && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
      {cfg.icon === 'error' && <XCircle className="h-3.5 w-3.5 shrink-0" />}
      {cfg.icon === 'neutral' && <MinusCircle className="h-3.5 w-3.5 shrink-0" />}
      <span>{cfg.label ?? key}</span>
    </span>
  );
};
