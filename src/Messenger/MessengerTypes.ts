export interface Room {
  id: string;
  name: string;
  lastMessage: RoomLastMessage | null;
  unreadCount: number;
  isDirect: boolean;
}

export interface RoomLastMessage {
  body: string;
  sender: string;
  senderName: string | null;
  timestamp: number;
}

export interface Message {
  eventId: string;
  sender: string;
  senderName: string | null;
  body: string;
  msgtype: string;
  timestamp: number;
  encrypted: boolean;
}

export interface MessagesResult {
  messages: Message[];
  start: string;
  end: string | undefined;
}

export interface SendMessageResult {
  eventId: string;
}

export interface Member {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  membership: "join" | "invite" | "ban" | "knock";
}

export interface UserProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface MatrixSyncResponse {
  next_batch: string;
  rooms?: {
    join?: Record<string, MatrixJoinedRoom>;
  };
  account_data?: {
    events: MatrixEvent[];
  };
}

export interface MatrixJoinedRoom {
  timeline: {
    events: MatrixEvent[];
  };
  state: {
    events: MatrixEvent[];
  };
  unread_notifications?: {
    notification_count?: number;
  };
}

export interface MatrixEvent {
  type: string;
  sender?: string;
  state_key?: string;
  event_id?: string;
  origin_server_ts?: number;
  content: Record<string, unknown>;
}

export interface MatrixMessagesResponse {
  start: string;
  end?: string;
  chunk: MatrixEvent[];
  state?: MatrixEvent[];
}

export interface MatrixMembersResponse {
  chunk: MatrixMemberEvent[];
}

export interface MatrixMemberEvent {
  type: string;
  state_key: string;
  content: {
    membership: string;
    displayname?: string;
    avatar_url?: string;
  };
}

export interface MatrixProfileResponse {
  displayname?: string;
  avatar_url?: string;
}
