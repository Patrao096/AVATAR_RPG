import { CONFIG } from '../config.js';

const PREFIX = 'panel';
const MODAL_PREFIX = 'modal';

export function build(section, action, userId, extra = null) {
  const ts = Date.now().toString(36);
  let id = `${PREFIX}:${section}:${action}:${userId}:${ts}`;
  if (extra != null) id += `:${extra}`;
  if (id.length > 100) id = id.slice(0, 100);
  return id;
}

export function buildModal(section, action, userId, extra = null) {
  const ts = Date.now().toString(36);
  let id = `${MODAL_PREFIX}:${section}:${action}:${userId}:${ts}`;
  if (extra != null) id += `:${extra}`;
  if (id.length > 100) id = id.slice(0, 100);
  return id;
}

export function parse(customId) {
  if (typeof customId !== 'string') return null;
  let kind = null;
  if (customId.startsWith(`${PREFIX}:`)) kind = 'component';
  else if (customId.startsWith(`${MODAL_PREFIX}:`)) kind = 'modal';
  else return null;

  const parts = customId.split(':');
  if (parts.length < 5) return null;
  const [, section, action, userId, ts, ...rest] = parts;
  return {
    kind,
    section,
    action,
    userId,
    ts: parseInt(ts, 36),
    extra: rest.length > 0 ? rest.join(':') : null,
  };
}

export function validate(parsed, requestingUserId) {
  if (!parsed) return { valid: false, reason: 'malformed' };
  if (parsed.userId !== requestingUserId) return { valid: false, reason: 'foreign_panel' };
  if (Date.now() - parsed.ts > CONFIG.CUSTOM_ID_TTL_MS) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, reason: null };
}
