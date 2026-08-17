# Changelog

## 1.4.5 - 2026-08-17

### Changed

- Updated Dependencies to their latest version

## 1.4.4 - 2026-07-19

### Changed

- Updated Dependencies to their latest version


## 1.4.3 - 2026-06-24

### Changed

- Updated Dependencies to their latest version

## 1.4.2 - 2026-05-27

### Fixed
- Fixed login failing with `Login failed! Session was not established`.
- Updated authentication to support IServ's newer app login flow.
- Added handling for IServ's post-login redirect through `/iserv/app/authentication/redirect`.

## 1.4.1 - 2026-05-14

### Added

- Added `api.messenger.listenForMessages(callback, options?)` for real-time message listening via Matrix long-polling. The callback receives the `MessageEvent` and a `stop()` function to stop listening from within the callback.

### Changed

- `Message.senderName` and `RoomLastMessage.senderName` are now always `string` instead of `string | null`. When no display name is available, the Matrix user ID is used as fallback.

## 1.4.0 - 2026-05-13

### Added

- Added Messenger direct-message creation with `api.messenger.createDirectMessage(matrixId)`.
- Added Messenger room leaving with `api.messenger.leaveRoom(roomId)`.
- Added Messenger reactions with `api.messenger.reactToMessage(roomId, eventId, emoji)` and `api.messenger.reactToMessageByName(name, eventId, emoji)`.
- Added Messenger message editing, replying, reaction removal, and message deletion with `editMessage`, `replyToMessage`, `removeReaction`, and `deleteMessage`.
- Added `api.users.searchMessengerRecipients(query, limit?)` to find IServ messenger recipients for direct-message creation.

### Changed

- Messenger login now uses IServ's `/iserv/messenger/authenticate` flow instead of direct Matrix password login.
- Documented the new Messenger APIs in the README.

## 1.3.2 - 2026-05-12

### Added

- Added `api.email.markAsUnread(uid, mailbox?)` to mark an email as unread.
- Added `api.email.markAsRead(uid, mailbox?)` to mark an email as read.

## 1.3.1 - 2026-05-11

### Changed

- Replaced `date-fns` with `dayjs` for calendar date formatting to reduce the package dependency size.

## 1.3.0 - 2026-05-11

### Added

- Added support for sending Messenger messages with `api.messenger.sendMessage(roomId, body)` and `api.messenger.sendMessageByName(name, body)`.
