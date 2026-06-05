#!/usr/bin/env bash
set -e

if [ $# -ne 1 ]; then
  echo "Usage: $0 <openrouter|deepseek>"
  exit 1
fi

PROVIDER=$1

if [ "$PROVIDER" != "openrouter" ] && [ "$PROVIDER" != "deepseek" ]; then
  echo "Invalid provider: $PROVIDER (use openrouter or deepseek)"
  exit 1
fi

# Update config.env
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/^LLM_PROVIDER=.*/LLM_PROVIDER=$PROVIDER/" config.env
else
  sed -i "s/^LLM_PROVIDER=.*/LLM_PROVIDER=$PROVIDER/" config.env
fi

echo "Switched to $PROVIDER"
echo "Run 'make restart' or 'bash start.sh' to apply"
