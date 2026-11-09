import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as cheerio from "cheerio";
import { IServApiError } from "../Core/Errors.js";
import { parseJson } from "../Core/HttpClient.js";
import type { IServSession } from "../Core/IServSession.js";
import { createLogger } from "../Core/Logger.js";
import type {
  DirectoryUser,
  SetUserInfoOptions,
  UserAutocompleteResult,
  UserInfo,
  UserPublicInfo,
} from "./UserTypes.js";

const log = createLogger("User");

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

const DEFAULT_DIRECTORY_LIMIT = 50;
const SHORT_CODE_PATTERN = /^[A-ZÄÖÜ0-9]{2,6}$/;
const FUZZY_MATCH_MARKER = "Ähnlicher Name";

/** Splits IServ's autocomplete `extra` field ("HMS, Lehrer") into short code and roles. */
export function parseAutocompleteExtra(extra: string): {
  shortCode: string | null;
  roles: string[];
} {
  const parts = extra
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "" && part !== FUZZY_MATCH_MARKER);
  const [first, ...rest] = parts;
  if (first !== undefined && SHORT_CODE_PATTERN.test(first)) {
    return { shortCode: first, roles: rest };
  }
  return { shortCode: null, roles: parts };
}

function toDirectoryUser(result: UserAutocompleteResult): DirectoryUser {
  const match = /^(.*?)\s*<([^>]+)>$/.exec(result.text);
  const { shortCode, roles } = parseAutocompleteExtra(result.extra);
  return { name: match?.[1] || result.text, email: match?.[2] ?? "", shortCode, roles };
}

function readInput($: cheerio.CheerioAPI, id: string): string {
  return ($(`#${id}`).val() as string | undefined) ?? "";
}

function imageExtension(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP")
    return "webp";
  return "bin";
}

export class UserService {
  constructor(private readonly session: IServSession) {}

  async getOwnInfo(): Promise<UserInfo> {
    const base = this.session.baseUrl();

    const [accountRes, editRes] = await Promise.all([
      this.session.http.get(`${base}/iserv/account/my`),
      this.session.http.get(`${base}/iserv/profile/public/edit`),
    ]);

    const $profile = cheerio.load(accountRes.data as string);

    const groups: Record<string, string> = {};
    $profile("#userGroups .accordion-item").each((_, el) => {
      const name = $profile(el).find(".accordion-button").first().text().trim();
      const detailsUrl =
        $profile(el)
          .find("[data-content-loader-url-value]")
          .attr("data-content-loader-url-value") ?? "";
      if (name) groups[name] = detailsUrl;
    });

    const roles: string[] = [];
    $profile("#user-account .account-badge").each((_, el) => {
      const role = $profile(el).text().trim();
      if (role) roles.push(role);
    });

    const rights: string[] = [];
    $profile("#userPrivileges .accordion-item").each((_, el) => {
      const right = $profile(el).find(".accordion-button").first().text().trim();
      if (right) rights.push(right);
    });

    const $edit = cheerio.load(editRes.data as string);

    const publicInfo: UserPublicInfo = {
      title: readInput($edit, "publiccontact_title"),
      company: readInput($edit, "publiccontact_company"),
      birthday: readInput($edit, "publiccontact_birthday"),
      nickname: readInput($edit, "publiccontact_nickname"),
      class: readInput($edit, "publiccontact_class"),
      street: readInput($edit, "publiccontact_street"),
      zipcode: readInput($edit, "publiccontact_zipcode"),
      city: readInput($edit, "publiccontact_city"),
      country: readInput($edit, "publiccontact_country"),
      icq: readInput($edit, "publiccontact_icq"),
      jabber: readInput($edit, "publiccontact_jabber"),
      msn: readInput($edit, "publiccontact_msn"),
      skype: readInput($edit, "publiccontact_skype"),
      note: $edit("#publiccontact_note").text(),
      hidden: ($edit("#publiccontact_hidden").val() as string) === "1",
      phone: readInput($edit, "publiccontact_phone"),
      mobilePhone: readInput($edit, "publiccontact_mobilePhone"),
      fax: readInput($edit, "publiccontact_fax"),
      mail: readInput($edit, "publiccontact_mail"),
      homepage: readInput($edit, "publiccontact_homepage"),
    };

    const name = $profile("#user-account h2").first().text().trim();
    const email = $profile("#user-account a[href^='mailto:']").first().text().trim();

    log.info("Got own user info");
    return { name, email, Groups: groups, Roles: roles, Rights: rights, PublicInfo: publicInfo };
  }

