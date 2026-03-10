#!/bin/bash

# Test script - runs tests for backend, core, and frontend
# Usage: ./tools/test-all.sh        (compact output)
#        ./tools/test-all.sh -v     (verbose output)
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
	echo "fnm not found; aborting tests." >&2
	exit 1
fi

if ! $VERBOSE && ! command -v jq >/dev/null 2>&1; then
	echo "jq not found; install it or use -v for verbose output." >&2
	exit 1
fi

vgap() { if $VERBOSE; then printf "\n"; fi; }
# 4-space indent for detail lines
indent() { printf "    $1\n" "${@:2}"; }

if [[ -t 1 ]]; then
	GREEN='\033[32m' RED='\033[31m' RESET='\033[0m'
else
	GREEN='' RED='' RESET=''
fi

FAILED=false
FAILURE_OUTPUT=""

record_failure() {
	local label=$1
	local output=$2
	indent "%-12s${RED}✗  FAILED${RESET}" "$label"
	FAILURE_OUTPUT+=$'\n'"──── ${label} test failures ────"$'\n'"${output}"$'\n'
	FAILED=true
}

format_test_result() {
	local label=$1 tests_passed=$2 tests_total=$3 count_label=$4 start_ms=$5 end_ms=$6
	local secs
	secs=$(echo "scale=1; ($end_ms - $start_ms) / 1000" | bc)
	[[ "$secs" == .* ]] && secs="0$secs"
	indent "%-12s${GREEN}✓  %s passed (%s %s, %ss)${RESET}" \
		"$label" "$tests_passed" "$tests_total" "$count_label" "$secs"
}

jest_summary() {
	local json_file=$1 label=$2
	local tests_passed tests_total start_ms end_ms
	tests_passed=$(jq '.numPassedTests' "$json_file")
	tests_total=$(jq '.numTotalTestSuites' "$json_file")
	start_ms=$(jq '.startTime' "$json_file")
	end_ms=$(jq '.testResults | map(.endTime) | max' "$json_file")
	format_test_result "$label" "$tests_passed" "$tests_total" "suites" "$start_ms" "$end_ms"
}

vitest_summary() {
	local json_file=$1 label=$2
	local tests_passed tests_total start_ms end_ms
	tests_passed=$(jq '.numPassedTests' "$json_file")
	tests_total=$(jq '.testResults | length' "$json_file")
	start_ms=$(jq '.startTime' "$json_file")
	end_ms=$(jq '.testResults | map(.endTime) | max' "$json_file")
	format_test_result "$label" "$tests_passed" "$tests_total" "files" "$start_ms" "$end_ms"
}

jest_cmd() {
	npx jest --reporters=default --json --outputFile="$1"
}

vitest_cmd() {
	npx vitest run --reporter=default --reporter=json --outputFile.json="$1"
}

run_tests() {
	local label=$1
	local dir=$2
	local test_cmd=$3
	local summary_fn=$4

	local json_file
	json_file=$(mktemp)

	cd "$dir"
	fnm use >/dev/null 2>&1

	if $VERBOSE; then
		echo "Running ${label} tests..."
		npm test || FAILED=true
		rm "$json_file"
		return 0
	fi

	local output exit_code=0
	output=$("$test_cmd" "$json_file" 2>&1) || exit_code=$?

	if [[ $exit_code -eq 0 ]]; then
		"$summary_fn" "$json_file" "$label"
	else
		record_failure "$label" "$output"
	fi

	rm "$json_file"
}

TIMESTAMP=$(date +%H:%M:%S)
printf "[%s] Testing: apps/backend, packages/core, apps/frontend\n" "$TIMESTAMP"
vgap

run_tests "backend" "$PROJECT_ROOT/apps/backend" jest_cmd jest_summary
vgap

run_tests "core" "$PROJECT_ROOT/packages/core" jest_cmd jest_summary
vgap

run_tests "frontend" "$PROJECT_ROOT/apps/frontend" vitest_cmd vitest_summary

if $FAILED; then
	if [[ -n "$FAILURE_OUTPUT" ]]; then
		printf "\n%s\n" "$FAILURE_OUTPUT"
	fi
	exit 1
fi

vgap
indent "All tests passed."
