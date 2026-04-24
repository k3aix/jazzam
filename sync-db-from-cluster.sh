#!/usr/bin/env bash
# Sync the jazz_standards table from the cluster DB to the local Mac Mini DB.
# Cluster is the source of truth. Run this before a local test session.
#
# For running imports AGAINST the cluster directly, start a port-forward first:
#   kubectl port-forward -n postgres svc/postgres-postgresql-primary 15432:5432 &
#   # then run the import script pointing to localhost:15432

set -euo pipefail

CLUSTER_NS=postgres
CLUSTER_SVC=postgres-postgresql-primary
CLUSTER_DB=jazz-postgres
CLUSTER_USER=postgres
CLUSTER_PASS='@bn&3^t%u@Y`kA3;`NeV'
LOCAL_FORWARD_PORT=15432

LOCAL_CONTAINER=jazz-postgres
LOCAL_DB=jazz_standards
LOCAL_USER=jazzuser

echo "==> Starting port-forward to cluster postgres..."
kubectl port-forward -n "$CLUSTER_NS" "svc/$CLUSTER_SVC" "${LOCAL_FORWARD_PORT}:5432" &
PF_PID=$!
trap 'kill "$PF_PID" 2>/dev/null; echo "==> Port-forward closed."' EXIT

sleep 2

echo "==> Syncing jazz_standards: cluster → local..."
PGPASSWORD="$CLUSTER_PASS" pg_dump \
  -h localhost -p "$LOCAL_FORWARD_PORT" \
  -U "$CLUSTER_USER" \
  -d "$CLUSTER_DB" \
  --no-owner --no-privileges \
  --clean --if-exists \
  -t jazz_standards \
| docker exec -i "$LOCAL_CONTAINER" \
  psql -U "$LOCAL_USER" -d "$LOCAL_DB"

echo "==> Done — local DB is now in sync with the cluster."
