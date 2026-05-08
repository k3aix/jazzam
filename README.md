# Jazzam

**Jazzam** is a web app for identifying jazz standards by melody. You hum or tap a tune on a virtual piano — Jazzam tells you what it is.

The idea is simple: you have a melody stuck in your head, you know it's a standard, but the title won't come. Jazzam lets you tap it out on a virtual piano and find it — no need to know the key, the tempo, or where in the tune you are.

Live at **[jazzam.it](https://jazzam.it)**.

---

## How it works

You play a melody on the on-screen piano keyboard (or use your computer keyboard). Jazzam captures the sequence of **pitch intervals** — the semitone distances between consecutive notes — which makes the search completely transposition-independent. The rhythm of what you play (the relative durations between notes) is captured as a secondary signal.

The search engine runs a **2D Levenshtein distance** over a sliding window of the database's interval sequences, matching both pitch contour and rhythm simultaneously. Pitch is the primary axis; rhythm acts as a tiebreaker and confidence booster. Results are ranked by a combined confidence score and returned in real time as you play.

---

## Code structure

```
jazzam/
├── frontend/                  # React + TypeScript (Vite, TailwindCSS)
│   └── src/
│       ├── components/
│       │   ├── Piano/         # Virtual keyboard, recording mode
│       │   └── SearchResults/ # Result cards with confidence scores
│       └── services/          # API client, logger
│
├── backend/
│   ├── standards-service/     # Node.js / TypeScript — standards CRUD, MIDI import
│   └── search-service/        # C# / .NET — interval matching engine
│
├── tests/
│   ├── recognition/           # Automated recognition test suite
│   └── tuning/                # Algorithm parameter sweep (OAT)
│
└── .github/workflows/         # CI/CD pipelines
```

The **standards service** (Node.js) owns the database: it stores interval sequences extracted from MIDI files, serves them to the search engine, and exposes an admin API for data management.

The **search service** (C# / .NET) is the compute core. It fetches all standards from the standards service, runs the 2D Levenshtein sliding-window search, and returns ranked results with per-result confidence broken down into pitch and rhythm components.

The **frontend** (React / TypeScript) handles piano input, recording state, real-time debounced search calls, and result display.

---

## API

The two backend services expose REST APIs consumed by the frontend and by each other.

### Search Service (`/api`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/search/intervals` | Pitch-only search |
| `POST` | `/search/rhythm` | Combined pitch + rhythm search (primary) |
| `GET` | `/health` | Health check |

**Rhythm search request:**
```json
{
  "intervals": [-2, -2, -3, -2, 2, 3, 5],
  "durationRatios": [24, 4, 8, 4, 32, 12, 16],
  "maxResults": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "...",
      "title": "Autumn In New York",
      "matchConfidence": 0.96,
      "pitchConfidence": 0.96,
      "rhythmConfidence": 0.74,
      "matchPosition": 0,
      "matchLength": 7,
      "intervalSequence": [...]
    }
  ],
  "queryTime": 38,
  "totalMatches": 1
}
```

### Standards Service (`/api`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/standards` | List all standards with interval sequences |
| `POST` | `/standards` | Add a standard |
| `DELETE` | `/standards/:id` | Remove a standard |
| `POST` | `/feedback` | Submit user confirmation or rejection |

Feedback is persisted and later used to build tuning test cases.

---

## Testing

### Recognition tests

The recognition suite (`tests/recognition`) verifies that the search engine correctly identifies standards from their own interval sequences. It extracts interval windows directly from the database, optionally injects errors (added notes, removed notes, modified intervals), and checks whether the correct standard appears in the top results.

```bash
# Test all standards with 8-note sequences, 2 random errors
npx ts-node src/index.ts --length 8 --errors 2 --error-type both

# Test a specific standard
npx ts-node src/index.ts --standard "Autumn Leaves" --length 6
```

### Tuning tests (parameter sweep)

The tuning suite (`tests/tuning`) runs an **OAT (One-At-a-Time) parameter sweep** over the search algorithm's configuration — pitch/rhythm weights, tolerance thresholds, confidence cutoffs. It uses real-world test cases extracted from production feedback logs (confirmed user identifications) to find the parameter combination that maximises recognition accuracy.

```bash
# Extract confirmed cases from production logs
npx ts-node src/index.ts extract --log "/logs/search-*.log"

# Run OAT sweep against a baseline config
npx ts-node src/index.ts sweep --baseline configs/baseline.json
```

### Regression tests

Planned — will run whenever the database is updated with new standards, to catch regressions in recognition accuracy before the changes go live.

---

## Deployment

Jazzam runs on a self-hosted **k3s** cluster. The cluster configuration, manifests, and infrastructure tooling live in a separate repo: [k3aix/aac-k3s](https://github.com/k3aix/aac-k3s).

### Cluster services

Beyond the Jazzam application itself, the cluster runs:

| Service | Purpose |
|---------|---------|
| **Rancher** | Cluster management UI |
| **Longhorn** | Distributed block storage for persistent volumes |
| **Grafana + Prometheus** | Metrics, dashboards, and alerting |
| **Docker Registry + UI** | Internal image registry used by CI builds |
| **Cloudflare Tunnel** | Exposes services to the internet without opening inbound ports |

### Namespaces

| Namespace | Contents |
|-----------|---------|
| `jazzam` | Production: frontend, standards service, search service |
| `jazzam-staging` | Staging: same stack, auto-deployed on every push to `main` |

---

## DevOps & GitOps

### CI — build pipeline

Every push to `main` triggers a GitHub Actions workflow that builds Docker images for all three services using **QEMU-based multi-arch builds** (linux/amd64 + linux/arm64) via a reusable workflow in `aac-k3s`. Images are pushed to the internal registry and tagged with the commit SHA and `:latest`. On success, the staging environment is automatically updated via a `rollout restart`.

### CD — release workflow

Releases are triggered manually from the GitHub Actions UI with a `patch / minor / major` selector. The release workflow:

1. Bumps the `VERSION` file
2. Re-tags the current `:latest` images as `v<new-version>` using `docker buildx imagetools` (no rebuild)
3. Deploys to production via `kubectl set image`
4. Updates the image tags in the `aac-k3s` manifest repo (GitOps)
5. Commits the new `VERSION` and pushes a git tag

### Staging environment

The staging environment at **[dev.jazzam.it](https://dev.jazzam.it)** is protected by **Cloudflare Zero Trust Access** — access requires an email OTP sent to an approved address. The tunnel runs as a `cloudflared` deployment inside the `jazzam-staging` namespace, routing traffic directly to the frontend service without exposing any cluster port publicly.

### Self-hosted runners

CI jobs run on **ARC (Actions Runner Controller)** pods inside the cluster. Runners are ephemeral: a new pod is spun up for each job and torn down on completion.
