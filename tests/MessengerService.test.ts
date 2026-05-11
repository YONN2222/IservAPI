import { describe, expect, test } from "vitest";
import { MessengerService } from "../src/Messenger/MessengerService.js";
import { createMockIServSession } from "./helpers/mockIServSession.js";

const MATRIX_BASE = "https://iserv.example/_matrix/client/v3";
const MATRIX_TOKEN = "syt_test_token_abc";

function buildMockSession(routes: Parameters<typeof createMockIServSession>[0]["routes"]) {
  const { session, ...rest } = createMockIServSession({ routes });
  session.setMatrixToken(MATRIX_TOKEN);
  return { session, ...rest };
}

const SYNC_FILTER = JSON.stringify({
  room: { timeline: { limit: 1 } },
});

describe("MessengerService.getRooms()", () => {
  test("returns parsed rooms from sync response", async () => {
    const syncResponse = JSON.stringify({
      next_batch: "s123",
      rooms: {
        join: {
          "!room1:server": {
            timeline: {
              events: [
                {
                  type: "m.room.message",
                  sender: "@alice:server",
                  event_id: "$ev1",
                  origin_server_ts: 1700000000000,
                  content: { msgtype: "m.text", body: "Hello!" },
                },
              ],
            },
            state: {
              events: [
                { type: "m.room.name", content: { name: "Test Room" } },
                {
                  type: "m.room.member",
                  state_key: "@alice:server",
                  content: { membership: "join", displayname: "Alice" },
                },
              ],
            },
            unread_notifications: { notification_count: 3 },
          },
        },
      },
      account_data: { events: [] },
    });

    const { session, expectAllRoutesCalled } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/sync`,
        params: { filter: SYNC_FILTER, timeout: 0 },
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: syncResponse },
      },
    ]);

    const rooms = await new MessengerService(session).getRooms();

    expect(rooms).toHaveLength(1);
    expect(rooms[0].id).toBe("!room1:server");
    expect(rooms[0].name).toBe("Test Room");
    expect(rooms[0].unreadCount).toBe(3);
    expect(rooms[0].isDirect).toBe(false);
    expect(rooms[0].lastMessage?.body).toBe("Hello!");
    expect(rooms[0].lastMessage?.sender).toBe("@alice:server");
    expect(rooms[0].lastMessage?.senderName).toBe("Alice");
    expect(rooms[0].lastMessage?.timestamp).toBe(1700000000000);
    expectAllRoutesCalled();
  });

  test("marks room as direct when roomId is in m.direct account_data", async () => {
    const syncResponse = JSON.stringify({
      next_batch: "s124",
      rooms: {
        join: {
          "!dm:server": {
            timeline: { events: [] },
            state: { events: [] },
            unread_notifications: {},
          },
        },
      },
      account_data: {
        events: [{ type: "m.direct", content: { "@bob:server": ["!dm:server"] } }],
      },
    });

    const { session, expectAllRoutesCalled } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/sync`,
        params: { filter: SYNC_FILTER, timeout: 0 },
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: syncResponse },
      },
    ]);

    const rooms = await new MessengerService(session).getRooms();
    expect(rooms[0].isDirect).toBe(true);
    expectAllRoutesCalled();
  });

  test("returns null lastMessage when no message events in timeline", async () => {
    const syncResponse = JSON.stringify({
      next_batch: "s125",
      rooms: {
        join: {
          "!empty:server": {
            timeline: { events: [{ type: "m.room.member", content: {}, sender: "@x:s" }] },
            state: { events: [] },
            unread_notifications: {},
          },
        },
      },
      account_data: { events: [] },
    });

    const { session, expectAllRoutesCalled } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/sync`,
        params: { filter: SYNC_FILTER, timeout: 0 },
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: syncResponse },
      },
    ]);

    const rooms = await new MessengerService(session).getRooms();
    expect(rooms[0].lastMessage).toBeNull();
    expectAllRoutesCalled();
  });

  test("uses roomId as name when no m.room.name state event exists", async () => {
    const syncResponse = JSON.stringify({
      next_batch: "s126",
      rooms: {
        join: {
          "!noname:server": {
            timeline: { events: [] },
            state: { events: [] },
            unread_notifications: {},
          },
        },
      },
      account_data: { events: [] },
    });

    const { session } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/sync`,
        params: { filter: SYNC_FILTER, timeout: 0 },
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: syncResponse },
      },
    ]);

    const rooms = await new MessengerService(session).getRooms();
    expect(rooms[0].name).toBe("!noname:server");
  });
});

