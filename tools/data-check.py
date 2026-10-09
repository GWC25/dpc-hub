#!/usr/bin/env python3
"""
data-check.py: DPC Hub data safeguard (October 2026).

This repository is public. It must hold code and area-level data only.
This check fails if any tracked file contains:
  - a token, key or password-like secret
  - an email address
  - a file type that usually carries personal data (spreadsheets, documents)
  - a name from the private name list

The name list is never stored in the repo. It comes from the NAME_DENYLIST
environment variable (a GitHub Actions secret): one name per line, or
separated by commas. Without it, the name check is skipped with a warning.

Run locally before pushing:   python3 tools/data-check.py
Exit code 0 = clean, 1 = something to fix.
"""
import os
import re
import subprocess
import sys

SKIP_DIRS = ("lib/",)  # third-party libraries with their own licence text
SKIP_FILES = ("tools/data-check.py",)
BLOCKED_TYPES = (".xlsx", ".xls", ".xlsm", ".csv", ".tsv", ".docx", ".doc", ".pptx", ".pdf", ".env")

SECRETS = [
    (r"github_pat_[A-Za-z0-9_]{20,}", "GitHub token"),
    (r"\bgh[pousr]_[A-Za-z0-9]{30,}", "GitHub token"),
    (r"\bsk-(ant-)?[A-Za-z0-9_-]{20,}", "API key"),
    (r"\bAKIA[0-9A-Z]{16}\b", "AWS key"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "private key"),
    (r"service_role", "Supabase service key (must never be client-side)"),
    (r"(?i)\b(password|passwd|pwd)\s*[:=]\s*['\"][^'\"\s]{4,}['\"]", "plain-text password"),
]
EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
EMAIL_ALLOW = ("example.com", "example.org", "users.noreply.github.com", "noreply@anthropic.com")


def tracked_files():
    out = subprocess.run(["git", "ls-files", "-z"], capture_output=True, check=True).stdout
    return [f for f in out.decode().split("\0") if f]


def load_names():
    raw = os.environ.get("NAME_DENYLIST", "")
    names = [n.strip() for n in re.split(r"[\n,;]", raw) if len(n.strip()) >= 3]
    return [(n, re.compile(r"(?i)(?<![A-Za-z])" + re.escape(n) + r"(?![A-Za-z])")) for n in names]


def main():
    problems = []
    names = load_names()
    for path in tracked_files():
        if path.startswith(SKIP_DIRS) or path in SKIP_FILES:
            continue
        if path.lower().endswith(BLOCKED_TYPES) or os.path.basename(path).startswith(".env"):
            problems.append(f"{path}: file type that can carry personal data; keep it in OneDrive, not here")
            continue
        try:
            text = open(path, encoding="utf-8", errors="ignore").read()
        except (IsADirectoryError, FileNotFoundError):
            continue
        for n, line in enumerate(text.splitlines(), 1):
            for pattern, label in SECRETS:
                if re.search(pattern, line):
                    problems.append(f"{path}:{n}: possible {label}")
            for email in EMAIL.findall(line):
                if not any(email.lower().endswith(a) for a in EMAIL_ALLOW):
                    problems.append(f"{path}:{n}: email address ({email}); use initials or a role")
            for name, rx in names:
                if rx.search(line):
                    # Never print the name itself into a public log.
                    problems.append(f"{path}:{n}: a name from the private name list; use initials")

    if not names:
        print("WARNING: NAME_DENYLIST is not set, so names were not checked.")
    else:
        print(f"Name list loaded: {len(names)} name(s) checked (names are never shown).")
    if problems:
        print(f"Data check FAILED: {len(problems)} thing(s) to fix before this repo is safe to publish.\n")
        print("\n".join(problems))
        return 1
    print(f"Data check passed: {len(tracked_files())} files checked, nothing personal or secret found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
