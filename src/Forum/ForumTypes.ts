export interface ForumLastPost {
  url: string;
  date: string;
  author: string;
}

export interface ForumListItem {
  id: number;
  title: string;
  description: string;
  category: string;
  access: string[];
  topicCount: number;
  postCount: number;
  unreadCount: number | null;
  lastPost: ForumLastPost | null;
}

export interface TopicListItem {
  id: number;
  forumId: number;
  title: string;
  url: string;
  author: string;
  postCount: number;
  unreadCount: number | null;
  lastPost: ForumLastPost | null;
  read: boolean;
}

export interface TopicListResult {
  forumId: number;
  forumTitle: string;
  topics: TopicListItem[];
  page: number;
  totalPages: number;
}

export interface ForumPost {
  id: number;
  level: number;
  author: string;
  date: string;
  contentHtml: string;
  contentText: string;
}

export interface Topic {
  id: number;
  forumId: number;
  title: string;
  pinned: boolean;
  closed: boolean;
  deleted: boolean;
  posts: ForumPost[];
}
