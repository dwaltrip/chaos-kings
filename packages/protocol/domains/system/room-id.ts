import { RoomId } from '@kernel/ids';

function makeRoomId(domain: string, slug: string): RoomId {
  const normalizedDomain = domain.trim();
  const normalizedSlug = slug.trim();
  return `${normalizedDomain}:${normalizedSlug}` as RoomId;
}

// TODO: Consider relocating to a future platform package once shared domain helpers stabilize.

export { makeRoomId };
