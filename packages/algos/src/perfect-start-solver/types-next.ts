const Direction = {
  TOP: 0,
  RIGHT: 1,
  DOWN: 2,
  LEFT: 3,
} as const;

type Direction = (typeof Direction)[keyof typeof Direction];

type Move = {
  src: number;
  dir: Direction;
};

export type { Move };
export { Direction };
