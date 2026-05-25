import { env } from '$env/dynamic/public';
import { restEndpoints } from './rest-endpoints';

const viteEnv = import.meta.env as Record<string, string | undefined>;
const defaultLoginAPI =
  'https://1n7cbh8yak.execute-api.eu-central-1.amazonaws.com/auth/login';

type RestEndpointConfig = {
  configuredUrl?: string;
  fallbackPath: string;
};

function readConfiguredValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue === 'WS_API_ID') {
    return undefined;
  }

  return trimmedValue;
}

function getRestApiBaseUrl(loginUrl: string) {
  return loginUrl.replace(/\/auth\/login$/, '');
}

function buildRestEndpoint(path: string) {
  return `${restApiBaseUrl}/${path.replace(/^\//, '')}`;
}

function resolveRestEndpoint({ configuredUrl, fallbackPath }: RestEndpointConfig) {
  return readConfiguredValue(configuredUrl) ?? buildRestEndpoint(fallbackPath);
}

function firstConfiguredValue(...values: Array<string | undefined>) {
  return values.map(readConfiguredValue).find(Boolean);
}

export const loginAPI = readConfiguredValue(env.PUBLIC_AUTH_LOGIN_URL) ?? defaultLoginAPI;
const restApiBaseUrl = getRestApiBaseUrl(loginAPI);

export const newPasswordChallengeAPI =
  readConfiguredValue(env.PUBLIC_AUTH_NEW_PASSWORD_URL) ?? loginAPI;

export const refreshAPI = resolveRestEndpoint(restEndpoints.refresh);
export const logoutAPI = resolveRestEndpoint(restEndpoints.logout);
export const charactersAPI = resolveRestEndpoint(restEndpoints.characters);
export const usersAPI = resolveRestEndpoint(restEndpoints.users);
export const rpgSessionsAPI = resolveRestEndpoint(restEndpoints.rpgSessions);
export const mapAssetsAPI = resolveRestEndpoint(restEndpoints.mapAssets);

const webSocketApiId = env.PUBLIC_WEBSOCKET_API_ID;
const webSocketRegion = env.PUBLIC_AWS_REGION ?? 'eu-central-1';
const webSocketStage = env.PUBLIC_WEBSOCKET_STAGE ?? 'dev';

const configuredWebSocketApiId = readConfiguredValue(webSocketApiId);

export const webSocketAPI =
  firstConfiguredValue(
    env.PUBLIC_WEBSOCKET_URL,
    env.PUBLIC_WS_API_URL,
    viteEnv.VITE_WS_API_URL
  ) ??
  (configuredWebSocketApiId
    ? `wss://${configuredWebSocketApiId}.execute-api.${webSocketRegion}.amazonaws.com/${webSocketStage}`
    : '');
