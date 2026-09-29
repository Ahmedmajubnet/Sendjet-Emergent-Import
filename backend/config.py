"""Validated configuration. Importing this module never loads .env or connects."""
import os
from dataclasses import dataclass, field
from urllib.parse import urlsplit


def required_secret(env):
    value = env.get("SECRET_KEY", "")
    if not value.strip() or value.strip() in {"your-secret-key-change-in-production", "sendjet-dev-secret-do-not-use-in-prod"}:
        raise ValueError("SECRET_KEY must be explicitly configured; default secrets are forbidden")
    return value


def origin(value, name, production=False):
    try:
        parsed = urlsplit(value)
        valid = (parsed.scheme in ({"https"} if production else {"https", "http"})
                 and parsed.hostname and parsed.username is None and parsed.password is None
                 and parsed.path in {"", "/"} and not parsed.query and not parsed.fragment
                 and "*" not in value and "\\" not in value
                 and not any(character.isspace() for character in value))
        parsed.port  # Validate port without including the value in errors.
    except ValueError:
        valid = False
    if not valid:
        raise ValueError(f"{name} must be an explicit {'HTTPS ' if production else ''}origin without credentials or a path")
    return value.rstrip("/")


@dataclass(frozen=True)
class Settings:
    app_env: str
    secret_key: str = field(repr=False)
    stripe_key: str = field(repr=False)
    webhook_secret: str = field(repr=False)
    public_site_url: str
    cors_origins: tuple
    enable_demo_data: bool

    @property
    def stripe_live(self):
        return self.stripe_key.startswith("sk_live_")


def load_settings(env=None):
    env = os.environ if env is None else env
    app_env = env.get("APP_ENV", "development").strip().lower()
    if app_env not in {"development", "preview", "production"}:
        raise ValueError("APP_ENV must be development, preview, or production")
    production = app_env == "production"
    secret = required_secret(env)
    primary = env.get("SENDJET_STRIPE_KEY", "").strip()
    alias = env.get("STRIPE_API_KEY", "").strip()
    if primary and alias and primary != alias:
        raise ValueError("SENDJET_STRIPE_KEY and STRIPE_API_KEY conflict; configure one key")
    stripe_key = primary or alias
    if stripe_key and not stripe_key.startswith(("sk_test_", "sk_live_")):
        raise ValueError("Stripe key must be a Stripe secret key in test or live mode")
    if production and not stripe_key.startswith("sk_live_"):
        raise ValueError("Production requires a live Stripe secret key")
    if not production and stripe_key.startswith("sk_live_") and env.get("ALLOW_LIVE_STRIPE") != "true":
        raise ValueError("Live Stripe is forbidden outside production unless ALLOW_LIVE_STRIPE=true")
    webhook_secret = env.get("STRIPE_WEBHOOK_SECRET", "").strip()
    if production and not webhook_secret.startswith("whsec_"):
        raise ValueError("Production requires STRIPE_WEBHOOK_SECRET")
    site = env.get("PUBLIC_SITE_URL", "" if production else "http://localhost:3000").strip()
    site = origin(site, "PUBLIC_SITE_URL", production)
    cors = tuple(x.strip() for x in env.get("CORS_ORIGINS", "" if production else site).split(",") if x.strip())
    if not cors or (production and "*" in cors):
        raise ValueError("CORS_ORIGINS must explicitly list production frontend origins; wildcard is forbidden")
    cors = tuple(origin(x, "CORS_ORIGINS", production) if x != "*" else x for x in cors)
    if production and site not in cors:
        raise ValueError("CORS_ORIGINS must include PUBLIC_SITE_URL")
    demo = env.get("ENABLE_DEMO_DATA", "true").lower()
    if demo not in {"true", "false"}:
        raise ValueError("ENABLE_DEMO_DATA must be true or false")
    return Settings(app_env, secret, stripe_key, webhook_secret, site, cors, demo == "true")
