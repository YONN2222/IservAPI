export interface UserPublicInfo {
  title: string;
  company: string;
  birthday: string;
  nickname: string;
  class: string;
  street: string;
  zipcode: string;
  city: string;
  country: string;
  icq: string;
  jabber: string;
  msn: string;
  skype: string;
  note: string;
  phone: string;
  mobilePhone: string;
  fax: string;
  mail: string;
  homepage: string;
  hidden: boolean;
}

export interface UserInfo {
  name: string;
  email: string;
  Groups: Record<string, string>;
  Roles: string[];
  Rights: string[];
  PublicInfo: UserPublicInfo;
}

export interface SetUserInfoOptions {
  title?: string;
  company?: string;
  birthday?: string;
  nickname?: string;
  schoolClass?: string;
  street?: string;
  zipcode?: string;
  city?: string;
  country?: string;
  phone?: string;
  mobilePhone?: string;
  fax?: string;
  mail?: string;
  homepage?: string;
  icq?: string;
  jabber?: string;
  msn?: string;
  skype?: string;
  note?: string;
  hidden?: boolean;
}

export interface UserAutocompleteResult {
  label: string;
  text: string;
  value: string;
  source: string;
  avatar: string | null;
  avatarHtml: string;
  extra: string;
  certainty: number;
  fuzzy: boolean;
}

export interface DirectoryUser {
  name: string;
  email: string;
  /** Short code such as "HMS" as shown by IServ's recipient autocomplete, if the account has one. */
  shortCode: string | null;
  roles: string[];
}
