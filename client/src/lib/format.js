const LOCALE = 'en-IN';

export function money(value, currency = 'INR', compact = false) {
  const n = Number(value || 0);
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: currency || 'INR',
      notation: compact && Math.abs(n) >= 100000 ? 'compact' : 'standard',
      maximumFractionDigits: compact && Math.abs(n) >= 100000 ? 1 : 0,
    }).format(n);
  } catch {
    return `${currency || 'INR'} ${Math.round(n)}`;
  }
}

export function plainNumber(value, currency = 'INR') {
  const n = Number(value || 0);
  const symbol = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', JPY: '¥' }[currency] || '';
  return `${symbol}${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(n)}`;
}

export const monthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export function monthLabel(key) {
  if (!key) return '';
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
}

export function shiftMonth(key, delta) {
  const [y, m] = String(key).split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

export function formatDateLong(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function initials(name = '', email = '') {
  const source = (name || '').trim() || (email || '').split('@')[0] || 'S';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const PALETTE = [
  ['#10B981', '#D1FAE5'],
  ['#6366F1', '#E0E7FF'],
  ['#F59E0B', '#FEF3C7'],
  ['#EC4899', '#FCE7F3'],
  ['#0EA5E9', '#E0F2FE'],
  ['#8B5CF6', '#EDE9FE'],
  ['#F43F5E', '#FFE4E6'],
  ['#14B8A6', '#CCFBF1'],
  ['#84CC16', '#ECFCCB'],
  ['#F97316', '#FFEDD5'],
  ['#64748B', '#E2E8F0'],
  ['#A855F7', '#F3E8FF'],
  ['#0D9488', '#CCFBF1'],
  ['#DC2626', '#FEE2E2'],
  ['#2563EB', '#DBEAFE'],
];

/** Stable colour pair for a category name. */
export function categoryColors(category = '') {
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export const CATEGORY_EMOJI = {
  'Food & Drinks': '🍜',
  Transport: '🚌',
  'Books & Study': '📚',
  'Hostel & Rent': '🏠',
  'College Fees': '🎓',
  'Phone & Recharge': '📱',
  Health: '💊',
  Entertainment: '🎬',
  Subscriptions: '🔁',
  Clothes: '👕',
  Stationery: '✏️',
  'Part-time Income': '💼',
  Scholarship: '🎓',
  Gift: '🎁',
  Other: '✨',
};

export const emojiFor = (category) => CATEGORY_EMOJI[category] || '💸';

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
