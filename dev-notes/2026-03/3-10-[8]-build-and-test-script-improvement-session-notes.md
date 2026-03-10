# test-all.sh + build-all.sh improvements

Reworked both `tools/test-all.sh` and `tools/build-all.sh` to show compact output by default, with `-v` for full verbose output.

## What we built

- **Compact mode** (default): one-line summary per section using JSON output + jq
- **Verbose mode** (`-v`): full test runner output, same as before
- **Failure handling**: on failure, full native reporter output is dumped at the end

## Key learnings

- **jest `--json --outputFile=<file>`** writes JSON to file while keeping normal output on stdout; vitest equivalent is `--reporter=default --reporter=json --outputFile.json=<file>`
- **jq** is much cleaner than `node -e` for JSON parsing in bash — no file extension issues, more idiomatic
- **fnm `--log-level error`** suppresses "Using Node vX" info while preserving error messages (`quiet` suppresses everything)
- **`mktemp` per file + `rm "$file"`** is safer than `mktemp -d` + `rm -rf "$dir"`
- **macOS ships bash 3.x** — negative array indexing (`cmd[-1]`) requires bash 4.3+
- **Wrapper functions > clever arg tricks** — `jest_cmd`/`vitest_cmd` with a consistent `$1=json_file` API was cleaner than appending to the last array element
- **vitest `--reporter` flags append, don't replace** — going through `npm test --` inherits the npm script's reporters, causing duplicate failure output. Solution: call `npx vitest` directly in compact mode
- **`--silent` and `--reporters=summary`** (from npm scripts) strip failure details — compact mode overrides by calling runners directly

## build-all.sh learnings

- **`date +%s` is the portable timing option** — macOS `date` doesn't support `%N`, `gdate` needs Homebrew, `perl -MTime::HiRes` works but isn't POSIX. Whole-second precision is fine for anything >1s
- **`jq -r '.scripts.build' package.json`** to show what `npm run build` actually runs — avoids hardcoding commands that might change. Nice pattern for any npm-wrapping script
- **`tsc` has no structured output** — unlike jest/vitest which have `--json`, so build scripts use exit code + `grep -c ': error TS'` for error counts
- **Small formatting helpers pay off** — `vgap()` is trivial but cleaned up repeated `if $VERBOSE` conditionals throughout both scripts
