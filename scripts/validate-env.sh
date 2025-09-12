#!/usr/bin/env bash
set -euo pipefail

# Environment Validation Script
# Checks that required env vars are set and not using default values

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found"
  echo "Run: cp .env.example .env"
  exit 1
fi

echo "🔍 Validating environment configuration in $ENV_FILE..."

# Check required variables exist and are not empty/default
check_var() {
  local var_name="$1"
  local forbidden_value="$2"
  
  if ! grep -q "^${var_name}=" "$ENV_FILE"; then
    echo "❌ Missing: $var_name"
    return 1
  fi
  
  local value=$(grep "^${var_name}=" "$ENV_FILE" | cut -d'=' -f2-)
  
  if [ -z "$value" ]; then
    echo "❌ Empty: $var_name"
    return 1
  fi
  
  if [ "$value" = "$forbidden_value" ]; then
    echo "❌ Default value: $var_name (still set to '$forbidden_value')"
    return 1
  fi
  
  echo "✅ Valid: $var_name"
  return 0
}

# Validate required variables
errors=0

check_var "DOMAIN" "" || errors=$((errors + 1))
check_var "ACME_EMAIL" "" || errors=$((errors + 1))  
check_var "POSTGRES_PASSWORD" "change_me" || errors=$((errors + 1))
check_var "SESSION_SECRET" "change_me" || errors=$((errors + 1))

if [ $errors -gt 0 ]; then
  echo ""
  echo "❌ Found $errors error(s). Please fix the above issues in $ENV_FILE"
  echo ""
  echo "To generate secure values:"
  echo "  SESSION_SECRET: openssl rand -base64 32"
  echo "  POSTGRES_PASSWORD: openssl rand -base64 16"
  exit 1
fi

echo ""
echo "✅ All required environment variables are properly configured!"
echo "Ready to deploy with: docker compose up -d"