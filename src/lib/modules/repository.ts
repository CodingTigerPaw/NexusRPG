import { env } from '$env/dynamic/public';

const viteEnv = import.meta.env as Record<string, string | undefined>;

export const loginAPI =
  env.PUBLIC_AUTH_LOGIN_URL ??
  'https://1n7cbh8yak.execute-api.eu-central-1.amazonaws.com/auth/login';

export const newPasswordChallengeAPI =
  env.PUBLIC_AUTH_NEW_PASSWORD_URL ?? loginAPI;

export const refreshAPI =
  env.PUBLIC_AUTH_REFRESH_URL ??
  loginAPI.replace(/\/auth\/login$/, '/auth/refresh');

export const logoutAPI =
  env.PUBLIC_AUTH_LOGOUT_URL ??
  loginAPI.replace(/\/auth\/login$/, '/auth/logout');

export const charactersAPI =
  env.PUBLIC_CHARACTERS_URL ??
  loginAPI.replace(/\/auth\/login$/, '/character-sheets');

export const usersAPI =
  env.PUBLIC_USERS_URL ??
  loginAPI.replace(/\/auth\/login$/, '/users');

export const rpgSessionsAPI =
  env.PUBLIC_RPG_SESSIONS_URL ??
  loginAPI.replace(/\/auth\/login$/, '/rpg-sessions');

const webSocketApiId = env.PUBLIC_WEBSOCKET_API_ID;
const webSocketRegion = env.PUBLIC_AWS_REGION ?? 'eu-central-1';
const webSocketStage = env.PUBLIC_WEBSOCKET_STAGE ?? 'dev';

function readConfiguredValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue === 'WS_API_ID') {
    return undefined;
  }

  return trimmedValue;
}

const configuredWebSocketApiId = readConfiguredValue(webSocketApiId);

export const webSocketAPI =
  readConfiguredValue(env.PUBLIC_WEBSOCKET_URL) ??
  readConfiguredValue(env.PUBLIC_WS_API_URL) ??
  readConfiguredValue(viteEnv.VITE_WS_API_URL) ??
  (configuredWebSocketApiId
    ? `wss://${configuredWebSocketApiId}.execute-api.${webSocketRegion}.amazonaws.com/${webSocketStage}`
    : '');
