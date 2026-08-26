import { describe, expect, test, vi } from "vitest";
import { ForumService } from "../src/Forum/ForumService.js";
import { createMockIServSession } from "./helpers/mockIServSession.js";

const FORUM_LIST_HTML = `
<html><body>
<table id="forum-list">
  <tbody>
    <tr class="info"><td colspan="7"> Schulforen</td></tr>
    <tr class="read">
      <td class="list-check"></td>
      <td class="unread-marker"></td>
      <td class="title">
        <a href="/iserv/forum/1"><span class="forum-icon"><span class="fal fa-user-group"></span></span>Ankündigungen</a>
        <div class="forum-description text-secondary">
          <div><span title="Zugriff" aria-label="Zugriff für"><span class="fal fa-eye"></span></span> Gruppe A, Gruppe B</div>
          <div class="subscription-status" title="Abonnement"><span class="fal fa-mailbox-flag-up"></span> Ungelesene Beiträge hervorheben</div>
          <span class="hidden-xs">Allgemeine Ankündigungen für alle</span>
        </div>
      </td>
      <td class="text-right hidden-xs hidden-sm">3</td>
      <td class="text-right hidden-xs hidden-sm">7</td>
      <td class="text-right hidden-xs hidden-sm"></td>
      <td><a href="/iserv/forum/1/topic/10#post-100"><span class="timeAgoCalendar" data-date="2026-01-02T10:00:00+01:00">02.01.2026 10:00</span></a> von Testautor Eins</td>
    </tr>
    <tr class="info"><td colspan="7"> Gruppenforen</td></tr>
    <tr class="read">
      <td class="list-check"></td>
      <td class="unread-marker"></td>
      <td class="title">
        <a href="/iserv/forum/2"><span class="forum-icon"><span class="fal fa-user-group"></span></span>Testgruppe</a>
        <div class="forum-description text-secondary">
          <div class="subscription-status" title="Abonnement"><span class="fal fa-mailbox-flag-up"></span> Ungelesene Beiträge hervorheben</div>
          <span class="hidden-xs"></span>
        </div>
      </td>
      <td class="text-right hidden-xs hidden-sm">0</td>
      <td class="text-right hidden-xs hidden-sm">0</td>
      <td class="text-right hidden-xs hidden-sm"></td>
      <td>keiner</td>
    </tr>
  </tbody>
</table>
<input id="mark_as_read__token" value="mark-token">
</body></html>
`;

const TOPIC_LIST_HTML = `
<html><body>
<div id="topic-list">
  <h1><span class="forum-icon"><span class="fal fa-user-group"></span></span>Ankündigungen</h1>
</div>
<table id="topic-table">
  <tbody>
    <tr class="read">
      <td class="unread-marker"></td>
      <td class="title"><a class="topic-title" href="/iserv/forum/1/topic/10#new-entry-0">Willkommen im Forum</a></td>
      <td class="author">Testautor Eins</td>
      <td class="hidden-xs hidden-sm hidden-md text-right">2</td>
      <td class="hidden-xs hidden-sm hidden-md text-right"></td>
      <td><a href="/iserv/forum/1/topic/10#post-100"><span class="timeAgoCalendar" data-date="2026-01-02T10:00:00+01:00">02.01.2026 10:00</span></a> von Testautor Zwei</td>
    </tr>
  </tbody>
</table>
<nav><ul class="pagination">
  <li><a href="/iserv/forum/1" title="Seite 1">1</a></li>
  <li class="active"><a href="/iserv/forum/1/2" title="Seite 2">2</a></li>
</ul></nav>
<input id="mark_as_read__token" value="mark-token">
</body></html>
`;

const TOPIC_HTML = `
<html><body>
<div id="forum-topic">
  <h1 id="topic-title">
    Willkommen im Forum
    <small class="topic-pinned hidden"><span class="label label-info">angeheftet</span></small>
    <small class="topic-closed hidden"><span class="label label-info">geschlossen</span></small>
    <small class="topic-deleted hidden"><span class="label label-info">gelöscht</span></small>
  </h1>
  <div class="post-container" data-level="0">
    <div class="post level0" id="post-100">
      <div class="post-wrapper">
        <div class="post-header">
          <div class="post-meta">
            <h4><span class="post-author">Testautor Eins</span></h4>
            <div class="post-info"><span class="post-time"><span class="timeAgoCalendar" data-date="2026-01-02T10:00:00+01:00">02.01.2026 10:00</span></span></div>
          </div>
        </div>
        <div class="post-body">
          <div class="post-content-wrapper">
            <div class="post-content" data-text="Hallo und willkommen im Testforum.">
              <p>Hallo und willkommen im Testforum.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>
`;

