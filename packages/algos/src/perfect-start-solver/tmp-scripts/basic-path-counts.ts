import { genPathsDP } from '../custom-algo-1/gen-paths';
import { loadBoardCtx } from '../utils/board';

const ctx = loadBoardCtx('open-13x13');
const pathsByLen = genPathsDP(ctx.flatBoard, ctx.generalPos, 12);

for (var i = 2; i <= 13; i++) {
  const count = pathsByLen.get(i);
  console.log(i + ':', count?.length);
}
