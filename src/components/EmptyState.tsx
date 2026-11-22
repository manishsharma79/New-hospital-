import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-12 text-center">
    <Inbox className="h-8 w-8 text-[#64748B]" />
    <h3 className="mt-3 text-sm font-semibold text-[#0F172A]">{title}</h3>
    <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#64748B]">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-medium text-white hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
