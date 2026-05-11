# iserv-api

Unofficial TypeScript SDK for IServ school management servers. Authenticate with username and password, no API key required.

## Installation

```bash
npm install iserv-api
```

## Basic usage

```ts
import { IServAPI } from "iserv-api";

const api = await IServAPI.connect("your-school.iserv.de", "username", "password");

const info = await api.users.getOwnInfo();
console.log(info);

await api.disconnect();
```

## Table of contents

- [Installation](#installation)
- [Basic usage](#basic-usage)
- [Supported functionality](#supported-functionality)
  - [Own account](#own-account)
    - [Get own user info](#get-own-user-info)
    - [Set own user info](#set-own-user-info)
    - [Get notifications](#get-notifications)
    - [Get badges](#get-badges)
    - [Read all notifications](#read-all-notifications)
    - [Read a notification](#read-a-notification)
  - [Users](#users)
    - [Get profile picture](#get-profile-picture)
    - [Get profile picture buffer](#get-profile-picture-buffer)
    - [Get user info](#get-user-info)
    - [Search users](#search-users)
    - [Search users autocomplete](#search-users-autocomplete)
  - [Email](#email)
    - [Get emails](#get-emails)
    - [Get message](#get-message)
    - [Send email](#send-email)
  - [Calendar](#calendar)
    - [Get upcoming events](#get-upcoming-events)
    - [Get event sources](#get-event-sources)
    - [Get events](#get-events)
    - [Search events](#search-events)
    - [Get plugin events](#get-plugin-events)
    - [Create event](#create-event)
    - [Delete event](#delete-event)
  - [Files](#files)
    - [Get WebDAV client](#get-webdav-client)
    - [Get folder size](#get-folder-size)
    - [Get disk space](#get-disk-space)
  - [Messenger](#messenger)
    - [Get rooms](#get-rooms)
    - [Get messages](#get-messages)
    - [Get messages by name](#get-messages-by-name)
    - [Get members](#get-members)
    - [Get profile](#get-profile)
    - [Send message](#send-message)
    - [Send message by name](#send-message-by-name)
  - [Conference](#conference)
    - [Get conference health](#get-conference-health)
- [Logging](#logging)
- [License](#license)

---

## Supported functionality

### Own account

#### Get own user info

```ts
const info = await api.users.getOwnInfo();
```

Returns name, email, groups, roles, rights, and public profile info of the logged-in user.

#### Set own user info

```ts
await api.users.setOwnInfo({
  nickname: "Ali",
  city: "Berlin",
  hidden: false,
});
```

Available fields: `title`, `company`, `birthday`, `nickname`, `schoolClass`, `street`, `zipcode`, `city`, `country`, `phone`, `mobilePhone`, `fax`, `mail`, `homepage`, `icq`, `jabber`, `msn`, `skype`, `note`, `hidden`

#### Get notifications

```ts
const data = await api.notifications.getAll();
```

Returns all notifications including unread count and notification items.

#### Get badges

```ts
const badges = await api.notifications.getBadges();
```

Returns sidebar badge counts (e.g. unread email count).

#### Read all notifications

```ts
await api.notifications.readAll();
```

Marks all notifications as read.

#### Read a notification

```ts
await api.notifications.read(123);
```

Marks a single notification as read by its ID.

---

### Users

#### Get profile picture

```ts
await api.users.getProfilePicture("alice", "./avatars");
```

Saves the user's profile picture to the specified folder as `{username}.{ext}`.

#### Get profile picture buffer

```ts
const buffer = await api.users.getProfilePictureBuffer("alice");
const buffer = await api.users.getProfilePictureBuffer("alice", 128, 128);
```

Returns the profile picture as a `Buffer`. Width and height must be positive integers between 1 and 4096.

#### Get user info

```ts
const info = await api.users.getInfo("alice");
```

Returns the public address book information of any user.

#### Search users

```ts
const results = await api.users.search("Alice");
```

Searches the address book. Returns an array of `{ name, userUrl }`.

#### Search users autocomplete

```ts
const results = await api.users.searchAutocomplete("ali", 10);
```

Faster autocomplete search. Returns up to `limit` results (default 50).

---

### Email

#### Get emails

```ts
const emails = await api.email.getEmails({
  mailbox: "INBOX",
  limit: 25,
  offset: 0,
  sort: "date",
  order: "desc",
});
```

#### Get message

```ts
const message = await api.email.getMessage(uid, "INBOX");
```

Returns the full message including headers, body parts, and attachment metadata.

#### Send email

```ts
await api.email.sendEmail({
  to: "recipient@example.com",
  subject: "Hello",
  body: "Plain text body",
  htmlBody: "<p>HTML body</p>",
  smtpsPort: 465,
  attachments: ["./file.pdf"],
});
```

Attachments must be relative paths. `smtpsPort` must be `465` or `587`.

---

### Calendar

#### Get upcoming events

```ts
const { events } = await api.calendar.getUpcomingEvents();
```

#### Get event sources

```ts
const sources = await api.calendar.getEventSources();
```

Returns all available calendars and plugins. Each source has an `id`, `label`, and `type` (`"cal"` or `"plugin"`).

#### Get events

```ts
const events = await api.calendar.getEvents("2025-01-01", "2025-12-31");
```

Returns all events across all sources in the given time range.

#### Search events

```ts
const results = await api.calendar.searchEvents("Math exam", "2025-01-01", "2025-12-31");
```

#### Get plugin events

```ts
const events = await api.calendar.getPluginEvents("holiday", "2025-01-01", "2025-12-31");
```

Plugin IDs come from event sources where `type === "plugin"`.

#### Create event

```ts
const result = await api.calendar.createEvent({
  subject: "Math exam",
  calendar: "/alice/home",
  start: "2025-09-27T14:00:00",
  end: "2025-09-27T16:00:00",
  location: "Room 101",
  description: "Bring calculator",
  alarms: ["1D", "2H"],
  isAllDayLong: false,
  participants: ["bob", "carol@school.iserv.de"],
  showMeAs: "OPAQUE",
  privacy: "PUBLIC",
  recurring: {
    intervalType: "WEEKLY",
    interval: 1,
    recurrenceDays: ["MO", "WE"],
    endType: "COUNT",
    endInterval: 10,
  },
});
```

**Alarm types:**

Preset strings: `"0M"` `"5M"` `"15M"` `"30M"` `"1H"` `"2H"` `"12H"` `"1D"` `"2D"` `"7D"`

Custom datetime alarm:
```ts
{ custom_date_time: { dateTime: "2025-09-26T10:00:00" } }
```

Custom interval alarm:
```ts
{
  custom_interval: {
    interval: { days: 1, hours: 2, minutes: 0 },
    before: true,
  }
}
```

**Recurring options:**

| Field | Type | Description |
|---|---|---|
| `intervalType` | `"NO" \| "DAILY" \| "WEEKDAYS" \| "WEEKLY" \| "MONTHLY" \| "YEARLY"` | Repeat pattern |
| `interval` | `number` | Repeat every N units (required for most types) |
| `recurrenceDays` | `WeekDay[]` | Required for `WEEKLY` |
| `monthlyIntervalType` | `"BYMONTHDAY" \| "BYDAY"` | Required for `MONTHLY` |
| `endType` | `"NEVER" \| "COUNT" \| "UNTIL"` | How the recurrence ends |
| `endInterval` | `number` | Required if `endType` is `"COUNT"` |
| `untilDate` | `string` | Required if `endType` is `"UNTIL"`, format `"DD.MM.YYYY"` |

#### Delete event

```ts
await api.calendar.deleteEvent({
  uid: "abc123@school.iserv.de",
  hash: "541f2d74099d785d1286c03903a2e826",
  calendar: "/alice/home",
  start: "2025-09-27T14:00:00+02:00",
  series: false,
});
```

`uid`, `hash`, `calendar`, and `start` are returned by `getEvents()`.

---

### Files

#### Get WebDAV client

```ts
const client = api.files.getClient();
```

Returns a pre-authenticated [`webdav`](https://github.com/perry-mitchell/WebDAV-client) client. See the webdav package documentation for all available methods.

```ts
const files = await client.getDirectoryContents("/");
await client.putFileContents("/notes.txt", "hello");
const data = await client.getFileContents("/notes.txt");
```

#### Get folder size

```ts
const size = await api.files.getFolderSize("/Documents");
```

#### Get disk space

```ts
const usage = await api.files.getDiskSpace();
```

Returns disk space info for all accessible storage volumes (label, free space, color).

---

### Messenger

The messenger service wraps the Matrix protocol used by IServ. A Matrix session is established automatically during login.

#### Get rooms

```ts
const rooms = await api.messenger.getRooms();
```

Returns all joined rooms (group chats and direct messages).

Each room has:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Matrix room ID |
| `name` | `string` | Room name or display name of the other person |
| `isDirect` | `boolean` | Whether this is a DM |
| `unreadCount` | `number` | Unread message count |
| `lastMessage` | `RoomLastMessage \| null` | Most recent message |

`lastMessage` fields: `body`, `sender` (Matrix user ID), `senderName` (display name or `null`), `timestamp`.

#### Get messages

```ts
const { messages, start, end } = await api.messenger.getMessages(roomId, { limit: 30, from: end });
```

Returns up to `limit` messages (default 30) in reverse chronological order. Pass `end` from a previous response as `from` to paginate backwards. `end` is `undefined` when there are no more messages.

Each message has:

| Field | Type | Description                                                                  |
|---|---|------------------------------------------------------------------------------|
| `eventId` | `string` | Matrix event ID                                                              |
| `sender` | `string` | Matrix user ID                                                               |
| `senderName` | `string \| null` | Display name                                                                 |
| `body` | `string` | Message text, empty string if the message is end-to-end encrypted            |
| `msgtype` | `string` | e.g. `"m.text"`, `"m.image"`, `"m.file"` — `"m.encrypted"` for E2EE messages |
| `timestamp` | `number` | Unix ms                                                                      |
| `encrypted` | `boolean` | `true` if the message content cannot be decrypted by this SDK                |

#### Get messages by name

```ts
const { messages } = await api.messenger.getMessagesByName("Max Mustermann", { limit: 20 });
```

Looks up the room by name and returns its messages. Throws if no room or multiple rooms match the name. Accepts the same options as `getMessages()`.

#### Get members

```ts
const members = await api.messenger.getMembers(roomId);
```

Returns all current members of a room (excludes users who have left).

Each member has: `userId`, `displayName`, `avatarUrl`, `membership` (`"join"` | `"invite"` | `"ban"` | `"knock"`).

#### Get profile

```ts
const profile = await api.messenger.getProfile(userId);
```

Returns the Matrix profile of any user: `userId`, `displayName`, `avatarUrl`.

#### Send message

```ts
const result = await api.messenger.sendMessage(roomId, "Hello!");
console.log(result.eventId);
```

Sends a text message to a room by its Matrix room ID. Returns the `eventId` of the sent message.

An optional `txnId` can be passed as a third argument for idempotency — if the same `txnId` is used twice, the server will deduplicate the send:

```ts
await api.messenger.sendMessage(roomId, "Hello!", "my-unique-id");
```

#### Send message by name

```ts
const result = await api.messenger.sendMessageByName("Max Mustermann", "Hello!");
console.log(result.eventId);
```

Looks up the room by display name and sends a text message. Throws if no room or multiple rooms match the name. Accepts an optional `txnId` as a third argument, same as `sendMessage()`.

> **Note:** This method calls `getRooms()` internally, which makes an extra network request. If you already have the room ID, prefer `sendMessage()` directly.

---

### Conference

#### Get conference health

```ts
const health = await api.conference.getHealth();
```

Returns the health status of the IServ video conference endpoint.

---

## Logging

The SDK logs to stderr using a built-in logger. Set `ISERV_DEBUG=1` to enable debug output:

```bash
ISERV_DEBUG=1 node app.js
```

---

## License

MIT

> **Disclaimer:** This is an unofficial SDK not affiliated with IServ GmbH. Use at your own risk. The authors are not responsible for any damages or data loss caused by use of this package.