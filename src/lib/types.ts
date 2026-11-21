export interface User {
  id: string;
  org_id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'team_manager' | 'agent' | 'readonly';
  title?: string;
  avatar_color: string;
  status: 'online' | 'away' | 'offline';
  availability?: string;
  teams?: string[];
  assigned?: number;
  resolved?: number;
}

export interface Org {
  id: string; name: string; slug: string; plan: string; brand_color: string;
  logo_initials?: string; timezone?: string; seats_limit: number;
}

export interface CustomerRef {
  id: string; name: string; email?: string; phone?: string; color: string;
  location?: string; tags: string[]; ltv?: number; company?: string; companyId?: string;
}

export interface Conversation {
  id: string; ref: string; subject: string; status: string; priority: string;
  channelType: string; channelId?: string; channelName?: string; channelStatus?: string;
  teamId?: string; teamName?: string;
  assignee?: { id: string; name: string; color: string } | null;
  customer: CustomerRef;
  tags: string[]; unreadCount: number; starred: boolean;
  preview?: string; previewAuthor?: string; messageCount: number;
  lastMessageAt: string; createdAt: string; firstResponseAt?: string; resolvedAt?: string;
  slaDueAt?: string; slaState: string; sentiment?: string; intent?: string; summary?: string;
  csat?: number; isDemo: boolean;
}

export interface Message {
  id: string; direction: 'inbound' | 'outbound' | 'system'; authorType: string;
  authorId?: string; authorName?: string; body: string; channelType: string; status: string;
  isInternal: boolean; attachments: { name: string; size?: number; url?: string }[];
  meta: Record<string, any>; createdAt: string;
}

export interface Ticket {
  id: string; number: number; subject: string; description?: string; status: string; priority: string;
  source: string; tags: string[]; customFields: Record<string, unknown>; slaState: string;
  dueAt?: string; resolvedAt?: string; createdAt: string; conversationId?: string; convRef?: string;
  customer?: { id: string; name: string; email?: string; color: string } | null;
  assignee?: { id: string; name: string; color: string } | null; team?: string;
}

export interface Team {
  id: string; name: string; description: string; color: string; leadUserId?: string;
  businessHours?: string; memberIds: string[]; openConversations: number;
}

export interface Channel {
  id: string; type: string; name: string; handle: string; status: string; authType: string;
  lastSyncAt?: string; health: string; config: Record<string, unknown>;
  errors: { at: string; level: string; message: string }[]; conversations: number;
}

export interface Integration {
  id: string; key: string; name: string; category: string; status: string; authType: string;
  description: string; docsUrl: string; config: Record<string, unknown>; lastSyncAt?: string;
  errors: { at: string; level: string; message: string }[];
}

export interface Automation {
  id: string; name: string; description: string; enabled: boolean; triggerType: string;
  triggerConfig: Record<string, any>;
  conditions: { field: string; op: string; value?: string }[];
  actions: { type: string; value?: string }[];
  runCount: number; lastRunAt?: string; isDemo: boolean;
}

export interface Article {
  id: string; title: string; slug: string; body: string; visibility: 'public' | 'internal';
  status: string; categoryId?: string; views: number; helpful: number; updatedAt: string; createdAt: string;
}

export interface KbCategory { id: string; name: string; description: string; icon: string; count: number }
