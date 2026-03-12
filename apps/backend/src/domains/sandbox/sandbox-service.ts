import { UserId } from '@kernel/ids';

import { SandboxSession } from '@/domains/sandbox/sandbox-session';
import { buildSandboxRoomId } from '@/domains/sandbox/utils';
import type { SandboxConfig } from '@/domains/sandbox/types';
import { DEFAULT_SANDBOX_CONFIG } from '@/domains/sandbox/types';

class SandboxService {
  private sessions: Map<UserId, SandboxSession> = new Map();

  createSession(
    userId: UserId,
    connectionId: string,
    config?: Partial<SandboxConfig>,
  ): SandboxSession {
    const existingSession = this.sessions.get(userId);
    if (existingSession) {
      existingSession.stop();
      this.sessions.delete(userId);
    }

    const roomId = buildSandboxRoomId(userId);
    const fullConfig: SandboxConfig = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    const session = new SandboxSession(userId, roomId, connectionId, fullConfig);
    this.sessions.set(userId, session);
    return session;
  }

  getSession(userId: UserId): SandboxSession | undefined {
    return this.sessions.get(userId);
  }

  destroySession(userId: UserId): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.stop();
      this.sessions.delete(userId);
    }
  }

  // TODO: Multiple sessions per user
  // TODO: Session persistence (save/load)
}

const sandboxService = new SandboxService();

export { sandboxService, SandboxService, type SandboxSession };
