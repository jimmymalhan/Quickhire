#!/usr/bin/env bash
# HARD RULE: All agents must source this before any git operation.
# Prevents direct commits/pushes to main.

git() {
  # Block direct push to main
  if [[ "$1" == "push" ]] && [[ "$*" =~ "main" ]] && [[ ! "$*" =~ "--delete" ]]; then
    echo "BLOCKED: Direct push to main is forbidden. Use a PR." >&2
    return 1
  fi
  # Block commit on main
  if [[ "$1" == "commit" ]]; then
    local branch
    branch=$(command git rev-parse --abbrev-ref HEAD 2>/dev/null)
    if [[ "$branch" == "main" ]]; then
      echo "BLOCKED: Cannot commit on main. Create a feature branch first." >&2
      return 1
    fi
  fi
  command git "$@"
}
export -f git

safe_push() {
  local branch
  branch=$(command git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [[ "$branch" == "main" ]]; then
    echo "BLOCKED: Cannot push main. Switch to a feature branch." >&2
    return 1
  fi
  command git push -u origin "$branch" "$@"
}
export -f safe_push