describe("MessengerService.getMessages()", () => {
  const ROOM_ID = "!testroom:server";
  const ENCODED_ROOM = encodeURIComponent(ROOM_ID);
  const MESSAGES_FILTER = JSON.stringify({ lazy_load_members: true });

  test("returns parsed messages and pagination tokens", async () => {
    const response = JSON.stringify({
      start: "t1",
      end: "t2",
      state: [
        {
          type: "m.room.member",
          state_key: "@alice:server",
          content: { membership: "join", displayname: "Alice" },
        },
      ],
      chunk: [
        {
          type: "m.room.message",
          event_id: "$ev1",
          sender: "@alice:server",
          origin_server_ts: 1700000001000,
          content: { msgtype: "m.text", body: "Hi there" },
        },
        {
          type: "m.room.encrypted",
          event_id: "$ev2",
          sender: "@bob:server",
          origin_server_ts: 1700000002000,
          content: { algorithm: "m.megolm.v1.aes-sha2" },
        },
      ],
    });

    const { session, expectAllRoutesCalled } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/rooms/${ENCODED_ROOM}/messages`,
        params: { limit: 30, dir: "b", filter: MESSAGES_FILTER },
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: response },
      },
    ]);

    const result = await new MessengerService(session).getMessages(ROOM_ID);

    expect(result.start).toBe("t1");
    expect(result.end).toBe("t2");
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].eventId).toBe("$ev1");
    expect(result.messages[0].body).toBe("Hi there");
    expect(result.messages[0].msgtype).toBe("m.text");
    expect(result.messages[0].encrypted).toBe(false);
    expect(result.messages[0].senderName).toBe("Alice");
    expect(result.messages[1].encrypted).toBe(true);
    expect(result.messages[1].body).toBe("");
    expect(result.messages[1].senderName).toBeNull();
    expectAllRoutesCalled();
  });

  test("passes custom limit and from token", async () => {
    const response = JSON.stringify({ start: "t5", end: "t6", chunk: [] });

    const { session, expectAllRoutesCalled } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/rooms/${ENCODED_ROOM}/messages`,
        params: { limit: 10, dir: "b", filter: MESSAGES_FILTER, from: "t5" },
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: response },
      },
    ]);

    const result = await new MessengerService(session).getMessages(ROOM_ID, {
      limit: 10,
      from: "t5",
    });

    expect(result.messages).toHaveLength(0);
    expectAllRoutesCalled();
  });
});

