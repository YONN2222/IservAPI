import { expect } from "vitest";
import type { IServSession } from "../../src/Core/IServSession.js";

type HttpMethod = "get" | "post" | "put";

type HttpConfig = {
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  responseType?: string;
};

type MockHttpResponse = {
  data: string | Buffer;
  status: number;
  headers: Record<string, string>;
  url: string;
};

export type MockHttpCall = {
  method: HttpMethod;
  url: string;
  body?: string | null;
  config: HttpConfig;
};

export type MockRoute = {
  method: HttpMethod;
  url: string;
  body?: string | null;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  responseType?: string;
  response: {
    data: string | Buffer;
    status?: number;
    headers?: Record<string, string>;
    url?: string;
  };
};

type MockSessionOptions = {
  routes: MockRoute[];
  server?: string;
  username?: string;
  password?: string;
};

function normalizeConfig(config: HttpConfig = {}): HttpConfig {
  const normalized: HttpConfig = {};
  if (config.params) normalized.params = config.params;
  if (config.headers) normalized.headers = config.headers;
  if (config.responseType) normalized.responseType = config.responseType;
  return normalized;
}

function routeConfig(route: MockRoute): HttpConfig {
  const config: HttpConfig = {};
  if (route.params) config.params = route.params;
  if (route.headers) config.headers = route.headers;
  if (route.responseType) config.responseType = route.responseType;
  return config;
}

function findRoute(routes: MockRoute[], call: MockHttpCall): MockRoute {
  const route = routes.shift();
  if (!route) throw new Error(`Unexpected ${call.method.toUpperCase()} ${call.url}`);

  if (call.method !== route.method || call.url !== route.url) {
    throw new Error(
      `Expected ${route.method.toUpperCase()} ${route.url} but got ${call.method.toUpperCase()} ${call.url}`,
    );
  }

  const expectedConfig = routeConfig(route);
  const actualConfig = call.config;
  if (JSON.stringify(expectedConfig) !== JSON.stringify(actualConfig)) {
    throw new Error(
      `Route config mismatch for ${call.method.toUpperCase()} ${call.url}:\n  expected: ${JSON.stringify(expectedConfig)}\n  received: ${JSON.stringify(actualConfig)}`,
    );
  }

  return route;
}

function routeResponse(route: MockRoute, url: string): MockHttpResponse {
  return {
    data: route.response.data,
    status: route.response.status ?? 200,
    headers: route.response.headers ?? {},
    url: route.response.url ?? url,
  };
}

export function createMockIServSession({
  routes,
  server = "iserv.example",
  username = "alice",
  password = "secret",
}: MockSessionOptions): {
  session: IServSession;
  calls: MockHttpCall[];
  expectAllRoutesCalled: () => void;
} {
  const pendingRoutes = [...routes];
  const calls: MockHttpCall[] = [];
  let _matrixToken: string | null = null;

  const http = {
    get: async (url: string, config: HttpConfig = {}) => {
      const call = { method: "get" as const, url, config: normalizeConfig(config) };
      calls.push(call);
      const route = findRoute(pendingRoutes, call);
      return routeResponse(route, url);
    },
    post: async (url: string, body?: string | null, config: HttpConfig = {}) => {
      const call: MockHttpCall = { method: "post", url, config: normalizeConfig(config) };
      if (body !== undefined) call.body = body;
      calls.push(call);
      const route = findRoute(pendingRoutes, call);
      return routeResponse(route, url);
    },
    put: async (url: string, body?: string | null, config: HttpConfig = {}) => {
      const call: MockHttpCall = { method: "put", url, config: normalizeConfig(config) };
      if (body !== undefined) call.body = body;
      calls.push(call);
      const route = findRoute(pendingRoutes, call);
      return routeResponse(route, url);
    },
  };

  return {
    calls,
    expectAllRoutesCalled: () => expect(pendingRoutes).toHaveLength(0),
    session: {
      url: server,
      username,
      baseUrl: () => `https://${server}`,
      matrixBaseUrl: () => `https://${server}/_matrix/client/v3`,
      get matrixToken() {
        return _matrixToken;
      },
      setMatrixToken: (token: string) => {
        _matrixToken = token;
      },
      getPassword: () => password,
      http,
    } as unknown as IServSession,
  };
}

export function iservJson<T>(data: T): string {
  return JSON.stringify({ status: "success", data });
}

export function iservJsonError(message: string): string {
  return JSON.stringify({ status: "error", data: null, message });
}
