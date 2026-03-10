#!/bin/bash

# Build script - builds backend and frontend
# Usage: ./tools/build-all.sh        (compact output)
#        ./tools/build-all.sh -v     (verbose output)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

VERBOSE=false
if [[ "$1" == "-v" || "$1" == "--verbose" ]]; then
	VERBOSE=true
fi

if command -v fnm >/dev/null 2>&1; then
	FNM_LOGLEVEL=error eval "$(fnm env --use-on-cd --log-level error)"
else
	echo "fnm not found; aborting build." >&2
	exit 1
fi

if ! $VERBOSE && ! command -v jq >/dev/null 2>&1; then
	echo "jq not found; install it or use -v for verbose output." >&2
	exit 1
fi

vgap() { if $VERBOSE; then printf "\n"; fi; }

FAILED=false
FAILURE_OUTPUT=""

run_build() {
	local label=$1
	local dir=$2

	cd "$dir"
	fnm use >/dev/null 2>&1

	if $VERBOSE; then
		echo "Building ${label}..."
		npm run build || FAILED=true
		return 0
	fi

	local build_cmd
	build_cmd=$(jq -r '.scripts.build' package.json)
	printf "building %-12s %s\n" "${label}..." "$build_cmd"

	local start_time
	start_time=$(date +%s)

	local output exit_code=0
	output=$(npm run build 2>&1) || exit_code=$?

	local elapsed
	elapsed=$(( $(date +%s) - start_time ))

	if [[ $exit_code -eq 0 ]]; then
		printf "  ✓ SUCCESS (%s seconds elapsed)\n" "$elapsed"
	else
		local error_count
		error_count=$(echo "$output" | grep -c ': error TS' || true)
		local detail=""
		if [[ $error_count -gt 0 ]]; then
			detail="  ($error_count errors)"
		fi
		printf "  ✗  FAILED%s\n" "$detail"
		FAILURE_OUTPUT+=$'\n'"──── ${label} build output ────"$'\n'"${output}"$'\n'
		FAILED=true
	fi
}

TIMESTAMP=$(date +%H:%M:%S)
printf "[%s] Running builds: apps/backend, apps/frontend\n" "$TIMESTAMP"
vgap

run_build "backend" "$PROJECT_ROOT/apps/backend"
vgap

run_build "frontend" "$PROJECT_ROOT/apps/frontend"

if $FAILED; then
	if [[ -n "$FAILURE_OUTPUT" ]]; then
		printf "\n%s\n" "$FAILURE_OUTPUT"
	fi
	exit 1
fi

vgap
printf "✅ All builds passed!\n"
