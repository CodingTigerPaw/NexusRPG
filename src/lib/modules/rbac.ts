import { goto } from '$app/navigation';
import { hasRole, isAuthenticated } from '$lib/modules/auth';
import type { AppRole } from '$lib/modules/navigation';

export type RoleGuardOptions = {
  loginPath?: string;
  unauthorizedPath?: string;
};

export function canAccess(allowedRoles: AppRole | AppRole[]) {
  return hasRole(allowedRoles);
}

export async function requireAuth(options: RoleGuardOptions = {}) {
  if (!isAuthenticated()) {
    await goto(options.loginPath ?? '/');
    return false;
  }

  return true;
}

export async function requireRole(allowedRoles: AppRole | AppRole[], options: RoleGuardOptions = {}) {
  const authenticated = await requireAuth(options);

  if (!authenticated) {
    return false;
  }

  if (!hasRole(allowedRoles)) {
    await goto(options.unauthorizedPath ?? '/profile');
    return false;
  }

  return true;
}
