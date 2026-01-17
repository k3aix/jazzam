# Getting Started with Jazz Melody Finder

Welcome! This guide will help you get the project running step by step.

## Quick Start (5 minutes)

### Step 1: Install Prerequisites

You'll need:

1. **Node.js 20+** - https://nodejs.org/
2. **Docker Desktop** - https://www.docker.com/products/docker-desktop (optional for Phase 1)

Check if already installed:
```bash
node --version   # Should be v20+
npm --version    # Should be 10+
docker --version # Should be 20+
```

### Step 2: Run the Frontend

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

You should see output like:
```
  VITE v6.0.3  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### Step 3: Open in Browser

Open http://localhost:3000 in your web browser.

You should see:
- A header: "Jazz Melody Finder"
- A virtual 2-octave piano keyboard
- Instructions on how to use the app

### Step 4: Play with the Piano

1. Click the piano keys to play notes
2. Watch the "Played Notes" section update
3. After 2+ notes, see the "Interval Sequence"
4. After 3+ notes, search results will appear below (mock data)

**That's it!** You now have a working frontend with mock data.

## Understanding What You Built

### What's Working Now
- ✅ React + TypeScript frontend
- ✅ Virtual piano with 24 keys (2 octaves)
- ✅ Note capture and interval calculation
- ✅ Mock search results display
- ✅ Auto-search as you play

### What's NOT Working Yet
- ❌ Backend services (will build later)
- ❌ Real database (PostgreSQL)
- ❌ Actual jazz standards data
- ❌ Advanced search algorithms

### How Mock Mode Works

The frontend currently uses mock data defined in:
- [frontend/src/services/api.ts](frontend/src/services/api.ts#L11-L42)

It simulates:
1. API delay (300ms)
2. Pattern matching algorithm
3. Confidence scoring
4. Result ranking

When you build the backend, you'll simply set `useMockData = false` and everything will connect to real APIs.

## Project Structure

```
frontend/src/
├── components/
│   ├── Piano/
│   │   ├── Piano.tsx          # Main piano component
│   │   └── PianoKey.tsx       # Individual key component
│   └── SearchResults/
│       ├── ResultsList.tsx    # Results container
│       └── StandardCard.tsx   # Single result card
├── services/
│   └── api.ts                 # API client (currently mock)
├── types/
│   └── index.ts               # TypeScript interfaces
├── App.tsx                    # Main app component
└── main.tsx                   # Entry point
```

## Common Issues

### Port 3000 Already in Use

If you get "port 3000 is already in use":

```bash
# Edit frontend/vite.config.ts
# Change: port: 3000
# To:     port: 3001
```

### Module Not Found Errors

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

These are just warnings - the app will still run. Fix them as you learn TypeScript!

## Next Steps - Learning Path

### Level 1: Frontend Exploration (You Are Here)
- [x] Get frontend running
- [ ] Read through `Piano.tsx` to understand how notes are captured
- [ ] Read through `api.ts` to see mock data and search logic
- [ ] Modify the piano (try 3 octaves instead of 2)
- [ ] Change the color scheme in TailwindCSS classes
- [ ] Add a "Play Sound" feature using Web Audio API

### Level 2: Database Setup
- [ ] Install Docker Desktop
- [ ] Run `docker compose up -d` from project root
- [ ] Explore PostgreSQL using pgAdmin (http://localhost:5050)
- [ ] Understand the database schema in `database/migrations/`
- [ ] View the 10 mock standards in the database

### Level 3: Build Standards Service (TypeScript)
- [ ] Create Express.js server
- [ ] Connect to PostgreSQL
- [ ] Implement `/api/standards` endpoint
- [ ] Implement `/api/standards/search` endpoint
- [ ] Connect frontend to real API
- [ ] Turn off mock mode in `api.ts`

### Level 4: Build C# Services
- [ ] Install .NET 8 SDK
- [ ] Create Melody Service
- [ ] Create Search Service with fuzzy matching
- [ ] Add Redis caching

### Level 5: DevOps Journey
- [ ] Containerize all services with Docker
- [ ] Set up Kubernetes locally (Minikube)
- [ ] Deploy to AWS EKS
- [ ] Implement CI/CD with GitHub Actions
- [ ] Add security scanning

## Customization Ideas

Try modifying the app to learn:

1. **Add More Octaves**
   - Edit `Piano.tsx`, change loop from 24 to 36 notes
   - Adjust CSS to handle wider keyboard

2. **Add Sound Playback**
   - Use Web Audio API
   - Create `audioService.ts`
   - Play frequencies when keys are clicked

3. **Better Results Display**
   - Add sorting options (by confidence, year, composer)
   - Add filtering (by key, time signature)
   - Add pagination

4. **Keyboard Input**
   - Map computer keyboard keys to piano keys
   - Add keyboard shortcuts (space = reset, etc.)

5. **Visual Improvements**
   - Animate key presses
   - Show loading spinner during search
   - Add dark mode toggle

## Getting Help

### Resources
- React: https://react.dev/learn
- TypeScript: https://www.typescriptlang.org/docs/handbook/intro.html
- Vite: https://vitejs.dev/guide/
- TailwindCSS: https://tailwindcss.com/docs

### Debugging

**See what's happening:**
```bash
# In browser, open DevTools (F12)
# Go to Console tab
# You'll see API calls and responses
```

**Check if server is running:**
```bash
# You should see:
# VITE v6.0.3  ready in 500 ms
# If not, cd to frontend/ and run: npm run dev
```

**Reset everything:**
```bash
cd frontend
rm -rf node_modules dist
npm install
npm run dev
```

## What You're Learning

### React Concepts
- ✅ Functional components
- ✅ Hooks (useState, useCallback, useEffect)
- ✅ Props and component composition
- ✅ Event handling
- ✅ Conditional rendering

### TypeScript Concepts
- ✅ Interfaces and types
- ✅ Type annotations
- ✅ Generic types
- ✅ Optional properties
- ✅ Type safety in React

### Modern Web Dev
- ✅ Vite for fast development
- ✅ TailwindCSS utility-first styling
- ✅ Responsive design
- ✅ Component-based architecture
- ✅ API client patterns

### Music Theory
- ✅ Scientific pitch notation (C4, D#4)
- ✅ Musical intervals (semitones)
- ✅ Frequency calculations
- ✅ MIDI note numbers
- ✅ Transposition independence

## Have Fun!

This is a learning project - break things, experiment, and learn from errors. The best way to learn is by doing!

**Happy coding!** 🎹🎵
