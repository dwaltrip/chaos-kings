/*
Usage:

  ```my-module.test.ts
  describe('A thingy', () => {
    compactConsoleLog();

    test('some test case', () => {
    });
  });
  ```
*/
function compactConsoleLog() {
  const jestConsole = console;
  beforeEach(() => {
    global.console = require('console');
  });

  afterEach(() => {
    global.console = jestConsole;
  });
}

export { compactConsoleLog };
