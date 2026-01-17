# Quick Start Checklist

Follow these steps in order to get your Jazz Melody Finder up and running!

## Step 1: Install Node.js ⬜

- [ ] Download Node.js from https://nodejs.org/
- [ ] Install the LTS version (20.x or higher)
- [ ] Verify installation:
  ```bash
  node --version   # Should show v20.x.x or higher
  npm --version    # Should show 10.x.x or higher
  ```

## Step 2: Install Frontend Dependencies ⬜

```bash
# Navigate to the frontend directory
cd frontend

# Install all dependencies
npm install
```

Expected output: Should install ~200 packages in 30-60 seconds

## Step 3: Start the Development Server ⬜

```bash
# Make sure you're in the frontend directory
npm run dev
```

Expected output:
```
  VITE v6.0.3  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

## Step 4: Open in Browser ⬜

- [ ] Open your browser
- [ ] Go to http://localhost:3000
- [ ] You should see "Jazz Melody Finder" with a virtual piano

## Step 5: Test the Piano ⬜

- [ ] Click on piano keys
- [ ] See notes appear in "Played Notes"
- [ ] Play 2+ notes to see "Interval Sequence"
- [ ] Play 3+ notes to see search results appear

## Step 6: Explore the Code ⬜

### Start with these files (in order):
1. [ ] `frontend/src/types/index.ts` - See the data structures
2. [ ] `frontend/src/components/Piano/PianoKey.tsx` - Individual piano key
3. [ ] `frontend/src/components/Piano/Piano.tsx` - Full keyboard
4. [ ] `frontend/src/services/api.ts` - API client with mock data
5. [ ] `frontend/src/App.tsx` - Main application

## Step 7 (Optional): Install Docker ⬜

Only needed when you're ready to set up the database.

- [ ] Download Docker Desktop from https://www.docker.com/products/docker-desktop
- [ ] Install and start Docker Desktop
- [ ] Verify: `docker --version`
- [ ] Run: `docker compose up -d` (from project root)
- [ ] Access pgAdmin at http://localhost:5050

## Common Issues & Solutions

### Issue: `npm: command not found`
**Solution**: Node.js not installed. Go back to Step 1.

### Issue: Port 3000 is already in use
**Solution**: Either close the other app using port 3000, or:
```bash
# Edit frontend/vite.config.ts
# Change port: 3000 to port: 3001
```

### Issue: Module not found errors
**Solution**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Issue: TypeScript errors in terminal
**Solution**: These are usually just warnings. The app will still work! Fix them as you learn.

## Success Checklist

After completing the steps above, you should have:

- [x] Node.js installed (v20+)
- [x] Frontend dependencies installed
- [x] Development server running
- [x] Piano keyboard visible in browser
- [x] Notes captured when clicking keys
- [x] Interval sequence displayed
- [x] Search results appearing (mock data)

## What to Do Next

### Learn React + TypeScript (Week 1-2)
- [ ] Read through all component files
- [ ] Modify the piano (try 3 octaves)
- [ ] Change colors and styling
- [ ] Add new features (see GETTING_STARTED.md for ideas)

### Set Up Database (Week 2-3)
- [ ] Install Docker Desktop
- [ ] Start PostgreSQL with `docker compose up -d`
- [ ] Explore database using pgAdmin
- [ ] View the 10 mock jazz standards

### Build Backend (Week 3-4)
- [ ] Create Standards Service (TypeScript/Express)
- [ ] Connect to PostgreSQL
- [ ] Implement search endpoint
- [ ] Connect frontend to real API

### Advanced (Week 5+)
- [ ] Build C# Melody Service
- [ ] Build C# Search Service
- [ ] Add Redis caching
- [ ] Containerize everything
- [ ] Deploy to Kubernetes
- [ ] Deploy to AWS

## Getting Help

### Documentation
- [README.md](README.md) - Complete project overview
- [GETTING_STARTED.md](GETTING_STARTED.md) - Detailed guide
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - What we built

### Online Resources
- React: https://react.dev/learn
- TypeScript: https://www.typescriptlang.org/docs/handbook/intro.html
- Vite: https://vitejs.dev/guide/

### Debugging in Browser
1. Open DevTools (F12 or Right-click → Inspect)
2. Go to Console tab
3. You'll see API calls and any errors

## Congratulations!

Once you complete all the steps above, you'll have:
- ✅ A working React + TypeScript application
- ✅ An interactive virtual piano
- ✅ Real-time melody recognition
- ✅ A solid foundation for learning DevOps

**Happy coding!** 🎹🎵
