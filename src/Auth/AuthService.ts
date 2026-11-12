import { IServAuthError, IServTwoFactorRequiredError } from "../Core/Errors.js";
import { parseJson } from "../Core/HttpClient.js";
import type { IServSession } from "../Core/IServSession.js";
import { createLogger } from "../Core/Logger.js";
import { generateTotp } from "./totp.js";

const log = createLogger("Auth");

function isAuthenticationUrl(url: string): boolean {
  const parsed = new URL(url);
  return parsed.pathname === "/iserv/auth/login" || parsed.pathname === "/iserv/auth/auth";
}

function isLoginUrl(url: string): boolean {
  return new URL(url).pathname === "/iserv/auth/login";
}

function isAppAuthUrl(url: string): boolean {
  return new URL(url).pathname === "/iserv/auth/auth";
}

export type ConnectOptions = {
  /** Current 6-digit code from the authenticator app, or a function that returns it (e.g. prompts the user). */
  twoFactorCode?: string | (() => string | Promise<string>);
  /** Base32 secret of the authenticator app; the code is generated automatically, which also works for re-logins. */
  twoFactorSecret?: string;
};

const TWO_FACTOR_FIELD = "two_factor_login_form";

function isTwoFactorPage(res: { url: string; data: string }): boolean {
  return (
    new URL(res.url).pathname === "/iserv/auth/twofactor/confirm" ||
    res.data.includes(`name="${TWO_FACTOR_FIELD}[`)
  );
}

function resolveHtmlRedirect(html: string, baseUrl: string): string | null {
  const metaRefresh = html.match(
    /<meta\b[^>]*http-equiv\s*=\s*(?:"refresh"|'refresh'|refresh)[^>]*>/i,
  )?.[0];
  const content = metaRefresh?.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/i);
  const refreshUrl = (content?.[1] ?? content?.[2] ?? content?.[3])
    ?.replaceAll("&amp;", "&")
    .match(/url=(.+)$/i)?.[1];
  if (refreshUrl) return new URL(refreshUrl.replaceAll("&amp;", "&"), baseUrl).href;

  const redirectLink = html.match(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const href = redirectLink?.[1] ?? redirectLink?.[2];
  if (!href || href.startsWith("#")) return null;

  return new URL(href.replaceAll("&amp;", "&"), baseUrl).href;
}

type TextHttpResponse = {
  data: string;
  status: number;
  headers: unknown;
  url: string;
};

const NAVIGATION_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

function parseLoginForm(html: string): URLSearchParams {
  const params = new URLSearchParams();
  const inputPattern = /<input\b[^>]*>/gi;
  const attrPattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const [input] of html.matchAll(inputPattern)) {
    const attrs = new Map<string, string>();
    for (const [, rawName, doubleQuoted, singleQuoted, bare] of input.matchAll(attrPattern)) {
      if (!rawName) continue;
      attrs.set(rawName.toLowerCase(), doubleQuoted ?? singleQuoted ?? bare ?? "");
    }

    const name = attrs.get("name");
    if (!name) continue;

    const type = attrs.get("type")?.toLowerCase();
    if (type === "checkbox" || type === "radio") {
      if (!attrs.has("checked")) continue;
    }

    params.set(name, attrs.get("value") ?? "");
  }

  return params;
}

export class AuthService {
  constructor(
    private readonly session: IServSession,
    private readonly options: ConnectOptions = {},
  ) {}

  private async resolveTwoFactorCode(): Promise<string> {
    const { twoFactorCode, twoFactorSecret } = this.options;
    const raw =
      typeof twoFactorCode === "function"
        ? await twoFactorCode()
        : (twoFactorCode ?? (twoFactorSecret ? generateTotp(twoFactorSecret) : undefined));
    if (raw === undefined) throw new IServTwoFactorRequiredError();
    const code = raw.replace(/\s/g, "");
    if (!/^\d{6}$/.test(code))
      throw new IServAuthError("Login failed! The two-factor code must have 6 digits.");
    return code;
  }

