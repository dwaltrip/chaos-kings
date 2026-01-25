import type { Movement } from '@core/types';

interface QueueConfig {
  maxSize: number;
  // TODO: Grace logic - skip invalid moves, try next in queue
  enableGrace?: boolean;
}

const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxSize: 200,
  enableGrace: false,
};

export type { QueueConfig, Movement };
export { DEFAULT_QUEUE_CONFIG };
