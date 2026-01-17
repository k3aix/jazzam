# Jazz Melody Finder

A full-stack web application that identifies jazz standards from user-played melodies using interval sequence matching. This project serves as a comprehensive learning platform for modern cloud-native development, microservices architecture, and DevOps practices.

## Features

- **Interactive Virtual Piano**: 2-octave keyboard (C4 to B5) with mouse/keyboard input
- **🔊 Real-Time Audio Playback**: Hear piano sounds as you play using Web Audio API
- **🔴 Recording Mode**: Play freely, then record when ready to identify a melody
- **Real-time Melody Recognition**: Converts played notes to interval sequences
- **Jazz Standards Database**: PostgreSQL database with Real Book standards
- **Intelligent Search**: Fuzzy matching algorithm for melody identification
- **Microservices Architecture**: Separate services for melody processing, search, and standards
- **Cloud-Native Deployment**: Kubernetes orchestration on AWS EKS

## Technology Stack

### Frontend
- **React 18** with **TypeScript**
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **Axios** for API communication

### Backend Services
- **Melody Service**: C# / .NET 8 - Note-to-interval conversion
- **Search Service**: C# / .NET 8 - Pattern matching algorithm
- **Standards Service**: TypeScript / Node.js - CRUD operations

### Infrastructure
- **PostgreSQL 16**: Jazz standards database
- **Redis 7**: Caching layer
- **Docker**: Containerization
- **Kubernetes**: Orchestration
- **Terraform**: Infrastructure as Code (AWS)

### DevOps & Security
- **GitHub Actions**: CI/CD pipeline
- **Trivy/Snyk**: Container security scanning
- **AWS GuardDuty**: Threat detection
- **AWS Secrets Manager**: Secrets management

## Project Structure

```
jazz-melody-finder/
├── frontend/                    # React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── Piano/          # Virtual keyboard
│   │   │   └── SearchResults/   # Results display
│   │   ├── services/           # API client
│   │   └── types/              # TypeScript interfaces
│   └── package.json
│
├── services/
│   ├── melody-service/         # C# service
│   ├── search-service/         # C# service
│   └── standards-service/      # TypeScript service
│
├── database/
│   ├── migrations/             # SQL schema
│   └── seeds/                  # Mock data
│
├── infrastructure/
│   ├── kubernetes/             # K8s manifests
│   └── terraform/              # AWS IaC
│
└── docker-compose.yml          # Local development
```

## Getting Started

### Prerequisites

1. **Install Docker Desktop** (for local database)
   - Download from: https://www.docker.com/products/docker-desktop
   - Verify: `docker --version`

2. **Install Node.js 20+** (for frontend)
   - Download from: https://nodejs.org/
   - Verify: `node --version` and `npm --version`

3. **Install .NET 8 SDK** (for backend services - later)
   - Download from: https://dotnet.microsoft.com/download
   - Verify: `dotnet --version`

### Phase 1: Run Frontend with Mock Data (Start Here!)

This gets you started immediately without needing the backend.

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open your browser to http://localhost:3000 and start playing the piano!

The frontend will use mock data for search results until you set up the backend services.

### Phase 2: Set Up Local Database (Optional)

```bash
# From project root
docker compose up -d

# Verify database is running
docker compose ps

# Check logs
docker compose logs postgres

# Access database (optional)
# pgAdmin available at: http://localhost:5050
# Email: admin@jazz.local
# Password: admin123
```

Database credentials:
- Host: localhost:5432
- Database: jazz_standards
- User: jazzuser
- Password: jazzpass123

### Phase 3: Build Backend Services (Coming Soon)