  private async submitTwoFactor(page: TextHttpResponse): Promise<TextHttpResponse> {
    const code = await this.resolveTwoFactorCode();
    const params = parseLoginForm(page.data);
    [...code].forEach((digit, index) => {
      params.set(`${TWO_FACTOR_FIELD}[two_factor_code_digit_${index + 1}]`, digit);
    });
    params.set("otp", code);

    const res = await this.fetchText(page.url, {
      method: "POST",
      body: params.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const next = await this.followHtmlRedirects(res);
    if (isTwoFactorPage(next)) throw new IServAuthError("Login failed! Wrong two-factor code.");
    return next;
  }

  private async fetchText(
    url: string,
    options: { method?: string; body?: string; headers?: Record<string, string> } = {},
  ): Promise<TextHttpResponse> {
    const cookieJar = (this.session as IServSession & { cookieJar?: IServSession["cookieJar"] })
      .cookieJar;
    if (!cookieJar) {
      const config = options.headers ? { headers: options.headers } : {};
      if (options.method === "POST") {
        return this.session.http.post(url, options.body, config);
      }
      const res = await this.session.http.get(url, config);
      return { ...res, data: res.data as string };
    }

    const cookieHeader = cookieJar.getCookieStringSync(url);
    const headers = {
      ...NAVIGATION_HEADERS,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...options.headers,
    };
    const init: RequestInit = {
      method: options.method ?? "GET",
      headers,
      redirect: "manual",
    };
    if (options.body !== undefined) init.body = options.body;
    const res = await fetch(url, init);

    const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const setCookies = getSetCookie?.call(res.headers) ?? [];
    const singleSetCookie = res.headers.get("set-cookie");
    for (const cookie of setCookies.length > 0
      ? setCookies
      : singleSetCookie
        ? [singleSetCookie]
        : []) {
      cookieJar.setCookieSync(cookie, url);
    }

    const location = res.headers.get("location");
    if (location && res.status >= 300 && res.status < 400) {
      return this.fetchText(new URL(location, url).href);
    }

    return {
      data: await res.text(),
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      url: res.url,
    };
  }

  private async followHtmlRedirects(res: TextHttpResponse): Promise<TextHttpResponse> {
    let current = res;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const redirectUrl = resolveHtmlRedirect(current.data as string, current.url);
      if (!redirectUrl) return current;

      const next = await this.session.http.get(redirectUrl);
      current = { ...next, data: next.data as string };
    }

    return current;
  }

  private async establishAppSession(): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const homeRes = await this.session.http.get(`${this.session.baseUrl()}/iserv/`);

      if (!isAuthenticationUrl(homeRes.url)) return;
      if (isLoginUrl(homeRes.url)) break;
      if (isAppAuthUrl(homeRes.url)) continue;
    }

    throw new IServAuthError("Login failed! Session was not established.");
  }

  async login(): Promise<void> {
    const loginUrl = `${this.session.baseUrl()}/iserv/`;

    try {
      const baseRes = await this.fetchText(loginUrl);
      const loginParams = parseLoginForm(baseRes.data as string);
      loginParams.set("_username", this.session.username);
      loginParams.set("_password", this.session.getPassword());

      const loginRes = await this.fetchText(baseRes.url, {
        method: "POST",
        body: loginParams.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      let postLoginRes = await this.followHtmlRedirects(loginRes);

      const body = postLoginRes.data as string;
      if (body.includes("Account existiert nicht!"))
        throw new IServAuthError("Account does not exist!");
      if (body.includes("Anmeldung fehlgeschlagen!"))
        throw new IServAuthError("Login failed! Wrong password.");
      if (isTwoFactorPage(postLoginRes)) postLoginRes = await this.submitTwoFactor(postLoginRes);

      await this.establishAppSession();

      await this.session.http.get(`${this.session.baseUrl()}/iserv/messenger/`);

      const messengerAuthRes = await this.session.http.post(
        `${this.session.baseUrl()}/iserv/messenger/authenticate`,
        null,
        { headers: { Accept: "*/*", Origin: this.session.baseUrl() } },
      );
      const matrixData = parseJson<Record<string, unknown>>(
        messengerAuthRes.data,
        "messenger authentication",
      );
      const matrixToken = (matrixData?.access_token as string) ?? null;
      const matrixUserId = (matrixData?.user_id as string) ?? undefined;
      if (!matrixToken) throw new IServAuthError("Login failed! Could not retrieve Matrix token.");
      this.session.setMatrixToken(matrixToken, matrixUserId);

      log.info("Login successful");
    } catch (err) {
      if (err instanceof IServAuthError) throw err;
      const message = err instanceof Error ? err.message : "Unknown connection error";
      throw new IServAuthError(`Connection error: ${message}`);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.session.http.get(`${this.session.baseUrl()}/iserv/auth/logout`);
    } finally {
      this.session.clearSession();
      log.info("Logged out");
    }
  }
}
