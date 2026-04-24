export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function parseDateOnlyLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day || 1);
}

export function formatDateOnly(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  return parseDateOnlyLocal(dateStr).toLocaleDateString('es-AR', options);
}

export function formatMonthYear(dateStr: string, month: 'short' | 'long' = 'long'): string {
  return formatDateOnly(dateStr, { month, year: 'numeric' });
}

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