describe("ForumService", () => {
  test("listForums parses categories, forums, counts and last post", async () => {
    const { session, expectAllRoutesCalled } = createMockIServSession({
      routes: [
        {
          method: "get",
          url: "https://iserv.example/iserv/forums",
          response: { data: FORUM_LIST_HTML },
        },
      ],
    });

    const forums = await new ForumService(session).listForums();

    expect(forums).toHaveLength(2);

    expect(forums[0]).toEqual({
      id: 1,
      title: "Ankündigungen",
      description: "Allgemeine Ankündigungen für alle",
      category: "Schulforen",
      access: ["Gruppe A", "Gruppe B"],
      topicCount: 3,
      postCount: 7,
      unreadCount: null,
      lastPost: {
        url: "/iserv/forum/1/topic/10#post-100",
        date: "2026-01-02T10:00:00+01:00",
        author: "Testautor Eins",
      },
    });

    expect(forums[1]).toEqual({
      id: 2,
      title: "Testgruppe",
      description: "",
      category: "Gruppenforen",
      access: [],
      topicCount: 0,
      postCount: 0,
      unreadCount: null,
      lastPost: null,
    });

    expectAllRoutesCalled();
  });

  test("listTopics parses topic rows and pagination", async () => {
    const { session, expectAllRoutesCalled } = createMockIServSession({
      routes: [
        {
          method: "get",
          url: "https://iserv.example/iserv/forum/1",
          response: { data: TOPIC_LIST_HTML },
        },
      ],
    });

    const result = await new ForumService(session).listTopics(1);

    expect(result.forumId).toBe(1);
    expect(result.forumTitle).toBe("Ankündigungen");
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0]).toEqual({
      id: 10,
      forumId: 1,
      title: "Willkommen im Forum",
      url: "/iserv/forum/1/topic/10#new-entry-0",
      author: "Testautor Eins",
      postCount: 2,
      unreadCount: null,
      lastPost: {
        url: "/iserv/forum/1/topic/10#post-100",
        date: "2026-01-02T10:00:00+01:00",
        author: "Testautor Zwei",
      },
      read: true,
    });

    expectAllRoutesCalled();
  });

  test("listTopics requests the page-numbered path when page > 1", async () => {
    const { session, expectAllRoutesCalled } = createMockIServSession({
      routes: [
        {
          method: "get",
          url: "https://iserv.example/iserv/forum/1/2",
          response: { data: TOPIC_LIST_HTML },
        },
      ],
    });

    await new ForumService(session).listTopics(1, 2);
    expectAllRoutesCalled();
  });

  test("getTopic parses title flags and posts", async () => {
    const { session, expectAllRoutesCalled } = createMockIServSession({
      routes: [
        {
          method: "get",
          url: "https://iserv.example/iserv/forum/1/topic/10",
          response: { data: TOPIC_HTML },
        },
      ],
    });

    const topic = await new ForumService(session).getTopic(1, 10);

    expect(topic.id).toBe(10);
    expect(topic.forumId).toBe(1);
    expect(topic.title).toBe("Willkommen im Forum");
    expect(topic.pinned).toBe(false);
    expect(topic.closed).toBe(false);
    expect(topic.deleted).toBe(false);
    expect(topic.posts).toHaveLength(1);
    expect(topic.posts[0]).toEqual({
      id: 100,
      level: 0,
      author: "Testautor Eins",
      date: "2026-01-02T10:00:00+01:00",
      contentHtml: "<p>Hallo und willkommen im Testforum.</p>",
      contentText: "Hallo und willkommen im Testforum.",
    });

    expectAllRoutesCalled();
  });

  test("markAllAsRead fetches the CSRF token then posts the read-all form", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T10:00:00.000Z"));

    const { session, expectAllRoutesCalled } = createMockIServSession({
      routes: [
        {
          method: "get",
          url: "https://iserv.example/iserv/forums",
          response: { data: '<input id="mark_as_read__token" value="mark-token">' },
        },
        {
          method: "post",
          url: "https://iserv.example/iserv/forum/read",
          body: new URLSearchParams({ "mark_as_read[_token]": "mark-token" }).toString(),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          params: { date: "2026-01-02T10:00:00.000Z" },
          response: { data: "" },
        },
      ],
    });

    try {
      await new ForumService(session).markAllAsRead();
      expectAllRoutesCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  test("markForumAsRead fetches the CSRF token then posts the per-forum read form", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T10:00:00.000Z"));

    const { session, expectAllRoutesCalled } = createMockIServSession({
      routes: [
        {
          method: "get",
          url: "https://iserv.example/iserv/forum/1",
          response: { data: '<input id="mark_as_read__token" value="mark-token">' },
        },
        {
          method: "post",
          url: "https://iserv.example/iserv/forum/read/all/1",
          body: new URLSearchParams({ "mark_as_read[_token]": "mark-token" }).toString(),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          params: { date: "2026-01-02T10:00:00.000Z" },
          response: { data: "" },
        },
      ],
    });

    try {
      await new ForumService(session).markForumAsRead(1);
      expectAllRoutesCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  describe("input validation", () => {
    test("listTopics rejects non-positive forumId", async () => {
      const { session } = createMockIServSession({ routes: [] });
      await expect(new ForumService(session).listTopics(0)).rejects.toThrow(
        "forumId must be a positive integer",
      );
    });

    test("listTopics rejects non-positive page", async () => {
      const { session } = createMockIServSession({ routes: [] });
      await expect(new ForumService(session).listTopics(1, 0)).rejects.toThrow(
        "page must be a positive integer",
      );
    });

    test("getTopic rejects non-positive topicId", async () => {
      const { session } = createMockIServSession({ routes: [] });
      await expect(new ForumService(session).getTopic(1, -1)).rejects.toThrow(
        "topicId must be a positive integer",
      );
    });

    test("markForumAsRead rejects non-positive forumId", async () => {
      const { session } = createMockIServSession({ routes: [] });
      await expect(new ForumService(session).markForumAsRead(0)).rejects.toThrow(
        "forumId must be a positive integer",
      );
    });
  });
});
