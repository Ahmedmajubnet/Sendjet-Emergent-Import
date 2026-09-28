"""HTML + plain-text templates for the three transactional emails.

Kept as Python strings (no jinja / no external template engine — supply-chain
minimalism) with `{{ var }}` placeholders substituted via `str.replace`.

HTML rules used here (email-client-safe):
- Inline CSS only
- Table-based layout (Outlook still struggles with divs)
- No external stylesheets, no web fonts, no javascript
- One 600px content column, mobile-tolerant with `max-width: 100%` on wrappers
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

_VAR_RE = re.compile(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}")


def _brand_base() -> str:
    """Absolute base URL for hosted brand assets (logo) inside emails."""
    return os.environ.get("PUBLIC_SITE_URL", "https://sendjet.de").rstrip("/")


def _logo_url() -> str:
    return f"{_brand_base()}/sendjet-wordmark.png"


def render(template: str, **variables: Any) -> str:
    """Simple safe placeholder substitution. Missing keys raise KeyError."""
    missing: list[str] = []

    def _sub(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in variables:
            missing.append(name)
            return match.group(0)
        return str(variables[name])

    out = _VAR_RE.sub(_sub, template)
    if missing:
        raise KeyError(
            f"Template placeholders not filled: {sorted(set(missing))}"
        )
    return out


# ---------------------------------------------------------------------------
# Shared layout wrapper
# ---------------------------------------------------------------------------
_LAYOUT = """\
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{ subject }}</title></head>
<body style="margin:0;padding:0;background:#FDFAF5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1F1A17;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{ preheader }}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FDFAF5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #EBE5D9;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(31,26,23,0.06);">

        <!-- Brand accent bar -->
        <tr><td style="height:6px;background:#FF6B00;background:linear-gradient(90deg,#FF6B00 0%,#FF9E4D 100%);font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Header / logo -->
        <tr><td align="center" style="padding:32px 40px 10px 40px;background:#ffffff;">
          <img src="{{ logo_url }}" width="176" alt="SendJet" style="display:block;border:0;outline:none;text-decoration:none;height:auto;width:176px;max-width:60%;margin:0 auto;">
          <div style="margin-top:10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#FF6B00;font-weight:700;">Send Smart&nbsp;&middot;&nbsp;Travel Light</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:14px 40px 40px 40px;">
{{ body }}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:26px 40px 30px 40px;border-top:1px solid #EBE5D9;background:#FDFAF5;">
          <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#1F1A17;letter-spacing:-0.01em;">
            Send<span style="color:#FF6B00;">Jet</span>
          </p>
          <p style="margin:0 0 12px 0;font-size:12px;color:#8A817C;line-height:1.6;">
            The global community turning spare luggage space into affordable, human parcel delivery.
          </p>
          <p style="margin:0 0 10px 0;font-size:12px;color:#8A817C;line-height:1.6;">
            Questions? Just reply to this email, or write to
            <a href="mailto:info@sendjet.de" style="color:#FF6B00;text-decoration:none;font-weight:600;">info@sendjet.de</a>.
          </p>
          <p style="margin:0 0 12px 0;font-size:12px;line-height:1.8;">
            <a href="https://sendjet.de/marketplace" style="color:#5C534D;text-decoration:none;">Marketplace</a>
            &nbsp;<span style="color:#D9D1C5;">&bull;</span>&nbsp;
            <a href="https://sendjet.de/safety" style="color:#5C534D;text-decoration:none;">Safety</a>
            &nbsp;<span style="color:#D9D1C5;">&bull;</span>&nbsp;
            <a href="https://sendjet.de/impressum" style="color:#5C534D;text-decoration:none;">Impressum</a>
            &nbsp;<span style="color:#D9D1C5;">&bull;</span>&nbsp;
            <a href="https://sendjet.de/legal" style="color:#5C534D;text-decoration:none;">Privacy</a>
          </p>
          <p style="margin:0;font-size:11px;color:#A69E97;line-height:1.6;">
            &copy; {{ year }} SendJet. You&rsquo;re receiving this because you have a SendJet account.
          </p>
        </td></tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;">
        <tr><td align="center" style="padding:16px 24px 0 24px;">
          <p style="margin:0;font-size:11px;color:#B8AFA6;line-height:1.6;">SendJet &middot; Send Smart, Travel Light.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def _wrap(subject: str, body_html: str, *, preheader: str = "") -> str:
    return render(
        _LAYOUT,
        subject=subject,
        body=body_html,
        logo_url=_logo_url(),
        year=str(datetime.now(timezone.utc).year),
        preheader=preheader or subject,
    )


