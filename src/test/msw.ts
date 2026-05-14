import { setupServer } from 'msw/node';

// Wspólny serwer MSW pozwala testom dodawać własne handlery przez server.use().
// Trzymamy go poza pojedynczym testem, żeby każdy moduł korzystał z tego samego cyklu życia.
export const server = setupServer();