  private async fetchCsrfToken(): Promise<string> {
    const res = await this.session.http.get(
      `${this.session.baseUrl()}/iserv/profile/public/edit#contact`,
    );
    const $contact = cheerio.load(res.data as string);
    const token = ($contact("#publiccontact__token").val() as string | undefined) ?? "";
    if (!token) throw new IServApiError("Could not retrieve CSRF token", 500);
    return token;
  }

  async setOwnInfo(settings: SetUserInfoOptions): Promise<number> {
    if (
      settings.mail !== undefined &&
      settings.mail !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.mail)
    ) {
      throw new IServApiError(`Invalid email address: "${settings.mail}"`, 400);
    }
    if (settings.hidden !== undefined && typeof settings.hidden !== "boolean") {
      throw new IServApiError(`hidden must be a boolean, got: "${settings.hidden}"`, 400);
    }
    if (settings.icq !== undefined && settings.icq !== "" && !/^\d+$/.test(settings.icq)) {
      throw new IServApiError(`ICQ number must contain only digits: "${settings.icq}"`, 400);
    }

    const [userInfo, token] = await Promise.all([this.getOwnInfo(), this.fetchCsrfToken()]);
    const pi = userInfo.PublicInfo;

    const data = new URLSearchParams({
      "publiccontact[title]": settings.title ?? pi.title,
      "publiccontact[company]": settings.company ?? pi.company,
      "publiccontact[birthday]": settings.birthday ?? pi.birthday,
      "publiccontact[nickname]": settings.nickname ?? pi.nickname,
      "publiccontact[class]": settings.schoolClass ?? pi.class,
      "publiccontact[street]": settings.street ?? pi.street,
      "publiccontact[zipcode]": settings.zipcode ?? pi.zipcode,
      "publiccontact[city]": settings.city ?? pi.city,
      "publiccontact[country]": settings.country ?? pi.country,
      "publiccontact[phone]": settings.phone ?? pi.phone,
      "publiccontact[mobilePhone]": settings.mobilePhone ?? pi.mobilePhone,
      "publiccontact[fax]": settings.fax ?? pi.fax,
      "publiccontact[mail]": settings.mail ?? pi.mail,
      "publiccontact[homepage]": settings.homepage ?? pi.homepage,
      "publiccontact[icq]": settings.icq ?? pi.icq,
      "publiccontact[jabber]": settings.jabber ?? pi.jabber,
      "publiccontact[msn]": settings.msn ?? pi.msn,
      "publiccontact[skype]": settings.skype ?? pi.skype,
      "publiccontact[note]": settings.note ?? pi.note,
      "publiccontact[hidden]": (settings.hidden ?? pi.hidden) ? "1" : "0",
      "publiccontact[actions][submit]": "",
      "publiccontact[_token]": token,
    });

    const res = await this.session.http.post(
      `${this.session.baseUrl()}/iserv/profile/public/edit`,
      data.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    log.info("Public info updated");
    return res.status;
  }

  async getInfo(username: string): Promise<Record<string, string>> {
    if (!USERNAME_PATTERN.test(username)) {
      throw new IServApiError("Invalid username format", 400);
    }
    const res = await this.session.http.get(
      `${this.session.baseUrl()}/iserv/addressbook/public/show/${username}`,
    );
    const $ = cheerio.load(res.data as string);
    const table = $("table");
    if (!table.length) throw new IServApiError(`User "${username}" not found`, 404);

    const data: Record<string, string> = {};
    table.find("tr").each((_, row) => {
      const cells = $(row).find("td");
      const key = cells.eq(0).text().trim();
      const value = cells.eq(1).text().trim();
      if (key) data[key] = value;
    });

    log.info(`Got info for user ${username}`);
    return data;
  }

