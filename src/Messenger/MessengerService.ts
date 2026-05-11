import { parseJson } from "../Core/HttpClient.js";
import type { IServSession } from "../Core/IServSession.js";
import { createLogger } from "../Core/Logger.js";

const log = createLogger("MessengerService");

import type {
  MatrixEvent,
  MatrixMemberEvent,
  MatrixMembersResponse,
  MatrixMessagesResponse,
  MatrixProfileResponse,
  MatrixSyncResponse,
  Member,
  Message,
  MessagesResult,
  Room,
  SendMessageResult,
  UserProfile,
} from "./MessengerTypes.js";

const SYNC_FILTER = JSON.stringify({
  room: { timeline: { limit: 1 } },
});

export class MessengerService {
  constructor(private readonly session: IServSession) {}

  private authHeader(): Record<string, string> {
    if (!this.session.matrixToken) throw new Error("Not authenticated: Matrix token is missing");
    return { Authorization: `Bearer ${this.session.matrixToken}` };
  }

  private buildNameMap(events: MatrixEvent[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const e of events) {
      if (e.type === "m.room.member" && e.state_key) {
        const displayname = e.content.displayname as string | undefined;
        if (displayname) map.set(e.state_key, displayname);
      }
    }
    return map;
  }

  async getRooms(): Promise<Room[]> {
    const res = await this.session.http.get(`${this.session.matrixBaseUrl()}/sync`, {
      params: { filter: SYNC_FILTER, timeout: 0 },
      headers: this.authHeader(),
    });

    const sync = parseJson<MatrixSyncResponse>(res.data, "sync");
    const joinedRooms = sync.rooms?.join ?? {};

    const directRoomIds = new Set<string>();
    for (const event of sync.account_data?.events ?? []) {
      if (event.type === "m.direct") {
        for (const roomIds of Object.values(event.content) as string[][]) {
          for (const id of roomIds) directRoomIds.add(id);
        }
      }
    }

    const selfId = this.session.matrixUserId;

    return Object.entries(joinedRooms).map(([roomId, room]) => {
      const nameEvent = room.state.events.find((e) => e.type === "m.room.name");
      let name = (nameEvent?.content.name as string | undefined) ?? null;

      if (!name) {
        const memberEvents = room.state.events.filter((e) => e.type === "m.room.member");
        const other = memberEvents.find(
          (e) => e.state_key !== selfId && e.content.membership === "join",
        );
        name = (other?.content.displayname as string | undefined) ?? roomId;
      }

      const nameById = this.buildNameMap(room.state.events);

      const messageEvents = room.timeline.events.filter(
        (e) => e.type === "m.room.message" || e.type === "m.room.encrypted",
      );
      const lastEvent = messageEvents.at(-1) ?? null;
      const lastMessage = lastEvent
        ? {
            body:
              lastEvent.type === "m.room.encrypted"
                ? "[Encrypted message]"
                : ((lastEvent.content.body as string) ?? ""),
            sender: lastEvent.sender ?? "",
            senderName: nameById.get(lastEvent.sender ?? "") ?? null,
            timestamp: lastEvent.origin_server_ts ?? 0,
          }
        : null;

      return {
        id: roomId,
        name,
        lastMessage,
        unreadCount: room.unread_notifications?.notification_count ?? 0,
        isDirect: directRoomIds.has(roomId),
      };
    });
  }

