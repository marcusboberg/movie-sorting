#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MOVIES_PATH = new URL('../src/movies.json', import.meta.url);

const MOVIE_DETAILS_API_URL =
  process.env.VITE_MOVIE_DETAILS_API_URL ??
  process.env.VITE_MOVIE_API_URL ??
  process.env.VITE_API_URL ??
  null;
const MOVIE_DETAILS_API_KEY =
  process.env.VITE_MOVIE_DETAILS_API_KEY ??
  process.env.VITE_MOVIE_API_KEY ??
  process.env.VITE_API_KEY ??
  null;
const MOVIE_DETAILS_AUTH_TOKEN = process.env.VITE_MOVIE_DETAILS_AUTH_TOKEN ?? process.env.VITE_MOVIE_API_AUTH_TOKEN ?? null;

const TMDB_API_BASE_URL = process.env.VITE_TMDB_API_BASE_URL ?? process.env.TMDB_API_BASE_URL ?? 'https://api.themoviedb.org/3';
const TMDB_API_TOKEN = process.env.VITE_TMDB_API_TOKEN ?? process.env.TMDB_API_TOKEN ?? null;
const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY ?? process.env.TMDB_API_KEY ?? null;

const toStringList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim();
        if (entry && typeof entry === 'object' && typeof entry.name === 'string') return entry.name.trim();
        return '';
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

const toNumberOrNull = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[^\d.-]/g, '');
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseMovieDetailsPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload)) return payload[0] ?? null;
  if (payload.movie && typeof payload.movie === 'object') return payload.movie;
  if (Array.isArray(payload.movies)) return payload.movies[0] ?? null;
  return payload;
};

const curlJson = async (url, { apiKey, authToken, extraHeaders = [] } = {}) => {
  const args = ['-sS', '--fail', url];

  extraHeaders.forEach((header) => args.unshift('-H', header));
  if (apiKey) args.unshift('-H', `x-api-key: ${apiKey}`);
  if (authToken) args.unshift('-H', `Authorization: Bearer ${authToken}`);

  const { stdout } = await execFileAsync('curl', args, { maxBuffer: 1024 * 1024 * 16 });
  return JSON.parse(stdout);
};

const buildMovieDetailsUrl = (baseUrl, imdbId) => {
  if (!baseUrl || !imdbId) return null;
  if (baseUrl.includes('{imdbId}')) return baseUrl.replace('{imdbId}', encodeURIComponent(imdbId));
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}imdbId=${encodeURIComponent(imdbId)}`;
};

const fetchFromGenericApi = async (imdbId) => {
  const url = buildMovieDetailsUrl(MOVIE_DETAILS_API_URL, imdbId);
  if (!url) return null;
  const payload = await curlJson(url, { apiKey: MOVIE_DETAILS_API_KEY, authToken: MOVIE_DETAILS_AUTH_TOKEN });
  return parseMovieDetailsPayload(payload);
};

const buildTmdbUrl = (path, params = {}) => {
  const url = new URL(`${TMDB_API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  });
  if (TMDB_API_KEY) url.searchParams.set('api_key', TMDB_API_KEY);
  return url.toString();
};

const fetchFromTmdb = async (imdbId) => {
  if (!TMDB_API_TOKEN && !TMDB_API_KEY) return null;

  const authToken = TMDB_API_TOKEN ? TMDB_API_TOKEN : null;
  const findPayload = await curlJson(buildTmdbUrl(`/find/${encodeURIComponent(imdbId)}`, { external_source: 'imdb_id' }), {
    authToken,
  });

  const tmdbMovie = Array.isArray(findPayload?.movie_results) ? findPayload.movie_results[0] : null;
  if (!tmdbMovie?.id) {
    return null;
  }

  const details = await curlJson(buildTmdbUrl(`/movie/${tmdbMovie.id}`, { append_to_response: 'credits' }), { authToken });

  return {
    title: details?.title,
    description: details?.overview,
    runtime: details?.runtime,
    releaseYear: details?.release_date ? String(details.release_date).slice(0, 4) : null,
    released: details?.release_date ?? null,
    image: typeof details?.poster_path === 'string' ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
    genres: Array.isArray(details?.genres) ? details.genres.map((genre) => genre?.name).filter(Boolean) : [],
    cast: Array.isArray(details?.credits?.cast)
      ? details.credits.cast
          .slice(0, 10)
          .map((actor) => actor?.name)
          .filter(Boolean)
      : [],
    imdbRating: toNumberOrNull(details?.vote_average),
    imdbVotes: toNumberOrNull(details?.vote_count),
    budget: toNumberOrNull(details?.budget),
    revenue: toNumberOrNull(details?.revenue),
    boxOffice: toNumberOrNull(details?.revenue),
    language: Array.isArray(details?.spoken_languages)
      ? details.spoken_languages
          .map((item) => item?.english_name ?? item?.name)
          .filter(Boolean)
          .join(', ')
      : null,
    country: Array.isArray(details?.production_countries)
      ? details.production_countries
          .map((item) => item?.name)
          .filter(Boolean)
          .join(', ')
      : null,
  };
};

