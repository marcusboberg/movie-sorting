# Movie Sorting

A Vite + React experience for browsing a curated stack of films and quickly giving each title a score.

## Getting started

1. Install dependencies
   ```bash
   npm install
   ```
2. Create a `.env` file and add your TMDB API token. Use a **v4 API Read Access Token** so requests can be authorized with the `Authorization: Bearer` header.
   ```bash
   echo "VITE_TMDB_API_KEY=YOUR_TMDB_V4_READ_TOKEN" > .env
   ```
3. Start the development server
   ```bash
   npm run dev
   ```

## Build for production

```bash
npm run build
```

## Data sources

- Film identifiers live in [`src/movies.json`](src/movies.json).
- All metadata is fetched from [The Movie Database](https://www.themoviedb.org/) at runtime.