Instructions for setting up:
1. Standards Service (TypeScript)
2. Melody Service (C#)
3. Search Service (C#)

See `/docs/backend-setup.md` (to be created)

## Development Workflow

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Database Management

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f postgres

# Reset database (WARNING: destroys data)
docker compose down -v
docker compose up -d
```

### Environment Variables

Create `frontend/.env` from the example:

```bash
cp frontend/.env.example frontend/.env
```

Edit as needed:
```
VITE_API_URL=http://localhost:4000/api
```

## How It Works

### 1. Audio Playback
The piano plays realistic sounds using the Web Audio API:
- Each key triggers its actual frequency (Hz)
- Piano-like envelope (Attack-Decay-Sustain-Release)
- Works in both free play and recording mode

### 2. Melody Capture
When recording mode is active, each note is captured with:
- Note name (e.g., "C4", "D#4")
- Frequency (Hz)
- Timestamp

### 3. Interval Conversion
Notes are converted to interval sequences (semitone differences):
- C4 → D4 → E4 → G4 becomes `[2, 2, 3]`
- This makes the melody transposition-independent

### 4. Pattern Matching
The search service compares the interval sequence against the database:
- Exact matching for precise results
- Fuzzy matching with tolerance for variations
- Confidence scoring based on match quality

### 5. Results Display
Matched jazz standards are displayed with:
- Title, composer, year
- Match confidence score
- Musical details (key, time signature)
- Book source and page number

## API Design

### Search Endpoint

```typescript
POST /api/standards/search

Request:
{
  "intervals": [2, 2, 1, -2, -1],
  "tolerance": 0,        // 0 = exact, 1+ = fuzzy
  "maxResults": 10
}

Response:
{
  "results": [
    {
      "id": "uuid",
      "title": "Autumn Leaves",
      "composer": "Joseph Kosma",
      "matchConfidence": 0.95,
      "intervalSequence": [2, 2, 1, -2, -1, 2, ...],
      ...
    }
  ],
  "queryTime": 45,
  "totalMatches": 3
}
```

## Learning Objectives

### Phase 1 (Current)
- [x] React + TypeScript fundamentals
- [x] Component design and state management
- [x] API integration patterns
- [x] Docker Compose for local dev

### Phase 2 (Next)
- [ ] C# / .NET Web API development
- [ ] TypeScript backend with Express
- [ ] PostgreSQL schema design
- [ ] Redis caching strategies

### Phase 3 (Later)
- [ ] Docker containerization
- [ ] Kubernetes deployment
- [ ] Terraform infrastructure as code
- [ ] CI/CD pipeline setup
- [ ] Security scanning and hardening

## Documentation

Detailed guides are available in the `docs/` folder:

1. **[Getting Started Guide](docs/01-GETTING_STARTED.md)** - Step-by-step setup instructions
2. **[Project Summary](docs/02-PROJECT_SUMMARY.md)** - Complete overview of what was built
3. **[Quick Start](docs/03-QUICK_START.md)** - Fast-track checklist to get running
4. **[Audio & Recording](docs/04-AUDIO_AND_RECORDING.md)** - Real-time audio and recording mode features
5. **[Piano Sound Update](docs/05-PIANO_SOUND_UPDATE.md)** - Enhanced piano sound with harmonics
6. **[Keyboard Input](docs/06-KEYBOARD_INPUT.md)** - PC keyboard control documentation

## Next Steps

1. **Install Docker Desktop and Node.js** (if not already installed)
2. **Run the frontend**: `cd frontend && npm install && npm run dev`
3. **Play with the piano** and see mock search results
4. **Explore the code** in `frontend/src/components/Piano/`
5. **Learn React + TypeScript** by modifying components
6. **Later**: Set up backend services and connect to real API

## Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [PostgreSQL Tutorial](https://www.postgresql.org/docs/)
- [Docker Getting Started](https://docs.docker.com/get-started/)

## Contributing

This is a personal learning project, but suggestions are welcome! Feel free to:
- Open issues for bugs or feature ideas
- Submit pull requests with improvements
- Share your own learning experiences

## License

MIT License - Feel free to use this project for learning purposes.

---

**Status**: Phase 1 Complete - Frontend with audio playback and recording mode ✅

**Latest Updates**:
- ✅ Web Audio API for real-time piano sound
- ✅ Recording mode workflow (free play → record → search)
- ✅ PC keyboard input (A-; keys + octave shifting with Z/X)
- ✅ Harmonic synthesis (5 partials for realistic piano sound)
- ✅ Monophonic mode (one note at a time)
- ✅ Press-and-hold duration control

See [documentation](docs/) for detailed feature guides.

**Next Milestone**: Build Standards Service (TypeScript) and connect to PostgreSQL