describe("MessengerService.getMembers()", () => {
  const ROOM_ID = "!testroom:server";
  const ENCODED_ROOM = encodeURIComponent(ROOM_ID);

  test("returns parsed members excluding left users", async () => {
    const response = JSON.stringify({
      chunk: [
        {
          type: "m.room.member",
          state_key: "@alice:server",
          content: { membership: "join", displayname: "Alice", avatar_url: "mxc://server/abc" },
        },
        {
          type: "m.room.member",
          state_key: "@bob:server",
          content: { membership: "invite", displayname: "Bob", avatar_url: null },
        },
      ],
    });

    const { session, expectAllRoutesCalled } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/rooms/${ENCODED_ROOM}/members`,
        params: { not_membership: "leave" },
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: response },
      },
    ]);

    const members = await new MessengerService(session).getMembers(ROOM_ID);

    expect(members).toHaveLength(2);
    expect(members[0].userId).toBe("@alice:server");
    expect(members[0].displayName).toBe("Alice");
    expect(members[0].avatarUrl).toBe("mxc://server/abc");
    expect(members[0].membership).toBe("join");
    expect(members[1].userId).toBe("@bob:server");
    expect(members[1].membership).toBe("invite");
    expect(members[1].avatarUrl).toBeNull();
    expectAllRoutesCalled();
  });
});

describe("MessengerService.getProfile()", () => {
  test("returns parsed user profile", async () => {
    const userId = "@alice:server";
    const encodedUserId = encodeURIComponent(userId);
    const response = JSON.stringify({ displayname: "Alice Smith", avatar_url: "mxc://server/xyz" });

    const { session, expectAllRoutesCalled } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/profile/${encodedUserId}`,
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: response },
      },
    ]);

    const profile = await new MessengerService(session).getProfile(userId);

    expect(profile.userId).toBe(userId);
    expect(profile.displayName).toBe("Alice Smith");
    expect(profile.avatarUrl).toBe("mxc://server/xyz");
    expectAllRoutesCalled();
  });

  test("returns nulls for missing optional profile fields", async () => {
    const userId = "@anon:server";
    const encodedUserId = encodeURIComponent(userId);

    const { session } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/profile/${encodedUserId}`,
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: JSON.stringify({}) },
      },
    ]);

    const profile = await new MessengerService(session).getProfile(userId);

    expect(profile.displayName).toBeNull();
    expect(profile.avatarUrl).toBeNull();
  });
});

describe("MessengerService.sendMessage()", () => {
  const ROOM_ID = "!testroom:server";
  const ENCODED_ROOM = encodeURIComponent(ROOM_ID);

  test("posts to the correct Matrix endpoint and returns the event ID", async () => {
    const { session, calls, expectAllRoutesCalled } = buildMockSession([
      {
        method: "put",
        url: `${MATRIX_BASE}/rooms/${ENCODED_ROOM}/send/m.room.message/test-txn`,
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}`, "Content-Type": "application/json" },
        response: { data: JSON.stringify({ event_id: "$abc123:server" }) },
      },
    ]);

    const result = await new MessengerService(session).sendMessage(ROOM_ID, "Hello!", "test-txn");

    expect(result.eventId).toBe("$abc123:server");
    expect(calls[0]?.body).toBe(JSON.stringify({ msgtype: "m.text", body: "Hello!" }));
    expectAllRoutesCalled();
  });

  test("encodes custom transaction IDs as URL path segments", async () => {
    const txnId = "test/txn?with#chars";
    const { session, expectAllRoutesCalled } = buildMockSession([
      {
        method: "put",
        url: `${MATRIX_BASE}/rooms/${ENCODED_ROOM}/send/m.room.message/${encodeURIComponent(txnId)}`,
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}`, "Content-Type": "application/json" },
        response: { data: JSON.stringify({ event_id: "$abc123:server" }) },
      },
    ]);

    await new MessengerService(session).sendMessage(ROOM_ID, "Hello!", txnId);

    expectAllRoutesCalled();
  });
});

describe("MessengerService.sendMessageByName()", () => {
  const ROOM_ID = "!testroom:server";
  const ENCODED_ROOM = encodeURIComponent(ROOM_ID);
  const SYNC_FILTER = JSON.stringify({ room: { timeline: { limit: 1 } } });

  const SYNC_RESPONSE = JSON.stringify({
    next_batch: "s1",
    rooms: {
      join: {
        [ROOM_ID]: {
          timeline: { events: [] },
          state: { events: [{ type: "m.room.name", content: { name: "Test Room" } }] },
          unread_notifications: { notification_count: 0 },
        },
      },
    },
    account_data: { events: [] },
  });

  test("looks up the room by name and sends the message", async () => {
    const { session, calls, expectAllRoutesCalled } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/sync`,
        params: { filter: SYNC_FILTER, timeout: 0 },
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: SYNC_RESPONSE },
      },
      {
        method: "put",
        url: `${MATRIX_BASE}/rooms/${ENCODED_ROOM}/send/m.room.message/test-txn`,
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}`, "Content-Type": "application/json" },
        response: { data: JSON.stringify({ event_id: "$abc123:server" }) },
      },
    ]);

    const result = await new MessengerService(session).sendMessageByName("Test Room", "Hello!", "test-txn");

    expect(result.eventId).toBe("$abc123:server");
    expect(calls[1]?.body).toBe(JSON.stringify({ msgtype: "m.text", body: "Hello!" }));
    expectAllRoutesCalled();
  });

  test("throws when no room matches the name", async () => {
    const { session } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/sync`,
        params: { filter: SYNC_FILTER, timeout: 0 },
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: SYNC_RESPONSE },
      },
    ]);

    await expect(
      new MessengerService(session).sendMessageByName("Nobody", "Hi"),
    ).rejects.toThrow(`No room found with name "Nobody"`);
  });

  test("throws when multiple rooms match the name", async () => {
    const DUPLICATE_SYNC = JSON.stringify({
      next_batch: "s1",
      rooms: {
        join: {
          "!room1:server": {
            timeline: { events: [] },
            state: { events: [{ type: "m.room.name", content: { name: "Same Name" } }] },
            unread_notifications: {},
          },
          "!room2:server": {
            timeline: { events: [] },
            state: { events: [{ type: "m.room.name", content: { name: "Same Name" } }] },
            unread_notifications: {},
          },
        },
      },
      account_data: { events: [] },
    });

    const { session } = buildMockSession([
      {
        method: "get",
        url: `${MATRIX_BASE}/sync`,
        params: { filter: SYNC_FILTER, timeout: 0 },
        headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
        response: { data: DUPLICATE_SYNC },
      },
    ]);

    await expect(
      new MessengerService(session).sendMessageByName("Same Name", "Hi"),
    ).rejects.toThrow(`Multiple rooms found with name "Same Name"`);
  });
});
