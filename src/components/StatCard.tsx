import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'default' | 'primary' | 'warning' | 'danger' | 'success';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, detail, tone = 'default' }) => {
  const palette =
    tone === 'primary'
      ? {
          bar: 'from-[#0284C7] to-[#1D4ED8]',
          value: 'text-[#1D4ED8]',
          band: 'hmis-band-blue',
        }
      : tone === 'warning'
      ? {
          bar: 'from-[#D97706] to-[#F59E0B]',
          value: 'text-[#B45309]',
          band: 'hmis-band-amber',
        }
      : tone === 'danger'
      ? {
          bar: 'from-[#DC2626] to-[#E11D48]',
          value: 'text-[#DC2626]',
          band: 'hmis-band-rose',
        }
      : tone === 'success'
      ? {
          bar: 'from-[#059669] to-[#0D9488]',
          value: 'text-[#15803D]',
          band: 'hmis-band-emerald',
        }
      : {
          bar: 'from-[#0EA5E9] to-[#0284C7]',
          value: 'text-[#0B1F3A]',
          band: 'hmis-band-teal',
        };

  return (
    <div className="overflow-hidden rounded-xl border border-[#CBD5E1]/80 bg-white shadow-2xs">
      <div className={`h-1.5 w-full bg-gradient-to-r ${palette.bar}`} />
      <div className="p-5">
        <p className="text-xs font-semibold text-[#475569]">{label}</p>
        <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${palette.value}`}>{value}</p>
        {detail && <p className="mt-1.5 text-xs text-[#64748B]">{detail}</p>}
      </div>
    </div>
  );
};
