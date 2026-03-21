import { generateMap } from '../utils/generate-map';

function main() {
  for (let i = 0; i < 10; i++) {
    const boardStr = generateMap({ width: 25, height: 25 });
    console.log('=========================');
    console.log(`Board ${i + 1}`);
    console.group('-------------------------');
    console.log();
    console.log(boardStr);
    console.log();
    console.log();
    console.groupEnd();
  }
}

main();
