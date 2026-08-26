import type { Cheerio, CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { IServApiError } from "../Core/Errors.js";
import type { IServSession } from "../Core/IServSession.js";
import { createLogger } from "../Core/Logger.js";
import type {
  ForumLastPost,
  ForumListItem,
  ForumPost,
  Topic,
  TopicListItem,
  TopicListResult,
} from "./ForumTypes.js";

const log = createLogger("Forum");

function requirePositiveInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new IServApiError(`${name} must be a positive integer`, 400);
  }
}

function parseCount(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const num = parseInt(trimmed, 10);
  return Number.isNaN(num) ? null : num;
}

function parseIdFromHref(href: string | undefined, pattern: RegExp): number | null {
  if (!href) return null;
  const match = href.match(pattern);
  if (!match?.[1]) return null;
  const id = parseInt(match[1], 10);
  return Number.isNaN(id) ? null : id;
}

function parseLastPostCell(_$: CheerioAPI, cell: Cheerio<Element>): ForumLastPost | null {
  const link = cell.find("a").first();
  if (!link.length) return null;

  const url = link.attr("href") ?? "";
  const date = link.find("span.timeAgoCalendar").attr("data-date") ?? "";
  const fullText = cell.text().replace(/\s+/g, " ").trim();
  const author = fullText.includes(" von ") ? (fullText.split(" von ").pop() ?? "").trim() : "";

  return { url, date, author };
}

