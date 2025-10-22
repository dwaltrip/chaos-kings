function roomKey(domain: string, room: string): string {
  return `${domain}:${room}`;
}

export { roomKey };
