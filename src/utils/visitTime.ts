export function nowLocalDateTimeInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayLocalDate(): string {
  return nowLocalDateTimeInput().slice(0, 10);
}

export function formatVisitDateTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '—';
  const parsed = new Date(isoStr);
  if (Number.isNaN(parsed.getTime())) {
    return String(isoStr).replace('T', ' ');
  }
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatVisitDuration(
  checkInTime: string | null | undefined,
  checkOutTime: string | null | undefined
): string {
  if (!checkInTime) return '—';
  const start = new Date(checkInTime).getTime();
  if (Number.isNaN(start)) return '—';
  const end = checkOutTime ? new Date(checkOutTime).getTime() : Date.now();
  if (Number.isNaN(end)) return '—';
  const diffMins = Math.max(0, Math.round((end - start) / 60000));
  const days = Math.floor(diffMins / (60 * 24));
  const hours = Math.floor((diffMins % (60 * 24)) / 60);
  const mins = diffMins % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  const formatted = parts.join(' ');
  return checkOutTime ? formatted : `${formatted} (Ongoing)`;
}
