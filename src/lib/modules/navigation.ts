export const appRoles = {
  admin: 'admin',
  gm: 'gm',
  player: 'player'
} as const;

export type AppRole = (typeof appRoles)[keyof typeof appRoles];

export type AppRoute = {
  href: string;
  label: string;
  requiresAuth: boolean;
  roles?: AppRole[];
};

export const appRoutes = [
  {
    href: '/profile',
    label: 'Profil',
    requiresAuth: true
  },
  {
    href: '/characters',
    label: 'Postacie',
    requiresAuth: true
  },
  {
    href: '/sessions',
    label: 'Sesje',
    requiresAuth: true
  },
  {
    href: '/admin',
    label: 'Admin',
    requiresAuth: true,
    roles: [appRoles.admin]
  }
] satisfies AppRoute[];
