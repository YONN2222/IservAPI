import { AuthService } from "../Auth/AuthService.js";
import { CalendarService } from "../Calendar/CalendarService.js";
import { ConferenceService } from "../Conference/ConferenceService.js";
import { EmailService } from "../Email/EmailService.js";
import { FilesService } from "../Files/FilesService.js";
import { ForumService } from "../Forum/ForumService.js";
import { MessengerService } from "../Messenger/MessengerService.js";
import { NotificationService } from "../Notifications/NotificationService.js";
import { UserService } from "../User/UserService.js";
import { IServSession } from "./IServSession.js";

export class IServAPI {
  readonly calendar: CalendarService;
  readonly email: EmailService;
  readonly users: UserService;
  readonly notifications: NotificationService;
  readonly files: FilesService;
  readonly conference: ConferenceService;
  readonly messenger: MessengerService;
  readonly forum: ForumService;

  private readonly auth: AuthService;

  private constructor(session: IServSession) {
    this.auth = new AuthService(session);
    this.calendar = new CalendarService(session);
    this.email = new EmailService(session);
    this.users = new UserService(session);
    this.notifications = new NotificationService(session);
    this.files = new FilesService(session);
    this.conference = new ConferenceService(session);
    this.messenger = new MessengerService(session);
    this.forum = new ForumService(session);
  }

  static async connect(url: string, username: string, password: string): Promise<IServAPI> {
    const session = new IServSession(url, username, password);
    const client = new IServAPI(session);
    await client.auth.login();
    return client;
  }

  async disconnect(): Promise<void> {
    await this.auth.logout();
  }
}