  async search(query: string): Promise<Array<{ name: string; userUrl: string }>> {
    const encoded = encodeURIComponent(query);
    const res = await this.session.http.get(
      `${this.session.baseUrl()}/iserv/addressbook/public?filter%5Bsearch%5D=${encoded}`,
    );
    const body = res.data as string;

    if (body.includes("Too many results") || body.includes("Zu viele Treffer")) {
      throw new IServApiError("Too many results, please restrict filter criteria!", 400);
    }

    const $ = cheerio.load(body);
    const results: Array<{ name: string; userUrl: string }> = [];

    $("table tbody tr").each((_, row) => {
      const a = $(row).find("a").first();
      if (a.length) {
        results.push({ name: a.text().trim(), userUrl: a.attr("href") ?? "" });
      }
    });

    log.info("Searched users");
    return results;
  }

  async searchAutocomplete(query: string, limit = 50): Promise<UserAutocompleteResult[]> {
    const res = await this.session.http.get(
      `${this.session.baseUrl()}/iserv/core/autocomplete/api`,
      { params: { type: "list,mail", query, limit } },
    );
    log.info("Searched users (autocomplete)");
    return parseJson<UserAutocompleteResult[]>(res.data, "user autocomplete");
  }

  async searchDirectory(query: string, limit = DEFAULT_DIRECTORY_LIMIT): Promise<DirectoryUser[]> {
    const results = await this.searchAutocomplete(query, limit);
    return results.filter((r) => r.source === "user").map(toDirectoryUser);
  }

  async searchMessengerRecipients(query: string, limit = 10): Promise<UserAutocompleteResult[]> {
    const res = await this.session.http.get(
      `${this.session.baseUrl()}/iserv/autocomplete/api/autocomplete`,
      { params: { type: "userid", query, limit } },
    );
    log.info("Searched messenger recipients");
    return parseJson<UserAutocompleteResult[]>(res.data, "messenger recipient autocomplete");
  }

  async getProfilePictureBuffer(
    username: string,
    width?: number,
    height?: number,
  ): Promise<Buffer> {
    if (!USERNAME_PATTERN.test(username)) {
      throw new IServApiError("Invalid username format", 400);
    }

    if (width !== undefined && (!Number.isInteger(width) || width <= 0 || width > 4096)) {
      throw new IServApiError("width must be a positive integer <= 4096", 400);
    }
    if (height !== undefined && (!Number.isInteger(height) || height <= 0 || height > 4096)) {
      throw new IServApiError("height must be a positive integer <= 4096", 400);
    }

    const url =
      width !== undefined && height !== undefined
        ? `${this.session.baseUrl()}/iserv/addressbook/public/image/${username}/photo/${width}/${height}`
        : `${this.session.baseUrl()}/iserv/core/avatar/user/${username}`;

    const res = await this.session.http.get(url, { responseType: "arraybuffer" });

    const buffer = res.data as Buffer;
    const contentType = String(res.headers["content-type"] ?? "");
    if (contentType.includes("svg") || buffer.toString("utf8", 0, 200).includes("<svg")) {
      throw new IServApiError("SVG profile pictures are not supported", 422);
    }

    log.info(`Got profile picture buffer for ${username}`);
    return buffer;
  }

  async getOwnProfilePictureBuffer(width?: number, height?: number): Promise<Buffer> {
    return this.getProfilePictureBuffer(this.session.username, width, height);
  }

  async getProfilePicture(username: string, outputFolder: string): Promise<void> {
    const resolvedFolder = path.resolve(outputFolder);
    const buffer = await this.getProfilePictureBuffer(username);
    const ext = imageExtension(buffer);

    const filePath = path.join(resolvedFolder, `${username}.${ext}`);
    if (!filePath.startsWith(resolvedFolder)) {
      throw new IServApiError("Path traversal detected", 400);
    }

    await fs.writeFile(filePath, buffer);
    log.info(`Saved profile picture for ${username} to ${filePath}`);
  }
}
