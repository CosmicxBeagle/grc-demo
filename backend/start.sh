#!/bin/sh
set -e

# ── Schema migrations ─────────────────────────────────────────────────────────
# RUN_MIGRATIONS=true   (default) runs "alembic upgrade head" at startup.
#
# Local / single-instance deployments: leave at true for convenience.
#
# Scaled / production deployments: set RUN_MIGRATIONS=false and run migrations
# as a controlled release step (CI/CD job or init-container) BEFORE rolling out
# new app instances. Running alembic on every instance startup in a scaled
# environment creates a race window if multiple containers start simultaneously.
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "==> Running database migrations..."
    alembic upgrade head
else
    echo "==> Skipping migrations (RUN_MIGRATIONS=false)"
fi

# ── Demo data seeding ─────────────────────────────────────────────────────────
# SEED_DEMO_DATA=true   inserts demo users (alice, bob, carol, dave, erin) on
#                       startup. The seed script is idempotent — safe to run
#                       multiple times. Useful for local dev and demo environments.
#
# SEED_DEMO_DATA=false  (recommended for production) skips seeding entirely.
#                       Set this in any environment where real user accounts are
#                       managed through the admin UI or an IdP.
SEED_DEMO_DATA="${SEED_DEMO_DATA:-true}"
if [ "$SEED_DEMO_DATA" = "true" ]; then
    echo "==> Seeding demo data..."
    python -m app.db.seed
else
    echo "==> Skipping demo seed (SEED_DEMO_DATA=false)"
fi

# ── Start API server ──────────────────────────────────────────────────────────
echo "==> Starting GRC API server (workers=${UVICORN_WORKERS:-2})..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers ${UVICORN_WORKERS:-1}
