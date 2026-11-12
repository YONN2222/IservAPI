import { describe, expect, test } from "vitest";
import { AuthService } from "../src/Auth/AuthService.js";
import { generateTotp } from "../src/Auth/totp.js";
import { IServAuthError, IServTwoFactorRequiredError } from "../src/Core/Errors.js";
import type { IServSession } from "../src/Core/IServSession.js";

type Res = { data: string; status: number; headers: Record<string, string>; url: string };
type Call = { method: "get" | "post"; url: string; body?: string | null };

const BASE = "https://iserv.example";
const page = (url: string, data = "<main></main>"): Res => ({
  data,
  status: 200,
  headers: {},
  url,
});

const LOGIN_FORM = page(
  `${BASE}/iserv/auth/login`,
  '<form><input type="text" name="_username"><input type="password" name="_password"></form>',
);
const TWO_FACTOR_FORM = page(
  `${BASE}/iserv/auth/twofactor/confirm`,
  `<form method="post">
    <input type="text" name="two_factor_login_form[two_factor_code_digit_1]">
    <input type="text" name="two_factor_login_form[two_factor_code_digit_2]">
    <input type="hidden" name="otp" value="">
    <input type="hidden" name="_csrf_token" value="csrf-2fa">
  </form>`,
);
const MESSENGER = page(
  `${BASE}/iserv/messenger/authenticate`,
  JSON.stringify({ access_token: "syt_test", user_id: "@u:iserv.example" }),
);

function session(get: Res[], post: Res[], calls: Call[]): IServSession {
  return {
    username: "alice",
    baseUrl: () => BASE,
    getPassword: () => "secret",
    setMatrixToken: () => {},
    http: {
      get: async (url: string) => {
        calls.push({ method: "get", url });
        const next = get.shift();
        if (!next) throw new Error(`Unexpected GET ${url}`);
        return next;
      },
      post: async (url: string, body?: string | null) => {
        calls.push({ method: "post", url, body });
        const next = post.shift();
        if (!next) throw new Error(`Unexpected POST ${url}`);
        return next;
      },
    },
  } as unknown as IServSession;
}

describe("generateTotp", () => {
  test("matches the RFC 6238 SHA-1 test vectors (last 6 digits)", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(generateTotp(secret, 59_000)).toBe("287082");
    expect(generateTotp(secret, 1_111_111_109_000)).toBe("081804");
    expect(generateTotp(secret, 1_234_567_890_000)).toBe("005924");
  });

  test("rejects a secret that is not Base32", () => {
    expect(() => generateTotp("not base32!")).toThrow("Base32");
  });
});

describe("AuthService.login with two-factor authentication", () => {
  test("submits the code as digits plus otp with the CSRF token", async () => {
    const calls: Call[] = [];
    const s = session(
      [LOGIN_FORM, page(`${BASE}/iserv/`), page(`${BASE}/iserv/messenger/`)],
      [TWO_FACTOR_FORM, page(`${BASE}/iserv/`), MESSENGER],
      calls,
    );

    await new AuthService(s, { twoFactorCode: "12 34 56" }).login();

    const submit = calls.find(
      (call) => call.url.endsWith("/twofactor/confirm") && call.method === "post",
    );
    expect(submit?.body).toContain("two_factor_login_form%5Btwo_factor_code_digit_1%5D=1");
    expect(submit?.body).toContain("two_factor_login_form%5Btwo_factor_code_digit_6%5D=6");
    expect(submit?.body).toContain("otp=123456");
    expect(submit?.body).toContain("_csrf_token=csrf-2fa");
  });

  test("asks a code function for the code", async () => {
    const calls: Call[] = [];
    const s = session(
      [LOGIN_FORM, page(`${BASE}/iserv/`), page(`${BASE}/iserv/messenger/`)],
      [TWO_FACTOR_FORM, page(`${BASE}/iserv/`), MESSENGER],
      calls,
    );
    await new AuthService(s, { twoFactorCode: async () => "654321" }).login();
    expect(calls.some((call) => call.body?.includes("otp=654321"))).toBe(true);
  });

  test("throws a dedicated error when no code is available", async () => {
    const calls: Call[] = [];
    const s = session([LOGIN_FORM], [TWO_FACTOR_FORM], calls);
    await expect(new AuthService(s).login()).rejects.toBeInstanceOf(IServTwoFactorRequiredError);
  });

  test("reports a wrong code when IServ shows the form again", async () => {
    const calls: Call[] = [];
    const s = session([LOGIN_FORM], [TWO_FACTOR_FORM, TWO_FACTOR_FORM], calls);
    const error = await new AuthService(s, { twoFactorCode: "000000" }).login().catch((e) => e);
    expect(error).toBeInstanceOf(IServAuthError);
    expect(error.message).toContain("Wrong two-factor code");
  });

  test("rejects a code that does not have 6 digits", async () => {
    const s = session([LOGIN_FORM], [TWO_FACTOR_FORM], []);
    await expect(new AuthService(s, { twoFactorCode: "12345" }).login()).rejects.toThrow(
      "6 digits",
    );
  });
});