const mergeMovie = (movie, apiMovie) => {
  const genres = toStringList(apiMovie?.genres);
  const cast = toStringList(apiMovie?.cast ?? apiMovie?.actors);

  return {
    ...movie,
    genres: genres.length ? genres : Array.isArray(movie.genres) ? movie.genres : [],
    cast: cast.length ? cast : Array.isArray(movie.cast) ? movie.cast : [],
    imdbRating: toNumberOrNull(apiMovie?.imdbRating ?? apiMovie?.vote_average) ?? toNumberOrNull(movie.imdbRating),
    imdbVotes: toNumberOrNull(apiMovie?.imdbVotes ?? apiMovie?.vote_count) ?? toNumberOrNull(movie.imdbVotes),
    metascore: toNumberOrNull(apiMovie?.metascore) ?? toNumberOrNull(movie.metascore),
    budget: toNumberOrNull(apiMovie?.budget) ?? toNumberOrNull(movie.budget),
    revenue: toNumberOrNull(apiMovie?.revenue ?? apiMovie?.boxOffice) ?? toNumberOrNull(movie.revenue),
    boxOffice: toNumberOrNull(apiMovie?.boxOffice ?? apiMovie?.revenue) ?? toNumberOrNull(movie.boxOffice),
    released: apiMovie?.released ?? apiMovie?.release_date ?? movie.released ?? null,
    country: apiMovie?.country ?? movie.country ?? null,
    language: apiMovie?.language ?? movie.language ?? null,
    awards: apiMovie?.awards ?? movie.awards ?? null,
    lastMetadataSyncAt: new Date().toISOString(),
  };
};

const fetchMovieDetails = async (imdbId) => {
  if (MOVIE_DETAILS_API_URL) {
    return fetchFromGenericApi(imdbId);
  }
  return fetchFromTmdb(imdbId);
};

const main = async () => {
  const dryRun = process.argv.includes('--dry-run');
  const raw = await readFile(MOVIES_PATH, 'utf8');
  const movies = JSON.parse(raw);

  if (!Array.isArray(movies)) throw new Error('movies.json must contain an array.');

  const updated = [];
  const failures = [];

  for (const movie of movies) {
    if (!movie?.imdbId) {
      updated.push(mergeMovie(movie, null));
      continue;
    }

    try {
      const apiMovie = await fetchMovieDetails(movie.imdbId);
      updated.push(mergeMovie(movie, apiMovie));
      process.stdout.write(`✓ ${movie.imdbId}\n`);
    } catch (error) {
      failures.push(movie.imdbId);
      updated.push(mergeMovie(movie, null));
      process.stderr.write(`✗ ${movie.imdbId}: ${error.message}\n`);
    }
  }

  if (!dryRun) {
    await writeFile(MOVIES_PATH, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  }

  process.stdout.write(`\nUpdated ${updated.length} movies. Failures: ${failures.length}.\n`);

  if (!MOVIE_DETAILS_API_URL && !TMDB_API_TOKEN && !TMDB_API_KEY) {
    process.stdout.write('No metadata API configured (neither VITE_MOVIE_DETAILS_API_URL nor TMDB token/key). Added schema defaults only.\n');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
