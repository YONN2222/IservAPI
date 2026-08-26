export type {
  AlarmPreset,
  AlarmType,
  CalendarEvent,
  CalendarEventSearchResult,
  CalendarEventSource,
  CalendarEventsByCalendar,
  CreateEventOptions,
  CustomDateTimeAlarm,
  CustomIntervalAlarm,
  DeleteEventOptions,
  IntervalType,
  Recurring,
  UpcomingEvents,
  WeekDay,
} from "../Calendar/CalendarTypes.js";

export type { ConferenceHealth, ConferenceHealthCounter } from "../Conference/ConferenceTypes.js";
export type { IServJsonResponse, JsonValue } from "../Core/HttpClient.js";
export type {
  EmailAddress,
  EmailContentPart,
  EmailEnvelope,
  EmailId,
  EmailList,
  EmailListItem,
  EmailMessage,
  GetEmailsOptions,
  MailboxInfo,
  SendEmailOptions,
} from "../Email/EmailTypes.js";
export type { DiskSpaceEntry, FolderSize, GetWebDavClientOptions } from "../Files/FilesTypes.js";

export type {
  ForumLastPost,
  ForumListItem,
  ForumPost,
  Topic,
  TopicListItem,
  TopicListResult,
} from "../Forum/ForumTypes.js";

export type {
  IServDateTime,
  NavigationBadges,
  NotificationItem,
  NotificationsData,
  ReadNotificationRef,
} from "../Notifications/NotificationTypes.js";

export type {
  SetUserInfoOptions,
  UserAutocompleteResult,
  UserInfo,
  UserPublicInfo,
} from "../User/UserTypes.js";
