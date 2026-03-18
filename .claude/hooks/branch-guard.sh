#!/bin/bash
# Branch-Aware Permission Guard
# Checks current branch and enforces permission mode
# Used by .claude/settings.local.json to guard dangerous operations

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
DANGEROUS_BRANCHES=("main" "master" "production")

# Check if we're on a protected branch
is_protected_branch() {
  for protected in "${DANGEROUS_BRANCHES[@]}"; do
    if [[ "$CURRENT_BRANCH" == "$protected" ]]; then
      return 0  # True - is protected
    fi
  done
  return 1  # False - not protected
}

# Usage: branch-guard.sh <command-type>
# Returns: 0 if allowed, 1 if should ask for approval
case "$1" in
  # Safe operations (always allowed)
  read|grep|cat|ls|pwd|find)
    exit 0
    ;;

  # File edits (ask on protected branches only)
  edit)
    if is_protected_branch; then
      exit 1  # Ask for approval on main/master
    else
      exit 0  # Allow on feature branches
    fi
    ;;

  # Git operations (branch-aware)
  git-status|git-diff|git-log)
    exit 0  # Always safe
    ;;

  git-add|git-commit)
    if is_protected_branch; then
      exit 1  # Ask for approval on main/master
    else
      exit 0  # Allow on feature branches
    fi
    ;;

  git-push|git-merge|git-rebase|git-reset)
    exit 1  # Always ask for approval
    ;;

  git-checkout)
    # Allow local branch checkout, ask for main/master checkout
    if [[ "$2" == "main" ]] || [[ "$2" == "master" ]]; then
      exit 1  # Ask
    else
      exit 0  # Allow
    fi
    ;;

  # Bash commands (build/test/lint safe by default)
  npm-test|npm-run-test|npm-run-lint|npm-run-format)
    exit 0  # Always allow
    ;;

  npm-install|npm-run-build|npm-run-dev)
    exit 0  # Always allow for local work
    ;;

  # Dangerous operations (always ask)
  rm|delete|reset-hard|deploy|publish)
    exit 1  # Always ask for approval
    ;;

  *)
    # Default: ask for approval on unknown commands
    if is_protected_branch; then
      exit 1  # Ask on main/master
    else
      exit 0  # Allow on feature branches
    fi
    ;;
esac