# ---------------------------------------------------------------------------
# 1. Welcome email
# ---------------------------------------------------------------------------
_WELCOME_BODY = """\
<h1 style="margin:8px 0 16px 0;font-size:28px;line-height:1.25;font-weight:600;color:#1F1A17;">
  Welcome to SendJet, {{ first_name }}.
</h1>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#5C534D;">
  You&rsquo;re now part of a global community turning spare luggage space into
  affordable, human parcel delivery. Here&rsquo;s how it works:
</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;">
  <tr><td style="padding:12px 0;border-bottom:1px solid #F5EFE6;">
    <strong style="color:#FF6B00;font-size:13px;letter-spacing:0.05em;">STEP 1</strong>
    <div style="margin-top:4px;font-size:16px;color:#1F1A17;font-weight:600;">Post your trip or your parcel</div>
    <div style="margin-top:2px;font-size:14px;color:#5C534D;line-height:1.55;">
      Tell the community where you&rsquo;re going, or what you&rsquo;d like sent.
    </div>
  </td></tr>
  <tr><td style="padding:12px 0;border-bottom:1px solid #F5EFE6;">
    <strong style="color:#FF6B00;font-size:13px;letter-spacing:0.05em;">STEP 2</strong>
    <div style="margin-top:4px;font-size:16px;color:#1F1A17;font-weight:600;">Match &amp; agree together</div>
    <div style="margin-top:2px;font-size:14px;color:#5C534D;line-height:1.55;">
      Find a verified traveler or sender on your route. Chat and agree on a fair price.
    </div>
  </td></tr>
  <tr><td style="padding:12px 0;">
    <strong style="color:#FF6B00;font-size:13px;letter-spacing:0.05em;">STEP 3</strong>
    <div style="margin-top:4px;font-size:16px;color:#1F1A17;font-weight:600;">Track &amp; pay on delivery</div>
    <div style="margin-top:2px;font-size:14px;color:#5C534D;line-height:1.55;">
      Payment is held in escrow and released only when the recipient confirms handoff.
    </div>
  </td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px 0;">
  <tr>
    <td style="padding-right:12px;">
      <a href="{{ post_trip_url }}" style="display:inline-block;background:#FF6B00;color:#ffffff;text-decoration:none;font-weight:500;padding:14px 24px;border-radius:9999px;">Post your first trip</a>
    </td>
    <td>
      <a href="{{ post_parcel_url }}" style="display:inline-block;background:#ffffff;border:1px solid #EBE5D9;color:#1F1A17;text-decoration:none;font-weight:500;padding:13px 24px;border-radius:9999px;">Post your first parcel</a>
    </td>
  </tr>
</table>

<p style="margin:16px 0 0 0;font-size:14px;line-height:1.6;color:#5C534D;">
  You can also just <a href="{{ browse_url }}" style="color:#FF6B00;text-decoration:none;">browse the marketplace</a>
  &mdash; no next steps required.
</p>

<p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#8A817C;">
  Payments are held in escrow. Travelers are identity-verified before their first match. Your money is only released when the recipient confirms delivery.
</p>
"""

_WELCOME_TEXT = """\
Welcome to SendJet, {{ first_name }}.

You're now part of a global community turning spare luggage space into
affordable, human parcel delivery.

How it works:
  1. Post your trip or your parcel.
  2. Match with a verified traveler or sender on your route.
  3. Track & pay on delivery — funds held in escrow until handoff confirmed.

Post your first trip:   {{ post_trip_url }}
Post your first parcel: {{ post_parcel_url }}
Or just browse:         {{ browse_url }}

Questions? Reply to this email or write to info@sendjet.de.
—
SendJet · Send Smart, Travel Light.
"""


def welcome_email(*, first_name: str, post_trip_url: str, post_parcel_url: str,
                  browse_url: str) -> tuple[str, str, str]:
    """Return (subject, html, text) for the welcome message."""
    subject = f"Welcome to SendJet, {first_name} 🌍"
    html = _wrap(subject, render(_WELCOME_BODY,
                                 first_name=first_name,
                                 post_trip_url=post_trip_url,
                                 post_parcel_url=post_parcel_url,
                                 browse_url=browse_url),
                 preheader="Post a trip, send a parcel, and pay safely with escrow.")
    text = render(_WELCOME_TEXT,
                  first_name=first_name,
                  post_trip_url=post_trip_url,
                  post_parcel_url=post_parcel_url,
                  browse_url=browse_url)
    return subject, html, text


