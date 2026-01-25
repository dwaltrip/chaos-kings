import { UserId } from '@kernel/ids';

import { SandboxManager } from '@/domains/sandbox/sandbox-manager';
import { buildSandboxRoomId } from '@/domains/sandbox/utils';
import type { SandboxConfig } from '@/domains/sandbox/types';
import { DEFAULT_SANDBOX_CONFIG } from '@/domains/sandbox/types';

class SandboxService {
  private sessions: Map<UserId, SandboxManager> = new Map();

  createSession(userId: UserId, config?: Partial<SandboxConfig>): SandboxManager {
    const existingSession = this.sessions.get(userId);
    if (existingSession) {
      existingSession.stop();
      this.sessions.delete(userId);
    }

    const roomId = buildSandboxRoomId(userId);
    const fullConfig: SandboxConfig = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    const manager = new SandboxManager(userId, roomId, fullConfig);
    this.sessions.set(userId, manager);
    return manager;
  }

  getSession(userId: UserId): SandboxManager | undefined {
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

export { sandboxService, SandboxService };