  async getMessages(
    roomId: string,
    options: { limit?: number; from?: string } = {},
  ): Promise<MessagesResult> {
    const { limit = 30, from } = options;
    const encodedRoomId = encodeURIComponent(roomId);
    const filter = JSON.stringify({ lazy_load_members: true });

    const params: Record<string, string | number | boolean> = { limit, dir: "b", filter };
    if (from) params.from = from;

    const res = await this.session.http.get(
      `${this.session.matrixBaseUrl()}/rooms/${encodedRoomId}/messages`,
      { params, headers: this.authHeader() },
    );

    const data = parseJson<MatrixMessagesResponse>(res.data, "messages");

    const nameById = this.buildNameMap(data.state ?? []);

    const messages: Message[] = data.chunk
      .filter((e) => e.type === "m.room.message" || e.type === "m.room.encrypted")
      .map((e) => ({
        eventId: e.event_id ?? "",
        sender: e.sender ?? "",
        senderName: nameById.get(e.sender ?? "") ?? null,
        body: e.type === "m.room.encrypted" ? "" : ((e.content.body as string) ?? ""),
        msgtype:
          e.type === "m.room.encrypted" ? "m.encrypted" : ((e.content.msgtype as string) ?? ""),
        timestamp: e.origin_server_ts ?? 0,
        encrypted: e.type === "m.room.encrypted",
      }));

    log.debug(`Got ${messages.length} messages for ${roomId}`);
    return { messages, start: data.start, end: data.end };
  }

  async sendMessage(
    roomId: string,
    body: string,
    txnId: string = crypto.randomUUID(),
  ): Promise<SendMessageResult> {
    const encodedRoomId = encodeURIComponent(roomId);
    const encodedTxnId = encodeURIComponent(txnId);

    const res = await this.session.http.put(
      `${this.session.matrixBaseUrl()}/rooms/${encodedRoomId}/send/m.room.message/${encodedTxnId}`,
      JSON.stringify({ msgtype: "m.text", body }),
      { headers: { ...this.authHeader(), "Content-Type": "application/json" } },
    );

    const data = parseJson<{ event_id: string }>(res.data, "sendMessage");

    log.debug(`Sent message to ${roomId}, event_id: ${data.event_id}`);
    return { eventId: data.event_id };
  }

  async sendMessageByName(
    name: string,
    body: string,
    txnId: string = crypto.randomUUID(),
  ): Promise<SendMessageResult> {
    const rooms = await this.getRooms();
    const matches = rooms.filter((r) => r.name.toLowerCase() === name.toLowerCase());

    if (matches.length === 0) throw new Error(`No room found with name "${name}"`);
    if (matches.length > 1)
      throw new Error(
        `Multiple rooms found with name "${name}" — use sendMessage() with a room ID`,
      );

    const roomId = matches[0]?.id;
    if (!roomId) throw new Error(`No room found with name "${name}"`);
    return this.sendMessage(roomId, body, txnId);
  }

  async getMembers(roomId: string): Promise<Member[]> {
    const encodedRoomId = encodeURIComponent(roomId);

    const res = await this.session.http.get(
      `${this.session.matrixBaseUrl()}/rooms/${encodedRoomId}/members`,
      { params: { not_membership: "leave" }, headers: this.authHeader() },
    );

    const data = parseJson<MatrixMembersResponse>(res.data, "members");

    log.debug(`Got ${data.chunk.length} members for ${roomId}`);
    return data.chunk.map((e: MatrixMemberEvent) => ({
      userId: e.state_key,
      displayName: e.content.displayname ?? null,
      avatarUrl: e.content.avatar_url ?? null,
      membership: e.content.membership as "join" | "invite",
    }));
  }

  async getMessagesByName(
    name: string,
    options: { limit?: number; from?: string } = {},
  ): Promise<MessagesResult> {
    const rooms = await this.getRooms();
    const matches = rooms.filter((r) => r.name.toLowerCase() === name.toLowerCase());

    if (matches.length === 0) throw new Error(`No room found with name "${name}"`);
    if (matches.length > 1)
      throw new Error(
        `Multiple rooms found with name "${name}" — use getMessages() with a room ID`,
      );

    const roomId = matches[0]?.id;
    if (!roomId) throw new Error(`No room found with name "${name}"`);
    return this.getMessages(roomId, options);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const encodedUserId = encodeURIComponent(userId);

    const res = await this.session.http.get(
      `${this.session.matrixBaseUrl()}/profile/${encodedUserId}`,
      { headers: this.authHeader() },
    );

    const data = parseJson<MatrixProfileResponse>(res.data, "profile");

    log.debug(`Got profile for ${userId}`);
    return {
      userId,
      displayName: data.displayname ?? null,
      avatarUrl: data.avatar_url ?? null,
    };
  }
}