# ---------------------------------------------------------------------------
# 2. Email-verification email
# ---------------------------------------------------------------------------
_VERIFY_BODY = """\
<h1 style="margin:8px 0 16px 0;font-size:26px;line-height:1.25;font-weight:600;color:#1F1A17;">
  Confirm your email
</h1>
<p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#5C534D;">
  Hi {{ first_name }} &mdash; please confirm this is your email address so we can send you
  match updates and payment receipts. It only takes one click.
</p>
<p style="margin:16px 0 24px 0;">
  <a href="{{ verify_url }}" style="display:inline-block;background:#FF6B00;color:#ffffff;text-decoration:none;font-weight:500;padding:14px 28px;border-radius:9999px;">Confirm email</a>
</p>
<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#8A817C;">
  Or paste this link into your browser:
</p>
<p style="margin:0 0 20px 0;font-size:13px;line-height:1.4;color:#5C534D;word-break:break-all;">
  <a href="{{ verify_url }}" style="color:#FF6B00;text-decoration:underline;">{{ verify_url }}</a>
</p>
<p style="margin:16px 0 0 0;font-size:13px;line-height:1.6;color:#8A817C;">
  This link expires in {{ ttl_hours }} hours. If you didn&rsquo;t create a SendJet account, you can safely ignore this email.
</p>
"""

_VERIFY_TEXT = """\
Confirm your email

Hi {{ first_name }} — please confirm this is your email address so we can send
you match updates and payment receipts.

Confirm here:
{{ verify_url }}

This link expires in {{ ttl_hours }} hours. If you didn't create a SendJet
account, you can safely ignore this email.

—
SendJet · info@sendjet.de
"""


def verify_email(*, first_name: str, verify_url: str, ttl_hours: int) -> tuple[str, str, str]:
    subject = "Please confirm your email · SendJet"
    html = _wrap(subject, render(_VERIFY_BODY,
                                 first_name=first_name,
                                 verify_url=verify_url,
                                 ttl_hours=ttl_hours),
                 preheader="Confirm your email in one click to activate your account.")
    text = render(_VERIFY_TEXT,
                  first_name=first_name,
                  verify_url=verify_url,
                  ttl_hours=ttl_hours)
    return subject, html, text


# ---------------------------------------------------------------------------
# 3. Password-reset email
# ---------------------------------------------------------------------------
_RESET_BODY = """\
<h1 style="margin:8px 0 16px 0;font-size:26px;line-height:1.25;font-weight:600;color:#1F1A17;">
  Reset your password
</h1>
<p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#5C534D;">
  Hi {{ first_name }} &mdash; we received a request to reset the password for your SendJet account.
  Click below to choose a new one.
</p>
<p style="margin:16px 0 24px 0;">
  <a href="{{ reset_url }}" style="display:inline-block;background:#FF6B00;color:#ffffff;text-decoration:none;font-weight:500;padding:14px 28px;border-radius:9999px;">Reset password</a>
</p>
<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#8A817C;">
  Or paste this link into your browser:
</p>
<p style="margin:0 0 20px 0;font-size:13px;line-height:1.4;color:#5C534D;word-break:break-all;">
  <a href="{{ reset_url }}" style="color:#FF6B00;text-decoration:underline;">{{ reset_url }}</a>
</p>
<p style="margin:16px 0 0 0;font-size:13px;line-height:1.6;color:#8A817C;">
  This link expires in {{ ttl_minutes }} minutes. If you didn&rsquo;t ask to reset your password,
  you can ignore this email &mdash; your existing password will keep working.
</p>
"""

_RESET_TEXT = """\
Reset your password

Hi {{ first_name }} — we received a request to reset your SendJet password.

Reset here:
{{ reset_url }}

This link expires in {{ ttl_minutes }} minutes. If you didn't ask to reset
your password, you can ignore this email — your existing password will keep
working.

—
SendJet · info@sendjet.de
"""


def password_reset_email(*, first_name: str, reset_url: str, ttl_minutes: int) -> tuple[str, str, str]:
    subject = "Reset your SendJet password"
    html = _wrap(subject, render(_RESET_BODY,
                                 first_name=first_name,
                                 reset_url=reset_url,
                                 ttl_minutes=ttl_minutes),
                 preheader="Reset your SendJet password — link expires soon.")
    text = render(_RESET_TEXT,
                  first_name=first_name,
                  reset_url=reset_url,
                  ttl_minutes=ttl_minutes)
    return subject, html, text
