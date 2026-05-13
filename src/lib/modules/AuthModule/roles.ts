import { getCurrentUser } from './user';

// The hierarchy lives beside role checks so every guard expands permissions in the
// same way instead of each route deciding what admin/gm implies on its own.
const roleHierarchy: Record<string, string[]> = {
  admin: ['admin', 'gm', 'player'],
  gm: ['gm', 'player'],
  player: ['player']
};

export function normalizeRole(role: string) {
  return role.trim().toLowerCase();
}

function splitRoleValue(role: string) {
  return role
    .split(/[,\s]+/)
    .map(normalizeRole)
    .filter(Boolean);
}

export function expandRole(role: string) {
  const normalizedRole = normalizeRole(role);
  return roleHierarchy[normalizedRole] ?? [normalizedRole];
}

export function getCurrentUserRoles(): string[] {
  const user = getCurrentUser();

  if (!user) {
    return [];
  }

  const directRoles = [
    ...(user.roles ?? []),
    ...(user.role ? [user.role] : [])
  ].flatMap(splitRoleValue);

  // Role inheritance is resolved in one place so route guards and UI gates cannot
  // accidentally disagree on whether admin includes gm/player permissions.
  return [...new Set(directRoles.flatMap(expandRole))];
}

export function hasRole(allowedRoles: string | string[]): boolean {
  const currentRoles = getCurrentUserRoles();
  const roles = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map(normalizeRole);

  return roles.some((role) => currentRoles.includes(role));
}
