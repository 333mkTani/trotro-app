const toE164Gh = (raw) => {
  const digits = String(raw || '').replace(/[^0-9+]/g, '');
  if (digits.startsWith('+233')) return `+233${digits.slice(4)}`;
  if (digits.startsWith('233')) return `+${digits}`;
  if (digits.startsWith('0')) return `+233${digits.slice(1)}`;
  if (digits.startsWith('+')) return digits;
  return `+233${digits}`;
};

const ghPhoneVariants = (raw) => {
  const normalized = toE164Gh(raw);
  if (!normalized.startsWith('+233')) return [normalized];
  const national = normalized.slice(4);
  return [...new Set([normalized, `0${national}`, national])];
};

module.exports = { toE164Gh, ghPhoneVariants };