function parseForumList(html: string): ForumListItem[] {
  const $ = cheerio.load(html);
  const forums: ForumListItem[] = [];
  let currentCategory = "";

  $("#forum-list > tbody > tr").each((_, row) => {
    const $row = $(row);

    if ($row.hasClass("info")) {
      currentCategory = $row.find("td").first().text().trim();
      return;
    }

    const titleCell = $row.find("td.title");
    const link = titleCell.find("a").first();
    if (!link.length) return;

    const id = parseIdFromHref(link.attr("href"), /\/iserv\/forum\/(\d+)$/);
    if (id === null) return;

    const title = link.clone().find("span").remove().end().text().trim();

    const descriptionWrap = titleCell.find(".forum-description");
    const description = descriptionWrap.find("span.hidden-xs").first().text().trim();

    let access: string[] = [];
    descriptionWrap.find("> div").each((_, div) => {
      const $div = $(div);
      if ($div.find('span[title="Zugriff"]').length) {
        access = $div
          .clone()
          .find("span")
          .remove()
          .end()
          .text()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    });

    const countCells = $row.find("td.text-right.hidden-xs.hidden-sm");
    const topicCount = parseCount(countCells.eq(0).text()) ?? 0;
    const postCount = parseCount(countCells.eq(1).text()) ?? 0;
    const unreadCount = parseCount(countCells.eq(2).text());

    const lastPostCell = $row.find("td").last();
    const lastPost = parseLastPostCell($, lastPostCell);

    forums.push({
      id,
      title,
      description,
      category: currentCategory,
      access,
      topicCount,
      postCount,
      unreadCount,
      lastPost,
    });
  });

  return forums;
}

function parseTopicList(html: string, forumId: number): TopicListResult {
  const $ = cheerio.load(html);

  const forumTitle = $("#topic-list h1").clone().find("span").remove().end().text().trim();

  const topics: TopicListItem[] = [];
  $("#topic-table > tbody > tr").each((_, row) => {
    const $row = $(row);
    const link = $row.find("a.topic-title").first();
    if (!link.length) return;

    const id = parseIdFromHref(link.attr("href"), /\/topic\/(\d+)/);
    if (id === null) return;

    const title = link.text().trim();
    const url = link.attr("href") ?? "";
    const author = $row.find("td.author").text().trim();

    const countCells = $row.find("td.hidden-xs.hidden-sm.hidden-md.text-right");
    const postCount = parseCount(countCells.eq(0).text()) ?? 0;
    const unreadCount = parseCount(countCells.eq(1).text());

    const lastPostCell = $row.find("td").last();
    const lastPost = parseLastPostCell($, lastPostCell);
    const read = $row.hasClass("read");

    topics.push({
      id,
      forumId,
      title,
      url,
      author,
      postCount,
      unreadCount,
      lastPost,
      read,
    });
  });

  let totalPages = 1;
  $(".pagination li a").each((_, a) => {
    const num = parseInt($(a).text().trim(), 10);
    if (!Number.isNaN(num) && num > totalPages) totalPages = num;
  });
  let page = 1;
  const activePage = $(".pagination li.active a").text().trim();
  const activeNum = parseInt(activePage, 10);
  if (!Number.isNaN(activeNum)) page = activeNum;

  return { forumId, forumTitle, topics, page, totalPages };
}

function parseTopic(html: string, forumId: number, topicId: number): Topic {
  const $ = cheerio.load(html);

  const title = $("#topic-title")
    .clone()
    .find(".topic-pinned, .topic-closed, .topic-deleted")
    .remove()
    .end()
    .text()
    .trim();

  const pinned = !$(".topic-pinned").hasClass("hidden");
  const closed = !$(".topic-closed").hasClass("hidden");
  const deleted = !$(".topic-deleted").hasClass("hidden");

  const posts: ForumPost[] = [];
  $(".post[id^=post-]").each((_, el) => {
    const $post = $(el);
    const rawId = ($post.attr("id") ?? "").replace("post-", "");
    const id = parseInt(rawId, 10);
    if (Number.isNaN(id)) return;

    const levelAttr = $post.closest(".post-container").attr("data-level");
    const level = levelAttr ? parseInt(levelAttr, 10) : 0;

    const author = $post.find(".post-author").first().text().trim();
    const date = $post.find(".post-time .timeAgoCalendar").first().attr("data-date") ?? "";

    const contentEl = $post.find(".post-content").first();
    const contentHtml = (contentEl.html() ?? "").trim();
    const contentText = contentEl.attr("data-text") ?? "";

    posts.push({ id, level, author, date, contentHtml, contentText });
  });

  return { id: topicId, forumId, title, pinned, closed, deleted, posts };
}

export class ForumService {
  constructor(private readonly session: IServSession) {}

  async listForums(): Promise<ForumListItem[]> {
    const res = await this.session.http.get(`${this.session.baseUrl()}/iserv/forums`);
    log.info("Got forum list");
    return parseForumList(res.data as string);
  }

  async listTopics(forumId: number, page?: number): Promise<TopicListResult> {
    requirePositiveInt(forumId, "forumId");
    if (page !== undefined) requirePositiveInt(page, "page");

    const res = await this.session.http.get(
      page && page > 1
        ? `${this.session.baseUrl()}/iserv/forum/${forumId}/${page}`
        : `${this.session.baseUrl()}/iserv/forum/${forumId}`,
    );
    log.info(`Got topic list for forum ${forumId}`);
    return parseTopicList(res.data as string, forumId);
  }

  async getTopic(forumId: number, topicId: number): Promise<Topic> {
    requirePositiveInt(forumId, "forumId");
    requirePositiveInt(topicId, "topicId");

    const res = await this.session.http.get(
      `${this.session.baseUrl()}/iserv/forum/${forumId}/topic/${topicId}`,
    );
    log.info(`Got topic ${topicId} in forum ${forumId}`);
    return parseTopic(res.data as string, forumId, topicId);
  }

  async markAllAsRead(): Promise<void> {
    const listRes = await this.session.http.get(`${this.session.baseUrl()}/iserv/forums`);
    const $ = cheerio.load(listRes.data as string);
    const token = $("#mark_as_read__token").val() as string | undefined;
    if (!token) throw new IServApiError("Could not retrieve CSRF token for mark as read", 500);

    await this.session.http.post(
      `${this.session.baseUrl()}/iserv/forum/read`,
      new URLSearchParams({ "mark_as_read[_token]": token }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        params: { date: new Date().toISOString() },
      },
    );
    log.info("Marked all forums as read");
  }

  async markForumAsRead(forumId: number): Promise<void> {
    requirePositiveInt(forumId, "forumId");

    const forumRes = await this.session.http.get(
      `${this.session.baseUrl()}/iserv/forum/${forumId}`,
    );
    const $ = cheerio.load(forumRes.data as string);
    const token = $("#mark_as_read__token").val() as string | undefined;
    if (!token) throw new IServApiError("Could not retrieve CSRF token for mark as read", 500);

    await this.session.http.post(
      `${this.session.baseUrl()}/iserv/forum/read/all/${forumId}`,
      new URLSearchParams({ "mark_as_read[_token]": token }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        params: { date: new Date().toISOString() },
      },
    );
    log.info(`Marked forum ${forumId} as read`);
  }
}
