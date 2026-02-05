/**
 * Security validation utilities for input sanitization
 */

export function sanitizeString(input: unknown, maxLength = 255): string {
    if (typeof input !== 'string') return '';
    return input.trim().slice(0, maxLength);
}

export function validateEmail(email: string): boolean {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
}

export function validateUUID(id: string): boolean {
    if (typeof id !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

export function escapeHtml(str: string): string {
    if (typeof str !== 'string') return '';
    const htmlEscapes: Record<string, string> = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;',
    };
    return str.replace(/[&<>"'/]/g, char => htmlEscapes[char]);
}
