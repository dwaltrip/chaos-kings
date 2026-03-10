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
# 4-space indent for detail lines
indent()   { printf "    $1\n" "${@:2}"; }
indent_n() { printf "    $1" "${@:2}"; }

if [[ -t 1 ]]; then
	GREEN='\033[32m' RED='\033[31m' DIM='\033[2m' RESET='\033[0m'
else
	GREEN='' RED='' DIM='' RESET=''
fi

FAILED=false
FAILURE_OUTPUT=""

extract_file_count() {
	local output=$1
	local label=$2

	if [[ "$label" == "backend" ]]; then
		echo "$output" | grep -c '^TSFILE:' || echo "0"
	elif [[ "$label" == "frontend" ]]; then
		echo "$output" | sed -n 's/.*✓ \([0-9]*\) modules transformed.*/\1/p'
	fi
}

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

	local build_cmd stats_cmd
	build_cmd=$(jq -r '.scripts.build' package.json)
	stats_cmd=$(jq -r '.scripts["build:stats"] // empty' package.json)

	# 12 is the label column width
	# 44 is the build command column width
	indent_n "%-12s${DIM}%-44s${RESET}" "$label" "$build_cmd"

	local start_time
	start_time=$(date +%s)

	local npm_script="build"
	if [[ -n "$stats_cmd" ]]; then
		npm_script="build:stats"
	fi

	local output exit_code=0
	output=$(npm run "$npm_script" 2>&1) || exit_code=$?

	local elapsed
	elapsed=$(( $(date +%s) - start_time ))

	if [[ $exit_code -eq 0 ]]; then
		local file_count
		file_count=$(extract_file_count "$output" "$label")
		if [[ -n "$file_count" && "$file_count" -gt 0 ]]; then
			printf "${GREEN}✓  %s files (%ss)${RESET}\n" "$file_count" "$elapsed"
		else
			printf "${GREEN}✓  success (%ss)${RESET}\n" "$elapsed"
		fi
	else
		local error_count
		error_count=$(echo "$output" | grep -c ': error TS' || true)
		local detail=""
		if [[ $error_count -gt 0 ]]; then
			detail="  ($error_count errors)"
		fi
		printf "${RED}✗  FAILED%s${RESET}\n" "$detail"
		FAILURE_OUTPUT+=$'\n'"──── ${label} build output ────"$'\n'"${output}"$'\n'
		FAILED=true
	fi
}

TIMESTAMP=$(date +%H:%M:%S)
printf "[%s] Building: apps/backend, apps/frontend\n" "$TIMESTAMP"
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
indent "All builds passed."
