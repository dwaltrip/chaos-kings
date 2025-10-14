interface ChatMessageEntity {
  id: string; // TODO: [BRANDED_TYPES-chatMessageId]
  userId: string; // TODO: [BRANDED_TYPES-userId]
  roomId: string; // TODO: [BRANDED_TYPES-roomId]
  content: string;
  timestamp: number; // TODO: figure out how timestamps will work...
}

export { ChatMessageEntity };
