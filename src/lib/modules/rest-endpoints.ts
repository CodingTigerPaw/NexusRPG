import { env } from '$env/dynamic/public';

export const restEndpoints = {
  refresh: {
    configuredUrl: env.PUBLIC_AUTH_REFRESH_URL,
    fallbackPath: 'auth/refresh'
  },
  logout: {
    configuredUrl: env.PUBLIC_AUTH_LOGOUT_URL,
    fallbackPath: 'auth/logout'
  },
  characters: {
    configuredUrl: env.PUBLIC_CHARACTERS_URL,
    fallbackPath: 'character-sheets'
  },
  users: {
    configuredUrl: env.PUBLIC_USERS_URL,
    fallbackPath: 'users'
  },
  rpgSessions: {
    configuredUrl: env.PUBLIC_RPG_SESSIONS_URL,
    fallbackPath: 'rpg-sessions'
  },
  mapAssets: {
    configuredUrl: env.PUBLIC_MAP_ASSETS_URL,
    fallbackPath: 'map-assets'
  }
};
