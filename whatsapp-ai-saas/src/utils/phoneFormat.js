// Client-side mirror of backend/services/contactAgent.js's format check, used only for
// instant preview badges before the save-contacts call - the backend remains the source
// of truth for what actually gets validated/deduped/inserted.

export function normalizePhone(raw) {
    if (!raw) return '';
    const trimmed = String(raw).trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    return hasPlus ? `+${digits}` : digits;
}

export function isValidPhoneFormat(raw) {
    const normalized = normalizePhone(raw);
    if (!normalized) return false;
    const digitCount = normalized.replace(/^\+/, '').length;
    return digitCount >= 8 && digitCount <= 15;
}
