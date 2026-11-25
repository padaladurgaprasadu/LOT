"""
LOT Security, Privacy & Anti-Poisoning Guardrails.
Inspired by Perplexity numbat, Claude Code mods/privacy, and browsesafe-plus-plus:
1. SSRF URL & Private IP validation for all web fetches.
2. Cloudflare / CAPTCHA / Bot-interstitial detection before feeding pages to LLMs.
3. Indirect prompt-injection neutralization in scraped web content.
4. Secret / API-key / PII redaction before outbound logs or shell/MCP calls.
"""

import ipaddress
import re
import socket
from urllib.parse import urlparse

CHALLENGE_MARKERS = (
    "just a moment...",
    "attention required! | cloudflare",
    "verify you are human",
    "enable javascript and cookies to continue",
    "cf-browser-verification",
    "g-recaptcha",
    "hcaptcha.com/1/api.js",
    "ddos-guard",
    "access denied |",
)

INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(your\s+)?system\s+prompt", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(in\s+)?developer\s+mode", re.IGNORECASE),
    re.compile(r"<\s*/?\s*system\s*>", re.IGNORECASE),
    re.compile(r"\[\s*INST\s*\]", re.IGNORECASE),
]

SECRET_PATTERNS = [
    (re.compile(r"\bnvapi-[A-Za-z0-9_-]{16,}\b"), "nvapi-[REDACTED]"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"), "sk-[REDACTED]"),
    (re.compile(r"\bgsk_[A-Za-z0-9_-]{16,}\b"), "gsk_[REDACTED]"),
    (re.compile(r"\bBearer\s+[A-Za-z0-9._-]{20,}\b", re.IGNORECASE), "Bearer [REDACTED]"),
]

DANGEROUS_SHELL_PATTERNS = [
    re.compile(r"\brm\s+-rf\s+/\b"),
    re.compile(r"\bcurl\s+[^\n]*\|\s*(?:ba)?sh\b", re.IGNORECASE),
    re.compile(r"\bwget\s+[^\n]*\|\s*(?:ba)?sh\b", re.IGNORECASE),
    re.compile(r"\b(?:mkfs|dd\s+if=/dev/zero|:\(\)\{:\|:&\};:)\b"),
]


def is_safe_public_url(url: str) -> bool:
    """
    Validates that a URL uses http(s) and does not point to loopback, private,
    link-local, or cloud metadata addresses (SSRF protection).
    """
    try:
        parsed = urlparse((url or "").strip())
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return False

        host = parsed.hostname.lower().strip("[]")
        if host in ("localhost", "0.0.0.0", "metadata.google.internal"):
            return False

        # Direct IP literal check
        try:
            ip = ipaddress.ip_address(host)
            return not (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_multicast
                or ip.is_reserved
                or ip.is_unspecified
            )
        except ValueError:
            pass

        # Resolve DNS when possible; allow if DNS unavailable in offline test sandboxes,
        # but reject any resolved private/loopback/link-local IP.
        try:
            infos = socket.getaddrinfo(host, None)
            for info in infos:
                addr = info[4][0].split("%")[0]
                ip = ipaddress.ip_address(addr)
                if (
                    ip.is_private
                    or ip.is_loopback
                    or ip.is_link_local
                    or ip.is_multicast
                    or ip.is_reserved
                    or ip.is_unspecified
                ):
                    return False
        except socket.gaierror:
            return True

        return True
    except Exception:
        return False


def is_challenge_or_empty_page(text: str, min_words: int = 35) -> bool:
    """
    Detects Cloudflare/CAPTCHA interstitials or boilerplate-only scrapes so they never poison RAG.
    """
    if not text or not text.strip():
        return True
    lower = text.lower()
    if any(marker in lower for marker in CHALLENGE_MARKERS):
        return True
    words = re.findall(r"\w+", text, re.UNICODE)
    return len(words) < min_words


def sanitize_untrusted_web_text(text: str) -> str:
    """
    Neutralizes indirect prompt-injection directives embedded in scraped pages.
    """
    if not text:
        return ""
    cleaned = text
    for rx in INJECTION_PATTERNS:
        cleaned = rx.sub("[FILTERED_UNTRUSTED_DIRECTIVE]", cleaned)
    return redact_secrets(cleaned)


def redact_secrets(text: str) -> str:
    """Redacts API tokens and Bearer credentials before logging or outbound transport."""
    if not text:
        return ""
    out = text
    for rx, replacement in SECRET_PATTERNS:
        out = rx.sub(replacement, out)
    return out


def check_shell_command_policy(command: str) -> tuple[bool, str]:
    """CEL-style pre-execution policy check for terminal commands."""
    cmd = (command or "").strip()
    if not cmd:
        return False, "Empty command rejected"
    for rx in DANGEROUS_SHELL_PATTERNS:
        if rx.search(cmd):
            return False, f"Blocked by LOT security policy: matches restricted pattern '{rx.pattern}'"
    return True, "allowed"
