export type ChatMessageDto = {
  id: string;
  text: string;
  own: boolean;
  createdAt: string;
  readAt: string | null;
};

export type ChatConversationDto = {
  slug: string;
  appointmentSlug: string;
  counterpartName: string;
  treatment: string;
  startsAt: string;
  past: boolean;
  canSend: boolean;
  closesAt: string | null;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
};

export type ChatPageDto = {
  conversation: ChatConversationDto;
  messages: ChatMessageDto[];
  olderCursor: string | null;
};
