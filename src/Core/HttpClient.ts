import got, { type OptionsOfBufferResponseBody, type OptionsOfTextResponseBody } from "got";
import type { CookieJar } from "tough-cookie";
import { IServApiError } from "./Errors.js";

export const BROWSER_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
};

export interface IServJsonResponse<T> {
  status: "success" | "error";
  data: T;
  message?: string;
  error?: string;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function parseJson<T>(value: unknown, context: string): T {
  if (typeof value !== "string") {
    if (value === null || value === undefined)
      throw new Error(`${context}: received null/undefined`);
    return value as T;
  }
  try {
    return JSON.parse(value) as T;
  } catch (err) {
    throw new IServApiError(
      `Expected JSON response for ${context}: ${err instanceof Error ? err.message : "invalid JSON"}`,
      500,
    );
  }
}

export function parseIServJsonData<T>(value: unknown, context: string): T {
  const response = parseJson<IServJsonResponse<T>>(value, context);
  if (response.status !== "success") {
    throw new IServApiError(
      response.message ?? response.error ?? `IServ returned an error for ${context}`,
      500,
    );
  }
  return response.data;
}

type GetConfig = {
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  responseType?: "arraybuffer";
};

type PostConfig = {
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
};

export function createHttpClient(cookieJar: CookieJar) {
  const client = got.extend({
    cookieJar,
    headers: BROWSER_HEADERS,
    followRedirect: true,
    throwHttpErrors: false,
    https: { rejectUnauthorized: true },
  });

  async function get(url: string, config: GetConfig = {}) {
    if (config.responseType === "arraybuffer") {
      const opts: OptionsOfBufferResponseBody = { responseType: "buffer" };
      if (config.params) opts.searchParams = config.params;
      if (config.headers) opts.headers = config.headers;
      const res = await client.get(url, opts);
      if (res.statusCode >= 400) throw new IServApiError(`HTTP ${res.statusCode}`, res.statusCode);
      return {
        data: res.body as unknown as Buffer,
        status: res.statusCode,
        headers: res.headers,
        url: res.url,
      };
    }

    const opts: OptionsOfTextResponseBody = { responseType: "text" };
    if (config.params) opts.searchParams = config.params;
    if (config.headers) opts.headers = config.headers;
    const res = await client.get(url, opts);
    if (res.statusCode >= 400) throw new IServApiError(`HTTP ${res.statusCode}`, res.statusCode);
    return { data: res.body as string, status: res.statusCode, headers: res.headers, url: res.url };
  }

  async function post(url: string, body?: string | null, config: PostConfig = {}) {
    const opts: OptionsOfTextResponseBody = { responseType: "text" };
    if (body != null) opts.body = body;
    if (config.params) opts.searchParams = config.params;
    if (config.headers) opts.headers = config.headers;
    const res = await client.post(url, opts);
    if (res.statusCode >= 400) throw new IServApiError(`HTTP ${res.statusCode}`, res.statusCode);
    return { data: res.body as string, status: res.statusCode, headers: res.headers, url: res.url };
  }

  async function put(url: string, body?: string | null, config: PostConfig = {}) {
    const opts: OptionsOfTextResponseBody = { responseType: "text" };
    if (body != null) opts.body = body;
    if (config.params) opts.searchParams = config.params;
    if (config.headers) opts.headers = config.headers;
    const res = await client.put(url, opts);
    if (res.statusCode >= 400) throw new IServApiError(`HTTP ${res.statusCode}`, res.statusCode);
    return { data: res.body as string, status: res.statusCode, headers: res.headers, url: res.url };
  }

  return { get, post, put };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
