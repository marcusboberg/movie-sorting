import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import rawMovies from './movies.json';
import MovieCard from './components/MovieCard.jsx';
import RatingRing from './components/RatingRing.jsx';
import {
  loadAllRatings,
  loadUserRatings,
  saveRating,
  subscribeUserRatings,
  initializeRatingSync,
  USERNAMES,
} from './lib/ratings';
import './App.css';

function normalizeMovie(movie, index) {
  const fallbackOrder = index + 1;
  const order = Number.isFinite(movie?.order) ? movie.order : fallbackOrder;
  const id = movie?.id ?? movie?.imdbId ?? order ?? fallbackOrder;
  const localPoster = typeof movie?.imdbId === 'string' ? `/posters/${movie.imdbId}.jpg` : null;
  const runtimeMinutes = Number.isFinite(movie?.runtime)
    ? movie.runtime
    : Number.isFinite(movie?.runtimeMinutes)
      ? movie.runtimeMinutes
      : null;
  const releaseYear = movie?.year ?? movie?.releaseYear ?? '—';

  return {
    id,
    order,
    imdbId: typeof movie?.imdbId === 'string' ? movie.imdbId : null,
    title: movie?.title ?? 'Untitled',
    posterUrl: localPoster ?? movie?.image ?? movie?.posterUrl ?? null,
    runtimeMinutes,
    releaseYear: releaseYear != null ? String(releaseYear) : '—',
    overview: (() => {
      const description = typeof movie?.description === 'string' ? movie.description.trim() : '';
      if (description) return description;

      const overview = typeof movie?.overview === 'string' ? movie.overview.trim() : '';
      return overview || null;
    })(),
    genres: Array.isArray(movie?.genres)
      ? movie.genres.map((genre) => (typeof genre === 'string' ? genre.trim() : '')).filter(Boolean)
      : [],
    cast: Array.isArray(movie?.cast)
      ? movie.cast.map((actor) => (typeof actor === 'string' ? actor.trim() : '')).filter(Boolean)
      : [],
    imdbRating: Number.isFinite(movie?.imdbRating) ? movie.imdbRating : null,
    imdbVotes: Number.isFinite(movie?.imdbVotes) ? movie.imdbVotes : null,
    metascore: Number.isFinite(movie?.metascore) ? movie.metascore : null,
    budget: Number.isFinite(movie?.budget) ? movie.budget : null,
    revenue: Number.isFinite(movie?.revenue) ? movie.revenue : null,
    boxOffice: Number.isFinite(movie?.boxOffice) ? movie.boxOffice : null,
    released: typeof movie?.released === 'string' ? movie.released : null,
    country: typeof movie?.country === 'string' ? movie.country : null,
    language: typeof movie?.language === 'string' ? movie.language : null,
    awards: typeof movie?.awards === 'string' ? movie.awards : null,
  };
}

const MOVIE_DETAILS_API_URL =
  import.meta.env.VITE_MOVIE_DETAILS_API_URL ??
  import.meta.env.VITE_MOVIE_API_URL ??
  import.meta.env.VITE_API_URL ??
  null;
const MOVIE_DETAILS_API_KEY =
  import.meta.env.VITE_MOVIE_DETAILS_API_KEY ?? import.meta.env.VITE_MOVIE_API_KEY ?? import.meta.env.VITE_API_KEY ?? null;
const MOVIE_DETAILS_AUTH_TOKEN =
  import.meta.env.VITE_MOVIE_DETAILS_AUTH_TOKEN ?? import.meta.env.VITE_MOVIE_API_AUTH_TOKEN ?? null;
const TMDB_API_BASE_URL = import.meta.env.VITE_TMDB_API_BASE_URL ?? 'https://api.themoviedb.org/3';
const TMDB_API_TOKEN = import.meta.env.VITE_TMDB_API_TOKEN ?? null;
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY ?? null;

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

const toFiniteNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d.-]/g, '');
    if (!normalized) {
      return null;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const mergeMovieDetails = (baseMovie, apiMovie) => {
  if (!apiMovie) {
    return baseMovie;
  }

  const runtimeMinutes = Number.isFinite(apiMovie?.runtime)
    ? apiMovie.runtime
    : Number.isFinite(apiMovie?.runtimeMinutes)
      ? apiMovie.runtimeMinutes
      : baseMovie.runtimeMinutes;

  const releaseYear = apiMovie?.year ?? apiMovie?.releaseYear ?? (typeof apiMovie?.release_date === 'string' ? apiMovie.release_date.slice(0, 4) : null) ?? baseMovie.releaseYear;
  const overview =
    (typeof apiMovie?.description === 'string' && apiMovie.description.trim()) ||
    (typeof apiMovie?.overview === 'string' && apiMovie.overview.trim()) ||
    baseMovie.overview;

  const genres = toStringList(apiMovie?.genres);
  const cast = toStringList(apiMovie?.cast);

  return {
    ...baseMovie,
    title: typeof apiMovie?.title === 'string' && apiMovie.title.trim() ? apiMovie.title.trim() : baseMovie.title,
    posterUrl:
      (typeof apiMovie?.image === 'string' && apiMovie.image.trim()) ||
      (typeof apiMovie?.posterUrl === 'string' && apiMovie.posterUrl.trim()) ||
      baseMovie.posterUrl,
    runtimeMinutes,
    releaseYear: releaseYear != null ? String(releaseYear) : baseMovie.releaseYear,
    overview,
    genres: genres.length ? genres : baseMovie.genres,
    cast: cast.length ? cast : baseMovie.cast,
    imdbRating: toFiniteNumber(apiMovie?.imdbRating ?? apiMovie?.vote_average) ?? baseMovie.imdbRating,
    imdbVotes: toFiniteNumber(apiMovie?.imdbVotes ?? apiMovie?.vote_count) ?? baseMovie.imdbVotes,
    metascore: toFiniteNumber(apiMovie?.metascore) ?? baseMovie.metascore,
    budget: toFiniteNumber(apiMovie?.budget) ?? baseMovie.budget,
    revenue: toFiniteNumber(apiMovie?.revenue ?? apiMovie?.boxOffice) ?? baseMovie.revenue,
    boxOffice: toFiniteNumber(apiMovie?.boxOffice) ?? baseMovie.boxOffice,
    released: typeof apiMovie?.released === 'string' ? apiMovie.released : typeof apiMovie?.release_date === 'string' ? apiMovie.release_date : baseMovie.released,
    country: typeof apiMovie?.country === 'string' ? apiMovie.country : baseMovie.country,
    language: typeof apiMovie?.language === 'string' ? apiMovie.language : baseMovie.language,
    awards: typeof apiMovie?.awards === 'string' ? apiMovie.awards : baseMovie.awards,
  };
};

const buildMovieDetailsHeaders = () => {
  const headers = {};
  if (MOVIE_DETAILS_API_KEY) {
    headers['x-api-key'] = MOVIE_DETAILS_API_KEY;
  }
  if (MOVIE_DETAILS_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${MOVIE_DETAILS_AUTH_TOKEN}`;
  }
  return Object.keys(headers).length ? headers : undefined;
};

const buildTmdbHeaders = () => {
  if (!TMDB_API_TOKEN) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${TMDB_API_TOKEN}`,
  };
};

const buildTmdbUrl = (path, params = {}) => {
  const url = new URL(`${TMDB_API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  if (TMDB_API_KEY) {
    url.searchParams.set('api_key', TMDB_API_KEY);
  }
  return url.toString();
};

const parseMovieDetailsPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.movies)) {
    return payload.movies;
  }

  if (payload.movie && typeof payload.movie === 'object') {
    return payload.movie;
  }

  return payload;
};

const buildMovieDetailsUrl = (baseUrl, imdbId) => {
  if (!baseUrl || !imdbId) {
    return null;
  }

  if (baseUrl.includes('{imdbId}')) {
    return baseUrl.replace('{imdbId}', encodeURIComponent(imdbId));
  }

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}imdbId=${encodeURIComponent(imdbId)}`;
};

const fetchMovieDetails = async (imdbId, signal) => {
  if (MOVIE_DETAILS_API_URL) {
    const url = buildMovieDetailsUrl(MOVIE_DETAILS_API_URL, imdbId);
    if (!url) {
      return null;
    }

    const response = await fetch(url, { headers: buildMovieDetailsHeaders(), signal });
    if (!response.ok) {
      throw new Error(`Movie details API returned ${response.status}`);
    }

    const payload = await response.json();
    return parseMovieDetailsPayload(payload);
  }

  if (!TMDB_API_TOKEN && !TMDB_API_KEY) {
    return null;
  }

  const findResponse = await fetch(
    buildTmdbUrl(`/find/${encodeURIComponent(imdbId)}`, { external_source: 'imdb_id' }),
    { headers: buildTmdbHeaders(), signal }
  );

  if (!findResponse.ok) {
    throw new Error(`TMDB find endpoint returned ${findResponse.status}`);
  }

  const findPayload = await findResponse.json();
  const tmdbMovie = Array.isArray(findPayload?.movie_results) ? findPayload.movie_results[0] : null;
  if (!tmdbMovie?.id) {
    return null;
  }

  const detailsResponse = await fetch(
    buildTmdbUrl(`/movie/${tmdbMovie.id}`, { append_to_response: 'credits' }),
    { headers: buildTmdbHeaders(), signal }
  );

  if (!detailsResponse.ok) {
    throw new Error(`TMDB movie endpoint returned ${detailsResponse.status}`);
  }

  const details = await detailsResponse.json();
  const spokenLanguages = Array.isArray(details?.spoken_languages)
    ? details.spoken_languages
        .map((item) => item?.english_name ?? item?.name)
        .filter(Boolean)
        .join(', ')
    : null;
  const productionCountries = Array.isArray(details?.production_countries)
    ? details.production_countries
        .map((item) => item?.name)
        .filter(Boolean)
        .join(', ')
    : null;

  return {
    title: details?.title,
    overview: details?.overview,
    runtime: details?.runtime,
    releaseYear: typeof details?.release_date === 'string' ? details.release_date.slice(0, 4) : null,
    released: details?.release_date ?? null,
    image: typeof details?.poster_path === 'string' ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
    genres: Array.isArray(details?.genres) ? details.genres.map((genre) => genre?.name).filter(Boolean) : [],
    cast: Array.isArray(details?.credits?.cast)
      ? details.credits.cast
          .slice(0, 10)
          .map((actor) => actor?.name)
          .filter(Boolean)
      : [],
    vote_average: details?.vote_average,
    vote_count: details?.vote_count,
    budget: details?.budget,
    revenue: details?.revenue,
    boxOffice: details?.revenue,
    language: spokenLanguages,
    country: productionCountries,
  };
};

const EPSILON = 0.0001;
const clampScore = (value) => Math.min(10, Math.max(0, Math.round(value * 10) / 10));

const calculateAverage = (values) => {
  if (!values.length) return 0;
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const calculateSpread = (values) => {
  if (!values.length) return 0;
  return clampScore(Math.max(...values) - Math.min(...values));
};

const calculateStdDev = (values) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const formatPairScore = (value) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

const filterOptions = [
  { value: 'all', label: 'Alla filmer' },
  { value: 'scored', label: 'Endast med betyg' },
  { value: 'unscored', label: 'Endast utan betyg' },
  { value: 'scoreRange', label: 'Score span' },
];

const sortOptions = [
  { value: 'viewingOrder', label: 'Viewing order (default)' },
  { value: 'title', label: 'Titel' },
  { value: 'year', label: 'År' },
  { value: 'runtime', label: 'Speltid' },
  { value: 'score', label: 'Score' },
];

const overviewModeOptions = [
  { value: 'grid', label: 'Affischer' },
  { value: 'compare', label: 'Jämför' },
  { value: 'wrapped', label: 'Wrapped' },
  { value: 'stats', label: 'Statistik' },
];

const USER_OPTIONS = [...USERNAMES];
const USER_STORAGE_KEY = 'movie-sorting.activeUser';
const THEME_COLOR_FALLBACK = '#040404';

const getStoredUsername = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(USER_STORAGE_KEY);
    return stored && USER_OPTIONS.includes(stored) ? stored : null;
  } catch (_error) {
    return null;
  }
};

const toHexColor = (red, green, blue) => {
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
  const toHex = (value) => clamp(value).toString(16).padStart(2, '0');
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

const blendWithThemeFallback = (red, green, blue, mix = 0.25) => {
  const fallbackChannel = 4;
  const blendChannel = (value) => fallbackChannel + (value - fallbackChannel) * mix;
  return toHexColor(blendChannel(red), blendChannel(green), blendChannel(blue));
};

function App() {
  const baseMovies = useMemo(() => {
    if (!Array.isArray(rawMovies)) {
      return [];
    }

    return rawMovies
      .filter(Boolean)
      .map((movie, index) => normalizeMovie(movie, index))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(({ order, ...movie }) => movie);
  }, []);
  const [movies, setMovies] = useState(baseMovies);

  useEffect(() => {
    setMovies(baseMovies);
  }, [baseMovies]);

  useEffect(() => {
    if ((!MOVIE_DETAILS_API_URL && !TMDB_API_TOKEN && !TMDB_API_KEY) || !baseMovies.length) {
      return undefined;
    }

    const controller = new AbortController();

    const loadDetails = async () => {
      const updates = [...baseMovies];

      for (let index = 0; index < baseMovies.length; index += 1) {
        const movie = baseMovies[index];
        if (!movie.imdbId || controller.signal.aborted) {
          continue;
        }

        try {
          const apiMovie = await fetchMovieDetails(movie.imdbId, controller.signal);
          updates[index] = mergeMovieDetails(movie, apiMovie);
        } catch (error) {
          if (error?.name !== 'AbortError') {
            console.warn(`Could not load details for ${movie.imdbId}`, error);
          }
        }
      }

      if (!controller.signal.aborted) {
        setMovies(updates);
      }
    };

    void loadDetails();

    return () => {
      controller.abort();
    };
  }, [baseMovies]);

  const emptyRatings = useMemo(
    () =>
      movies.reduce((accumulator, movie) => {
        accumulator[movie.id] = 0;
        return accumulator;
      }, {}),
    [movies]
  );
  const [ratings, setRatings] = useState(emptyRatings);
  const ratingsRef = useRef(ratings);
  useEffect(() => {
    ratingsRef.current = ratings;
  }, [ratings]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [username, setUsername] = useState(getStoredUsername);
  const [allRatings, setAllRatings] = useState(() =>
    USER_OPTIONS.reduce((accumulator, user) => {
      accumulator[user] = {};
      return accumulator;
    }, {})
  );
  const [activeRatingMovieId, setActiveRatingMovieId] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState(null);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [overviewMode, setOverviewMode] = useState('grid');
  const [wrappedIndex, setWrappedIndex] = useState(0);
  const [overviewFilter, setOverviewFilter] = useState('all');
  const [scoreFilterRange, setScoreFilterRange] = useState([0, 10]);
  const [overviewSort, setOverviewSort] = useState('viewingOrder');
  const [isScoreOverlayVisible, setIsScoreOverlayVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(() => !getStoredUsername());
  const swipeAreaRef = useRef(null);
  const appShellRef = useRef(null);
  const [posterSession, setPosterSession] = useState(0);
  const [posterSnapToken, setPosterSnapToken] = useState(0);
  const preloadedPostersRef = useRef(new Set());
  const themeColorCacheRef = useRef(new Map());
  const themeColorMetaRef = useRef(null);
  const previousOverviewStateRef = useRef(isOverviewOpen);
  const activeMovie = movies[currentIndex] ?? null;
  const nextMovie = movies.length > 1 ? movies[(currentIndex + 1) % movies.length] : null;

  useEffect(() => {
    if (previousOverviewStateRef.current && !isOverviewOpen) {
      setPosterSession((value) => value + 1);
    }

    previousOverviewStateRef.current = isOverviewOpen;
  }, [isOverviewOpen]);

  useEffect(() => {
    setIsDetailsOpen(false);
  }, [activeMovie?.id, isOverviewOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const existingMeta = document.querySelector('meta[name="theme-color"]');
    if (existingMeta) {
      themeColorMetaRef.current = existingMeta;
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', THEME_COLOR_FALLBACK);
      document.head.appendChild(meta);
      themeColorMetaRef.current = meta;
    }

    document.documentElement.style.setProperty('--app-theme-color', THEME_COLOR_FALLBACK);
    if (document.body) {
      document.body.style.backgroundColor = THEME_COLOR_FALLBACK;
    }

    return () => {};
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) {
      return undefined;
    }

    if (isOverviewOpen) {
      document.body.classList.remove('app-lock-scroll');
      document.documentElement.classList.remove('app-lock-scroll');
    } else {
      document.body.classList.add('app-lock-scroll');
      document.documentElement.classList.add('app-lock-scroll');
    }

    return () => {
      document.body.classList.remove('app-lock-scroll');
      document.documentElement.classList.remove('app-lock-scroll');
    };
  }, [isOverviewOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const applyThemeColor = (color) => {
      const meta = themeColorMetaRef.current;
      if (meta) {
        meta.setAttribute('content', color);
      }
      document.documentElement.style.setProperty('--app-theme-color', color);
      if (document.body) {
        document.body.style.backgroundColor = color;
      }
    };

    if (!activeMovie?.posterUrl) {
      applyThemeColor(THEME_COLOR_FALLBACK);
      return undefined;
    }

    const posterUrl = activeMovie.posterUrl;
    const cachedColor = themeColorCacheRef.current.get(posterUrl);
    if (cachedColor) {
      applyThemeColor(cachedColor);
      return undefined;
    }

    applyThemeColor(THEME_COLOR_FALLBACK);

    let isCancelled = false;
    const image = new Image();
    image.decoding = 'async';

    const handleApplyColor = () => {
      if (isCancelled) {
        return;
      }

      let color = THEME_COLOR_FALLBACK;

      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (context) {
          const size = 12;
          canvas.width = size;
          canvas.height = size;
          context.drawImage(image, 0, 0, size, size);
          const imageData = context.getImageData(0, 0, size, size);
          const data = imageData.data;
          let red = 0;
          let green = 0;
          let blue = 0;
          let count = 0;
          for (let index = 0; index < data.length; index += 4) {
            const alpha = data[index + 3];
            if (alpha < 32) {
              continue;
            }
            red += data[index];
            green += data[index + 1];
            blue += data[index + 2];
            count += 1;
          }

          if (count > 0) {
            red = red / count;
            green = green / count;
            blue = blue / count;
            color = blendWithThemeFallback(red, green, blue);
          }
        }
      } catch (error) {
        color = THEME_COLOR_FALLBACK;
      }

      themeColorCacheRef.current.set(posterUrl, color);
      applyThemeColor(color);
    };

    const handleError = () => {
      if (isCancelled) {
        return;
      }
      applyThemeColor(THEME_COLOR_FALLBACK);
    };

    image.addEventListener('load', handleApplyColor);
    image.addEventListener('error', handleError);
    image.src = posterUrl;
    image.decode?.().catch(() => {});

    return () => {
      isCancelled = true;
      image.removeEventListener('load', handleApplyColor);
      image.removeEventListener('error', handleError);
    };
  }, [activeMovie?.posterUrl]);

  useEffect(() => {
    if (!movies.length) {
      return undefined;
    }

    const POSTER_PRELOAD_LIMIT = 24;
    const uniquePosterUrls = movies
      .map((movie) => movie.posterUrl)
      .filter((posterUrl) => typeof posterUrl === 'string' && posterUrl.length > 0);
    const queue = uniquePosterUrls.filter((posterUrl) => !preloadedPostersRef.current.has(posterUrl));

    if (!queue.length) {
      return undefined;
    }

    const cleanupImages = [];
    let isCancelled = false;
    let index = 0;
    let idleHandle = null;
    let timeoutHandle = null;

    const scheduleNext = () => {
      if (isCancelled || index >= queue.length || index >= POSTER_PRELOAD_LIMIT) {
        return;
      }

      const scheduleWithIdle =
        typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';

      if (scheduleWithIdle) {
        idleHandle = window.requestIdleCallback(() => {
          idleHandle = null;
          loadNext();
        });
      } else {
        timeoutHandle = window.setTimeout(() => {
          timeoutHandle = null;
          loadNext();
        }, 120);
      }
    };

    const loadNext = () => {
      if (isCancelled || index >= queue.length || index >= POSTER_PRELOAD_LIMIT) {
        return;
      }

      const posterUrl = queue[index];
      index += 1;
      preloadedPostersRef.current.add(posterUrl);

      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.src = posterUrl;
      image.decode?.().catch(() => {});
      cleanupImages.push(image);

      scheduleNext();
    };

    scheduleNext();

    return () => {
      isCancelled = true;
      if (idleHandle != null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) {
        window.clearTimeout(timeoutHandle);
      }
      cleanupImages.forEach((image) => {
        image.src = '';
      });
    };
  }, [movies]);

  useEffect(() => {
    void initializeRatingSync();
  }, []);

  useEffect(() => {
    if (!username || typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(USER_STORAGE_KEY, username);
    } catch (_error) {
      // Some browsers (notably Safari private mode) throw on access when storage is unavailable.
    }
  }, [username]);

  useEffect(() => {
    setRatings(emptyRatings);
  }, [emptyRatings]);

  const withToolbarTransition = useCallback((update) => {
    const apply = () => {
      update();
    };

    if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => {
        apply();
      });
    } else {
      apply();
    }
  }, []);

  useEffect(() => {
    const appShellElement = appShellRef.current;
    if (!appShellElement) {
      return undefined;
    }

    if (!nextMovie?.posterUrl) {
      appShellElement.style.removeProperty('--next-poster');
      return undefined;
    }

    let isCancelled = false;
    const image = new Image();
    image.loading = 'eager';

    const applyNextPoster = () => {
      if (isCancelled) return;
      appShellElement.style.setProperty('--next-poster', `url(${nextMovie.posterUrl})`);
    };

    const handleError = () => {
      if (isCancelled) return;
      appShellElement.style.removeProperty('--next-poster');
    };

    image.addEventListener('load', applyNextPoster, { once: true });
    image.addEventListener('error', handleError, { once: true });
    image.src = nextMovie.posterUrl;
    image.decode?.().catch(() => {});

    return () => {
      isCancelled = true;
      image.removeEventListener('load', applyNextPoster);
      image.removeEventListener('error', handleError);
    };
  }, [nextMovie?.posterUrl]);

  const navigateBy = useCallback(
    (step) => {
      if (!step || movies.length <= 1) return;

      setTransitionDirection(step > 0 ? 'forward' : 'backward');
      setCurrentIndex((previous) => {
        const nextIndex = (previous + step + movies.length) % movies.length;
        return nextIndex;
      });
      setActiveRatingMovieId(null);
    },
    [movies.length]
  );

  useEffect(() => {
    if (movies.length <= 1) {
      setTransitionDirection(null);
    }

    if (movies.length === 0) {
      setCurrentIndex(0);
      return;
    }

    setCurrentIndex((previous) => {
      if (previous < movies.length) {
        return previous;
      }
      return 0;
    });
  }, [movies.length]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return;

      if (event.key === 'ArrowRight') {
        navigateBy(1);
      } else if (event.key === 'ArrowLeft') {
        navigateBy(-1);
      } else if (event.key === 'Escape' && isOverviewOpen) {
        setIsOverviewOpen(false);
      } else {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOverviewOpen, navigateBy]);
  const normalizeRating = useCallback((value) => {
    const numeric = Number.isFinite(value) ? value : Number.parseFloat(value ?? 0);
    const safeValue = Number.isFinite(numeric) ? numeric : 0;
    return Math.min(10, Math.max(0, Math.round(safeValue * 10) / 10));
  }, []);

  const handleScoreFilterRangeChange = useCallback((nextRange) => {
    setScoreFilterRange((previousRange) => {
      const [rawMin = 0, rawMax = 10] = Array.isArray(nextRange) ? nextRange : [0, 10];
      const min = Number.isFinite(rawMin) ? rawMin : Number.parseFloat(rawMin) || 0;
      const max = Number.isFinite(rawMax) ? rawMax : Number.parseFloat(rawMax) || 10;
      const clampedMin = Math.min(Math.max(0, min), 10);
      const clampedMax = Math.min(10, Math.max(clampedMin, max));

      if (
        Array.isArray(previousRange) &&
        previousRange.length === 2 &&
        Math.abs(previousRange[0] - clampedMin) < 0.0001 &&
        Math.abs(previousRange[1] - clampedMax) < 0.0001
      ) {
        return previousRange;
      }

      return [clampedMin, clampedMax];
    });
  }, []);

  const [scoreFilterMin, scoreFilterMax] = Array.isArray(scoreFilterRange)
    ? scoreFilterRange
    : [0, 10];

  const updateScoreFilterInput = useCallback(
    (type, rawValue) => {
      const numeric =
        typeof rawValue === 'number' && Number.isFinite(rawValue)
          ? rawValue
          : Number.parseFloat(rawValue);

      if (!Number.isFinite(numeric)) {
        if (type === 'min') {
          handleScoreFilterRangeChange([0, scoreFilterMax]);
        } else {
          handleScoreFilterRangeChange([scoreFilterMin, 10]);
        }
        return;
      }

      if (type === 'min') {
        handleScoreFilterRangeChange([numeric, scoreFilterMax]);
      } else {
        handleScoreFilterRangeChange([scoreFilterMin, numeric]);
      }
    },
    [handleScoreFilterRangeChange, scoreFilterMax, scoreFilterMin],
  );

  const handleScoreFilterSliderChange = useCallback(
    (type) => (event) => {
      updateScoreFilterInput(type, event.target.value);
    },
    [updateScoreFilterInput],
  );

  const handleScoreFilterNumberChange = useCallback(
    (type) => (event) => {
      updateScoreFilterInput(type, event.target.value);
    },
    [updateScoreFilterInput],
  );

  const areRatingMapsEqual = useCallback((first = {}, second = {}) => {
    const firstKeys = Object.keys(first);
    const secondKeys = Object.keys(second);
    if (firstKeys.length !== secondKeys.length) {
      return false;
    }

    return firstKeys.every((key) => {
      if (!Object.prototype.hasOwnProperty.call(second, key)) {
        return false;
      }
      return Math.abs((first[key] ?? 0) - (second[key] ?? 0)) < 0.0001;
    });
  }, []);

  const hasUserRatingMap = useMemo(
    () =>
      movies.reduce((accumulator, movie) => {
        const movieKey = String(movie.id);
        accumulator[movieKey] = (ratings[movieKey] ?? 0) > 0.0001;
        return accumulator;
      }, {}),
    [movies, ratings]
  );

  const applyRemoteRatings = useCallback(
    (incoming = {}) => {
      const normalized = Object.entries(incoming ?? {}).reduce((accumulator, [movieId, value]) => {
        const nextValue = normalizeRating(value);
        if (nextValue > 0.0001) {
          accumulator[String(movieId)] = nextValue;
        }
        return accumulator;
      }, {});

      setRatings((previous) => {
        let hasChange = false;
        const next = { ...previous };
        movies.forEach((movie) => {
          const movieKey = String(movie.id);
          const remoteValue = normalized[movieKey] ?? 0;
          if (Math.abs((previous[movieKey] ?? 0) - remoteValue) > 0.0001) {
            next[movieKey] = remoteValue;
            hasChange = true;
          }
        });
        return hasChange ? next : previous;
      });
    },
    [movies, normalizeRating]
  );

  useEffect(() => {
    if (!username) {
      return undefined;
    }

    let isCancelled = false;
    setRatings(emptyRatings);

    loadUserRatings(username).then((initialRatings) => {
      if (isCancelled) return;
      applyRemoteRatings(initialRatings);
    });

    const unsubscribe = subscribeUserRatings(username, (liveRatings) => {
      if (isCancelled) return;
      applyRemoteRatings(liveRatings);
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [username, emptyRatings, applyRemoteRatings]);

  useEffect(() => {
    let isCancelled = false;

    loadAllRatings().then((initial) => {
      if (isCancelled) return;
      setAllRatings((previous) => {
        let hasChange = false;
        const next = { ...previous };
        USER_OPTIONS.forEach((user) => {
          const normalized = Object.entries(initial?.[user] ?? {}).reduce((accumulator, [movieId, value]) => {
            const nextValue = normalizeRating(value);
            if (nextValue > 0.0001) {
              accumulator[String(movieId)] = nextValue;
            }
            return accumulator;
          }, {});

          const current = previous[user] ?? {};
          if (!areRatingMapsEqual(current, normalized)) {
            next[user] = normalized;
            hasChange = true;
          }
        });

        return hasChange ? next : previous;
      });
    });

    const unsubscribers = USER_OPTIONS.map((user) =>
      subscribeUserRatings(user, (userRatings) => {
        if (isCancelled) return;
        setAllRatings((previous) => {
          const current = previous[user] ?? {};
          const normalized = Object.entries(userRatings ?? {}).reduce((accumulator, [movieId, value]) => {
            const nextValue = normalizeRating(value);
            if (nextValue > 0.0001) {
              accumulator[String(movieId)] = nextValue;
            }
            return accumulator;
          }, {});

          if (areRatingMapsEqual(current, normalized)) {
            return previous;
          }

          return { ...previous, [user]: normalized };
        });
      })
    );

    return () => {
      isCancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [areRatingMapsEqual, normalizeRating]);

  const handleRatingChange = useCallback(
    (movieId, value) => {
      const movieKey = String(movieId);
      const normalized = normalizeRating(value);
      setRatings((previous) => {
        const current = previous[movieKey] ?? 0;
        if (Math.abs(current - normalized) < 0.0001) {
          return previous;
        }

        return { ...previous, [movieKey]: normalized };
      });

      if (username && USER_OPTIONS.includes(username)) {
        setAllRatings((previous) => {
          const currentUserRatings = previous[username] ?? {};
          const currentValue = currentUserRatings[movieKey] ?? 0;
          if (Math.abs(currentValue - normalized) < 0.0001) {
            return previous;
          }

          if (normalized <= 0.0001) {
            if (!(movieKey in currentUserRatings)) {
              return previous;
            }
            const { [movieKey]: _removed, ...rest } = currentUserRatings;
            return { ...previous, [username]: rest };
          }

          return { ...previous, [username]: { ...currentUserRatings, [movieKey]: normalized } };
        });
      }
    },
    [normalizeRating, username]
  );

  const handleRatingCommit = useCallback(
    (movieId, value) => {
      const movieKey = String(movieId);
      const normalized = normalizeRating(value);
      setRatings((previous) => {
        const current = previous[movieKey] ?? 0;
        if (Math.abs(current - normalized) < 0.0001) {
          return previous;
        }

        return { ...previous, [movieKey]: normalized };
      });

      if (username && USER_OPTIONS.includes(username)) {
        setAllRatings((previous) => {
          const currentUserRatings = previous[username] ?? {};
          const currentValue = currentUserRatings[movieKey] ?? 0;
          if (Math.abs(currentValue - normalized) < 0.0001) {
            return previous;
          }

          if (normalized <= 0.0001) {
            if (!(movieKey in currentUserRatings)) {
              return previous;
            }
            const { [movieKey]: _removed, ...rest } = currentUserRatings;
            return { ...previous, [username]: rest };
          }

          return { ...previous, [username]: { ...currentUserRatings, [movieKey]: normalized } };
        });

        void saveRating(username, movieKey, normalized).catch(() => {});
      }

      setActiveRatingMovieId(null);
    },
    [normalizeRating, username]
  );

  const handleRatingInteractionChange = useCallback((movieId, isActive) => {
    setActiveRatingMovieId(isActive ? movieId : null);
  }, []);

  useEffect(() => {
    if (isOverviewOpen || isDetailsOpen) {
      return undefined;
    }

    const swipeElement = swipeAreaRef.current;
    const activeMovieId = activeMovie?.id ?? null;
    if (!swipeElement || activeMovieId == null) return;

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let interactionMode = null;
    let initialRating = ratingsRef.current[activeMovieId] ?? 0;
    let hasRatingChanged = false;
    const horizontalThreshold = 48;
    const verticalTolerance = 60;
    const ratingActivationThreshold = 12;
    const ratingActivationAngle = Math.tan((12 * Math.PI) / 180);
    const pixelsPerRatingPoint = 28;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const resetInteraction = () => {
      pointerId = null;
      startX = 0;
      startY = 0;
      interactionMode = null;
      hasRatingChanged = false;
      initialRating = ratingsRef.current[activeMovieId] ?? 0;
    };

    let shouldCancelClick = false;

    const releasePointerCapture = () => {
      if (pointerId == null) {
        return;
      }

      const hasPointerCapture =
        typeof swipeElement.hasPointerCapture === 'function'
          ? swipeElement.hasPointerCapture(pointerId)
          : true;

      if (hasPointerCapture && typeof swipeElement.releasePointerCapture === 'function') {
        swipeElement.releasePointerCapture(pointerId);
      }
    };

    const handlePointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      shouldCancelClick = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      interactionMode = event.target.closest('.movie-poster-shell--front') ? 'pending' : 'navigate';
      hasRatingChanged = false;
      initialRating = ratingsRef.current[activeMovieId] ?? 0;

      if (typeof swipeElement.setPointerCapture === 'function') {
        swipeElement.setPointerCapture(event.pointerId);
      }
    };

    const maybeCommitRating = (event) => {
      if (interactionMode !== 'rate' || !hasRatingChanged) {
        return;
      }

      const deltaY = event.clientY - startY;
      const rawValue = initialRating + (startY - event.clientY) / pixelsPerRatingPoint;
      const nextValue = clamp(rawValue, 0, 10);
      handleRatingCommit(activeMovieId, nextValue);
      handleRatingInteractionChange(activeMovieId, false);
      shouldCancelClick = true;
    };

    const handlePointerMove = (event) => {
      if (event.pointerId !== pointerId || !interactionMode) return;

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      if (interactionMode === 'navigate') {
        if (Math.abs(deltaX) < horizontalThreshold || Math.abs(deltaY) > verticalTolerance) {
          return;
        }

        navigateBy(deltaX < 0 ? 1 : -1);
        releasePointerCapture();
        resetInteraction();
        return;
      }

      if (interactionMode === 'pending') {
        if (Math.abs(deltaY) >= ratingActivationThreshold) {
          const horizontalRatio = Math.abs(deltaX) / Math.max(Math.abs(deltaY), 1);
          if (horizontalRatio <= ratingActivationAngle) {
            interactionMode = 'rate';
            handleRatingInteractionChange(activeMovieId, true);
          } else if (Math.abs(deltaX) >= horizontalThreshold) {
            interactionMode = 'navigate';
          } else {
            return;
          }
        } else if (
          Math.abs(deltaX) >= horizontalThreshold &&
          Math.abs(deltaY) <= verticalTolerance
        ) {
          interactionMode = 'navigate';
        } else {
          return;
        }
      }

      if (interactionMode === 'navigate') {
        if (Math.abs(deltaX) < horizontalThreshold || Math.abs(deltaY) > verticalTolerance) {
          return;
        }

        navigateBy(deltaX < 0 ? 1 : -1);
        releasePointerCapture();
        resetInteraction();
        return;
      }

      if (interactionMode === 'rate') {
        const rawValue = initialRating + (startY - event.clientY) / pixelsPerRatingPoint;
        const nextValue = clamp(rawValue, 0, 10);
        hasRatingChanged = true;
        handleRatingChange(activeMovieId, nextValue);
        event.preventDefault();
      }
    };

    const handlePointerUp = (event) => {
      if (event.pointerId !== pointerId) return;
      maybeCommitRating(event);
      releasePointerCapture();
      resetInteraction();
    };

    const handlePointerCancel = (event) => {
      if (event.pointerId !== pointerId) return;
      if (interactionMode === 'rate' && hasRatingChanged) {
        handleRatingInteractionChange(activeMovieId, false);
        shouldCancelClick = true;
      }
      releasePointerCapture();
      resetInteraction();
    };

    const handleClickCapture = (event) => {
      if (!shouldCancelClick) return;
      shouldCancelClick = false;
      event.stopPropagation();
      event.preventDefault();
    };

    swipeElement.addEventListener('pointerdown', handlePointerDown, { passive: false });
    swipeElement.addEventListener('pointermove', handlePointerMove, { passive: false });
    swipeElement.addEventListener('pointerup', handlePointerUp, { passive: false });
    swipeElement.addEventListener('pointercancel', handlePointerCancel, { passive: false });
    swipeElement.addEventListener('pointerleave', handlePointerCancel, { passive: false });
    swipeElement.addEventListener('click', handleClickCapture, true);

    return () => {
      swipeElement.removeEventListener('pointerdown', handlePointerDown);
      swipeElement.removeEventListener('pointermove', handlePointerMove);
      swipeElement.removeEventListener('pointerup', handlePointerUp);
      swipeElement.removeEventListener('pointercancel', handlePointerCancel);
      swipeElement.removeEventListener('pointerleave', handlePointerCancel);
      swipeElement.removeEventListener('click', handleClickCapture, true);
    };
  }, [
    activeMovie?.id,
    handleRatingChange,
    handleRatingCommit,
    handleRatingInteractionChange,
    isDetailsOpen,
    isOverviewOpen,
    navigateBy,
  ]);

  const handleOpenOverview = () => {
    flushSync(() => {
      setPosterSnapToken((value) => value + 1);
    });
    withToolbarTransition(() => {
      setActiveRatingMovieId(null);
      setTransitionDirection(null);
      setIsOverviewOpen(true);
    });
  };

  const handleCloseOverview = () => {
    withToolbarTransition(() => {
      setActiveRatingMovieId(null);
      setTransitionDirection(null);
      setIsOverviewOpen(false);
    });
  };

  const handleSelectMovie = (index) => {
    withToolbarTransition(() => {
      setCurrentIndex(index);
      setActiveRatingMovieId(null);
      setTransitionDirection(null);
      setIsOverviewOpen(false);
    });
  };

  const handleUserSelection = useCallback(
    (nextUser) => {
      if (!nextUser || !USER_OPTIONS.includes(nextUser)) {
        return;
      }

      setIsUserPickerOpen(false);

      if (nextUser === username) {
        return;
      }

      setUsername(nextUser);
      setOverviewMode('grid');
    },
    [username]
  );

  const overviewMovies = useMemo(() => {
    const base = movies.map((movie, index) => {
      const ratingValue = ratings[movie.id] ?? 0;
      const hasScore = hasUserRatingMap[movie.id] ?? false;
      return { movie, index, ratingValue, hasScore };
    });

    const filtered = base.filter(({ hasScore, ratingValue }) => {
      if (overviewFilter === 'scored') {
        return hasScore;
      }

      if (overviewFilter === 'unscored') {
        return !hasScore;
      }

      if (overviewFilter === 'scoreRange') {
        const [min, max] = scoreFilterRange;
        if (!hasScore) {
          return false;
        }
        return ratingValue >= min && ratingValue <= max;
      }

      return true;
    });

    const parseYear = (value) => {
      const numeric = Number.parseInt(value, 10);
      return Number.isFinite(numeric) ? numeric : -Infinity;
    };

    const sorted = [...filtered].sort((a, b) => {
      switch (overviewSort) {
        case 'title':
          return a.movie.title.localeCompare(b.movie.title, undefined, { sensitivity: 'base' });
        case 'year':
          return parseYear(b.movie.releaseYear) - parseYear(a.movie.releaseYear);
        case 'runtime':
          return (b.movie.runtimeMinutes ?? 0) - (a.movie.runtimeMinutes ?? 0);
        case 'score':
          return (b.ratingValue ?? 0) - (a.ratingValue ?? 0);
        case 'viewingOrder':
          return a.index - b.index;
        default:
          return 0;
      }
    });

    return sorted;
  }, [hasUserRatingMap, movies, overviewFilter, overviewSort, ratings, scoreFilterRange]);

  const compareRows = useMemo(() => {
    return movies.map((movie) => {
      const movieKey = String(movie.id);
      const values = USER_OPTIONS.map((user) => {
        const userRatings = allRatings[user] ?? {};
        return normalizeRating(userRatings[movieKey] ?? 0);
      });

      const ratedValues = values.filter((value) => value > EPSILON);
      const average = calculateAverage(ratedValues);

      return { movie, values, average, ratedValues };
    });
  }, [allRatings, movies, normalizeRating]);

  const stats = useMemo(() => {
    const rankedByAverage = compareRows
      .filter((row) => row.ratedValues.length >= 2)
      .map((row) => ({
        movie: row.movie,
        average: row.average,
        votes: row.ratedValues.length,
        spread: calculateSpread(row.ratedValues),
        deviation: calculateStdDev(row.ratedValues),
      }))
      .sort((first, second) => {
        if (Math.abs(second.average - first.average) > EPSILON) return second.average - first.average;
        if (second.votes !== first.votes) return second.votes - first.votes;
        return first.deviation - second.deviation;
      });

    const unanimousRows = compareRows
      .filter((row) => row.ratedValues.length === USER_OPTIONS.length)
      .map((row) => ({
        movie: row.movie,
        spread: calculateSpread(row.ratedValues),
        values: row.values,
      }));

    const mostDivisive = [...unanimousRows].sort((a, b) => b.spread - a.spread).slice(0, 5);
    const mostAgreed = [...unanimousRows].sort((a, b) => a.spread - b.spread).slice(0, 5);

    const userAverages = USER_OPTIONS.map((user) => {
      const values = Object.values(allRatings[user] ?? {})
        .map((value) => normalizeRating(value))
        .filter((value) => value > EPSILON);
      return {
        user,
        average: calculateAverage(values),
        count: values.length,
      };
    })
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.average - a.average);

    const pairSimilarities = [];
    for (let i = 0; i < USER_OPTIONS.length; i += 1) {
      for (let j = i + 1; j < USER_OPTIONS.length; j += 1) {
        const firstUser = USER_OPTIONS[i];
        const secondUser = USER_OPTIONS[j];
        const diffs = compareRows
          .map((row) => {
            const first = row.values[i];
            const second = row.values[j];
            if (first <= EPSILON || second <= EPSILON) {
              return null;
            }
            return Math.abs(first - second);
          })
          .filter((value) => value != null);

        const averageDiff = diffs.length ? diffs.reduce((sum, value) => sum + value, 0) / diffs.length : null;
        const matchScore = averageDiff == null ? null : Math.max(0, 1 - averageDiff / 10);

        pairSimilarities.push({
          pair: `${firstUser} × ${secondUser}`,
          overlap: diffs.length,
          score: matchScore,
        });
      }
    }

    const hotTakes = compareRows
      .flatMap((row) => {
        if (row.ratedValues.length < 2) {
          return [];
        }

        return USER_OPTIONS.map((user, index) => {
          const userValue = row.values[index];
          if (userValue <= EPSILON) {
            return null;
          }
          const others = row.values.filter((_, currentIndex) => currentIndex !== index).filter((value) => value > EPSILON);
          if (!others.length) {
            return null;
          }
          const othersAverage = calculateAverage(others);
          const delta = clampScore(Math.abs(userValue - othersAverage));
          if (delta < 1.5) {
            return null;
          }
          return {
            movie: row.movie,
            user,
            userValue,
            othersAverage,
            delta,
          };
        }).filter(Boolean);
      })
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 8);

    const byGenre = new Map();
    const byActor = new Map();

    compareRows.forEach((row) => {
      USER_OPTIONS.forEach((user, index) => {
        const value = row.values[index];
        if (value <= EPSILON) {
          return;
        }

        row.movie.genres.forEach((genre) => {
          const key = `${user}__${genre}`;
          const bucket = byGenre.get(key) ?? { user, label: genre, values: [] };
          bucket.values.push(value);
          byGenre.set(key, bucket);
        });

        row.movie.cast.forEach((actor) => {
          const key = `${user}__${actor}`;
          const bucket = byActor.get(key) ?? { user, label: actor, values: [] };
          bucket.values.push(value);
          byActor.set(key, bucket);
        });
      });
    });

    const topGenreByUser = USER_OPTIONS.map((user) => {
      const candidates = [...byGenre.values()]
        .filter((entry) => entry.user === user && entry.values.length >= 2)
        .map((entry) => ({ ...entry, average: calculateAverage(entry.values) }))
        .sort((a, b) => b.average - a.average);
      return candidates[0] ?? null;
    }).filter(Boolean);

    const topActorByUser = USER_OPTIONS.map((user) => {
      const candidates = [...byActor.values()]
        .filter((entry) => entry.user === user && entry.values.length >= 2)
        .map((entry) => ({ ...entry, average: calculateAverage(entry.values) }))
        .sort((a, b) => b.average - a.average);
      return candidates[0] ?? null;
    }).filter(Boolean);

    const metadataMovies = movies.filter((movie) => movie && Number.isFinite(movie.imdbRating));

    const oldestMovie = [...movies]
      .filter((movie) => Number.isFinite(Number.parseInt(movie.releaseYear, 10)))
      .sort((a, b) => Number.parseInt(a.releaseYear, 10) - Number.parseInt(b.releaseYear, 10))[0] ?? null;

    const mostExpensiveMovie = [...movies]
      .filter((movie) => Number.isFinite(movie.budget) && movie.budget > 0)
      .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0))[0] ?? null;

    const cheapestMovie = [...movies]
      .filter((movie) => Number.isFinite(movie.budget) && movie.budget > 0)
      .sort((a, b) => (a.budget ?? 0) - (b.budget ?? 0))[0] ?? null;

    const biggestImdbGap = compareRows
      .filter((row) => row.ratedValues.length >= 2 && Number.isFinite(row.movie.imdbRating))
      .map((row) => ({
        movie: row.movie,
        average: row.average,
        imdbRating: row.movie.imdbRating,
        delta: clampScore(Math.abs(row.average - row.movie.imdbRating)),
      }))
      .sort((a, b) => b.delta - a.delta)[0] ?? null;

    return {
      topThree: rankedByAverage.slice(0, 3),
      mostDivisive,
      mostAgreed,
      userAverages,
      pairSimilarities,
      hotTakes,
      topGenreByUser,
      topActorByUser,
      oldestMovie,
      mostExpensiveMovie,
      cheapestMovie,
      biggestImdbGap,
      hasMetadata: metadataMovies.length > 0 || movies.some((movie) => movie.genres.length > 0 || movie.cast.length > 0),
    };
  }, [allRatings, compareRows, movies, normalizeRating]);


  const wrappedSlides = useMemo(() => {
    const topMovie = stats.topThree[0];
    const mostSplit = stats.mostDivisive[0];
    const mostMatch = [...stats.pairSimilarities]
      .filter((entry) => entry.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const topTake = stats.hotTakes[0];
    const userSummary = stats.userAverages.find((entry) => entry.user === username) ?? stats.userAverages[0] ?? null;

    return [
      {
        key: 'intro',
        kicker: 'Movie Wrapped',
        title: username ? `${username}s filmår` : 'Ert filmår',
        subtitle: 'En snabb recap av er smak och era mest minnesvärda betyg.',
      },
      {
        key: 'top',
        kicker: 'Topplistan',
        title: topMovie ? `#1: ${topMovie.movie.title}` : 'Inga topprankade filmer ännu',
        subtitle: topMovie ? `Snitt ${topMovie.average.toFixed(1)} från ${topMovie.votes} röster.` : 'Sätt fler betyg för att få en topplista.',
      },
      {
        key: 'split',
        kicker: 'Drama alert',
        title: mostSplit ? `${mostSplit.movie.title} delade er mest` : 'Ingen stor splittring än',
        subtitle: mostSplit ? `Skillnad ${mostSplit.spread.toFixed(1)} poäng mellan högsta och lägsta betyg.` : 'När alla tre har röstat visas mest splittrade film här.',
      },
      {
        key: 'imdb-gap',
        kicker: 'IMDb vs ni',
        title: stats.biggestImdbGap ? `${stats.biggestImdbGap.movie.title} sticker ut mest` : 'Ingen IMDb-jämförelse än',
        subtitle: stats.biggestImdbGap
          ? `Ert snitt ${stats.biggestImdbGap.average.toFixed(1)} vs IMDb ${stats.biggestImdbGap.imdbRating.toFixed(1)} (Δ ${stats.biggestImdbGap.delta.toFixed(1)}).`
          : 'Fyll på imdbRating i metadata för att få denna insight.',
      },
      {
        key: 'oldest',
        kicker: 'Throwback',
        title: stats.oldestMovie ? `Äldst i listan: ${stats.oldestMovie.title}` : 'Ingen årtalsdata än',
        subtitle: stats.oldestMovie
          ? `Släppt ${stats.oldestMovie.releaseYear}.`
          : 'Lägg till releaseYear för filmerna för denna statistik.',
      },
      {
        key: 'budget',
        kicker: 'Budget battle',
        title: stats.mostExpensiveMovie ? `Dyrast: ${stats.mostExpensiveMovie.title}` : 'Ingen budgetdata än',
        subtitle:
          stats.mostExpensiveMovie && stats.cheapestMovie
            ? `${stats.mostExpensiveMovie.budget.toLocaleString('sv-SE')} USD vs billigast ${stats.cheapestMovie.title} (${stats.cheapestMovie.budget.toLocaleString('sv-SE')} USD).`
            : 'Lägg in budget i metadata för att jämföra dyrast/billigast.',
      },
      {
        key: 'taste',
        kicker: 'Smakmatch',
        title: mostMatch ? `${mostMatch.pair} är mest synkade` : 'Inte tillräckligt med överlapp än',
        subtitle: mostMatch ? `Matchscore ${formatPairScore(mostMatch.score ?? 0)}.` : 'Behövs fler filmer med dubbla betyg.',
      },
      {
        key: 'take',
        kicker: 'Hot take',
        title: topTake ? `${topTake.user} sticker ut på ${topTake.movie.title}` : 'Inga hot takes än',
        subtitle: topTake ? `Skillnad Δ ${topTake.delta.toFixed(1)} mot övriga.` : 'När någon avviker stort dyker den upp här.',
      },
      {
        key: 'profile',
        kicker: 'Profil',
        title: userSummary ? `${userSummary.user} snittar ${userSummary.average.toFixed(1)}` : 'Ingen profil ännu',
        subtitle: userSummary ? `${userSummary.count} betyg satta. ${userSummary.average >= 7 ? 'Generös smak!' : 'Kritisk smak!'} ` : 'Sätt några betyg för att bygga din profil.',
      },
    ];
  }, [stats, username]);

  const wrappedSlideCount = wrappedSlides.length;
  const safeWrappedIndex = Math.min(Math.max(0, wrappedIndex), Math.max(0, wrappedSlideCount - 1));
  const activeWrappedSlide = wrappedSlides[safeWrappedIndex] ?? null;

  useEffect(() => {
    if (overviewMode !== 'wrapped') {
      return;
    }
    setWrappedIndex((previous) => Math.min(previous, Math.max(0, wrappedSlideCount - 1)));
  }, [overviewMode, wrappedSlideCount]);

  const shouldShowUserPicker = isUserPickerOpen || !username;

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleOpenUserPicker = useCallback(() => {
    setIsUserPickerOpen(true);
  }, []);

  const handleCloseUserPicker = useCallback(() => {
    if (!username) {
      return;
    }

    setIsUserPickerOpen(false);
  }, [username]);

  const handleOverviewModeChange = useCallback((mode) => {
    setOverviewMode(mode);

    if (mode === 'wrapped') {
      setWrappedIndex(0);
    }
  }, []);

  return (
    <div
      className={`app-shell ${isOverviewOpen ? 'app-shell--overview' : 'app-shell--focused'}`}
      ref={appShellRef}
      style={
        activeMovie?.posterUrl
          ? { '--active-poster': `url(${activeMovie.posterUrl})` }
          : undefined
      }
    >
      <div className={`app-stage ${isOverviewOpen ? 'app-stage--overview' : 'app-stage--focused'}`}>
        <header className="app-header">
          <button
            type="button"
            className="app-avatar-button"
            onClick={handleOpenUserPicker}
            aria-label={username ? `Aktiv profil ${username}` : 'Välj profil'}
          >
            {username ? (
              <span className="app-avatar-button__initial">{username.slice(0, 1)}</span>
            ) : (
              <i className="fa-solid fa-user" aria-hidden="true" />
            )}
          </button>
          <nav className="app-header__navigation view-toggle" role="tablist" aria-label="Visa läge">
            <button
              type="button"
              role="tab"
              aria-selected={!isOverviewOpen}
              className={`view-toggle__button ${!isOverviewOpen ? 'view-toggle__button--active' : ''}`}
            onClick={handleCloseOverview}
          >
            Affischer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isOverviewOpen}
            className={`view-toggle__button ${isOverviewOpen ? 'view-toggle__button--active' : ''}`}
              onClick={handleOpenOverview}
            >
              Översikt
            </button>
          </nav>
          <button
            type="button"
            className="app-settings-button"
            onClick={handleOpenSettings}
            aria-label="Öppna inställningar"
          >
            <i className="fa-solid fa-gear" aria-hidden="true" />
          </button>
        </header>
        <main
          className={`app-main ${
            isOverviewOpen ? 'app-main--overview' : isDetailsOpen ? 'app-main--details' : 'app-main--focused'
          }`}
          ref={isOverviewOpen ? undefined : swipeAreaRef}
        >
          {isOverviewOpen ? (
            <div className="overview-content">
              <div className="overview-modes-scroll" role="tablist" aria-label="Visningsläge i översikt">
                <div className="overview-tabs">
                  {overviewModeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="tab"
                      aria-selected={overviewMode === option.value}
                      className={`overview-tab ${overviewMode === option.value ? 'overview-tab--active' : ''}`}
                      onClick={() => handleOverviewModeChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {overviewMode === 'grid' ? (
                <div className="overview-grid">
                  {overviewMovies.map(({ movie, index: movieIndex, ratingValue, hasScore }) => {
                    const posterUrl = movie.posterUrl ?? null;
                    const ratingNumber = Number.isFinite(ratingValue) ? ratingValue : 0;
                    const showScore = isScoreOverlayVisible && hasScore;
                    return (
                      <button
                        key={movie.id}
                        type="button"
                        className="overview-card"
                        onClick={() => handleSelectMovie(movieIndex)}
                        aria-label={`Visa ${movie.title}`}
                      >
                        <div
                          className={`overview-card__poster-shell ${
                            showScore ? 'overview-card__poster-shell--with-score' : ''
                          }`}
                        >
                          {posterUrl ? (
                            <img src={posterUrl} alt={movie.title} loading="lazy" decoding="async" />
                          ) : (
                            <div className="overview-card__fallback">Ingen affisch</div>
                          )}
                          {showScore ? (
                            <RatingRing value={ratingNumber} className="overview-card__rating-ring" ariaHidden />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : overviewMode === 'compare' ? (
                <div className="compare-table-wrapper">
                  <div className="compare-list" role="list">
                    {compareRows.map(({ movie, values, average }) => (
                      <article key={movie.id} className="compare-card" role="listitem">
                        <header className="compare-card__header">
                          <div className="compare-card__info">
                            <h3 className="compare-card__title">{movie.title}</h3>
                            <p className="compare-card__meta">{movie.releaseYear}</p>
                          </div>
                          <div
                            className={`compare-card__average ${
                              average > EPSILON ? '' : 'compare-card__average--empty'
                            }`}
                            aria-label={average > EPSILON ? `Snittbetyg ${average.toFixed(1)}` : 'Snittbetyg saknas'}
                          >
                            {average > EPSILON ? average.toFixed(1) : '—'}
                          </div>
                        </header>
                        <ul className="compare-card__ratings">
                          {values.map((value, index) => {
                            const user = USER_OPTIONS[index];
                            const hasScore = value > EPSILON;
                            const ratingClassName = `compare-card__rating ${
                              username === user ? 'compare-card__rating--active' : ''
                            }`;
                            return (
                              <li key={`${movie.id}-${user}`} className={ratingClassName}>
                                <span className="compare-card__user">{user}</span>
                                <span
                                  className={`compare-card__value ${
                                    hasScore ? '' : 'compare-card__value--empty'
                                  }`}
                                >
                                  {hasScore ? value.toFixed(1) : '—'}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </article>
                    ))}
                  </div>
                </div>
              ) : overviewMode === 'wrapped' ? (
                <div className="wrapped-panel">
                  {activeWrappedSlide ? (
                    <article className="wrapped-card">
                      <p className="wrapped-card__kicker">{activeWrappedSlide.kicker}</p>
                      <h3 className="wrapped-card__title">{activeWrappedSlide.title}</h3>
                      <p className="wrapped-card__subtitle">{activeWrappedSlide.subtitle}</p>
                      <div className="wrapped-card__footer">
                        <span className="wrapped-card__progress">
                          {safeWrappedIndex + 1} / {wrappedSlideCount}
                        </span>
                        <div className="wrapped-card__controls">
                          <button
                            type="button"
                            className="wrapped-card__button"
                            onClick={() => setWrappedIndex((value) => Math.max(0, value - 1))}
                            disabled={safeWrappedIndex === 0}
                          >
                            Föregående
                          </button>
                          <button
                            type="button"
                            className="wrapped-card__button wrapped-card__button--primary"
                            onClick={() => setWrappedIndex((value) => Math.min(wrappedSlideCount - 1, value + 1))}
                            disabled={safeWrappedIndex >= wrappedSlideCount - 1}
                          >
                            Nästa
                          </button>
                        </div>
                      </div>
                    </article>
                  ) : null}
                </div>
              ) : (
                <div className="stats-panel">
                  <section className="stats-card">
                    <h3>Topp 3 filmer</h3>
                    <ul>
                      {stats.topThree.map((entry) => (
                        <li key={entry.movie.id}>
                          <span>{entry.movie.title}</span>
                          <strong>{entry.average.toFixed(1)}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="stats-card">
                    <h3>Mest splittrade filmer</h3>
                    <ul>
                      {stats.mostDivisive.map((entry) => (
                        <li key={entry.movie.id}>
                          <span>{entry.movie.title}</span>
                          <strong>Spread {entry.spread.toFixed(1)}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="stats-card">
                    <h3>Mest eniga filmer</h3>
                    <ul>
                      {stats.mostAgreed.map((entry) => (
                        <li key={entry.movie.id}>
                          <span>{entry.movie.title}</span>
                          <strong>Spread {entry.spread.toFixed(1)}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="stats-card">
                    <h3>Snällast till strängast</h3>
                    <ul>
                      {stats.userAverages.map((entry) => (
                        <li key={entry.user}>
                          <span>{entry.user}</span>
                          <strong>{entry.average.toFixed(1)}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="stats-card">
                    <h3>Smakmatchning</h3>
                    <ul>
                      {stats.pairSimilarities.map((entry) => (
                        <li key={entry.pair}>
                          <span>{entry.pair}</span>
                          <strong>{entry.score == null ? '—' : formatPairScore(entry.score)}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="stats-card">
                    <h3>Hot takes</h3>
                    <ul>
                      {stats.hotTakes.map((entry) => (
                        <li key={`${entry.movie.id}-${entry.user}`}>
                          <span>{entry.user}: {entry.movie.title}</span>
                          <strong>Δ {entry.delta.toFixed(1)}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="stats-card">
                    <h3>Rolig fakta</h3>
                    <ul>
                      <li>
                        <span>Äldst film</span>
                        <strong>{stats.oldestMovie ? `${stats.oldestMovie.title} (${stats.oldestMovie.releaseYear})` : '—'}</strong>
                      </li>
                      <li>
                        <span>Dyrast film (budget)</span>
                        <strong>{stats.mostExpensiveMovie ? `${stats.mostExpensiveMovie.title}` : '—'}</strong>
                      </li>
                      <li>
                        <span>Billigast film (budget)</span>
                        <strong>{stats.cheapestMovie ? `${stats.cheapestMovie.title}` : '—'}</strong>
                      </li>
                      <li>
                        <span>Störst gap mot IMDb</span>
                        <strong>{stats.biggestImdbGap ? `${stats.biggestImdbGap.movie.title} (Δ ${stats.biggestImdbGap.delta.toFixed(1)})` : '—'}</strong>
                      </li>
                    </ul>
                  </section>

                  <section className="stats-card">
                    <h3>Favoritgenre per person</h3>
                    {stats.topGenreByUser.length ? (
                      <ul>
                        {stats.topGenreByUser.map((entry) => (
                          <li key={`${entry.user}-${entry.label}`}>
                            <span>{entry.user}: {entry.label}</span>
                            <strong>{entry.average.toFixed(1)}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Inte tillräckligt med genredata ännu.</p>
                    )}
                  </section>

                  <section className="stats-card">
                    <h3>Favoritskådespelare per person</h3>
                    {stats.topActorByUser.length ? (
                      <ul>
                        {stats.topActorByUser.map((entry) => (
                          <li key={`${entry.user}-${entry.label}`}>
                            <span>{entry.user}: {entry.label}</span>
                            <strong>{entry.average.toFixed(1)}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Inte tillräckligt med skådespelardata ännu.</p>
                    )}
                  </section>
                </div>
              )}
            </div>
          ) : activeMovie ? (
            <div
              key={activeMovie.id}
              className={`movie-stage ${
                transitionDirection ? `movie-stage--${transitionDirection}` : ''
              }`}
            >
              <MovieCard
                key={`${activeMovie.id}-${posterSession}`}
                movie={activeMovie}
                rating={ratings[activeMovie.id] ?? 0}
                isRatingActive={activeRatingMovieId === activeMovie.id}
                resetTrigger={posterSnapToken}
                onFlipChange={setIsDetailsOpen}
              />
            </div>
          ) : (
            <div className="movie-stage movie-stage--empty">Inga filmer att visa.</div>
          )}
        </main>
      </div>
      {shouldShowUserPicker ? (
        <div className="user-picker-overlay">
          <div
            className="user-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-picker-title"
          >
            <div className="user-picker__header">
              <h2 id="user-picker-title">Vem är du?</h2>
              {username ? (
                <button
                  type="button"
                  className="user-picker__close"
                  onClick={handleCloseUserPicker}
                  aria-label="Stäng profilväljaren"
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <p className="user-picker__subtitle">Välj din profil för att synka betygen.</p>
            <div className="user-picker__options">
              {USER_OPTIONS.map((user) => (
                <button
                  key={user}
                  type="button"
                  className={`user-picker__option ${username === user ? 'user-picker__option--active' : ''}`}
                  onClick={() => handleUserSelection(user)}
                >
                  {user}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {isSettingsOpen ? (
        <div className="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="settings-overlay__backdrop" onClick={handleCloseSettings} />
          <div className="settings-panel">
            <header className="settings-panel__header">
              <div>
                <p className="settings-panel__eyebrow">Inställningar</p>
                <h2 id="settings-title" className="settings-panel__title">
                  Anpassa din upplevelse
                </h2>
              </div>
              <button
                type="button"
                className="settings-panel__close"
                onClick={handleCloseSettings}
                aria-label="Stäng inställningar"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </header>
            <div className="settings-panel__sections">
              <section className="settings-section">
                <h3 className="settings-section__title">Profil</h3>
                <p className="settings-section__description">
                  Välj vilken profil som används när du sparar betyg.
                </p>
                <div className="settings-section__options">
                  {USER_OPTIONS.map((user) => (
                    <button
                      key={user}
                      type="button"
                      className={`settings-chip ${username === user ? 'settings-chip--active' : ''}`}
                      onClick={() => handleUserSelection(user)}
                    >
                      {user}
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-section">
                <h3 className="settings-section__title">Visningsläge</h3>
                <p className="settings-section__description">
                  Växla mellan affischer, betygstabell och rolig statistik i översikten.
                </p>
                <div className="settings-section__options">
                  <button
                    type="button"
                    className={`settings-chip ${overviewMode === 'grid' ? 'settings-chip--active' : ''}`}
                    onClick={() => handleOverviewModeChange('grid')}
                  >
                    Affischer
                  </button>
                  <button
                    type="button"
                    className={`settings-chip ${overviewMode === 'compare' ? 'settings-chip--active' : ''}`}
                    onClick={() => handleOverviewModeChange('compare')}
                  >
                    Jämför
                  </button>
                  <button
                    type="button"
                    className={`settings-chip ${overviewMode === 'wrapped' ? 'settings-chip--active' : ''}`}
                    onClick={() => handleOverviewModeChange('wrapped')}
                  >
                    Wrapped
                  </button>
                  <button
                    type="button"
                    className={`settings-chip ${overviewMode === 'stats' ? 'settings-chip--active' : ''}`}
                    onClick={() => handleOverviewModeChange('stats')}
                  >
                    Statistik
                  </button>
                </div>
              </section>

              <section className="settings-section" id="settings-filter">
                <h3 className="settings-section__title">Filter</h3>
                <p className="settings-section__description">
                  Bestäm vilka filmer som ska synas i översikten.
                </p>
                <div className="settings-section__options">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`settings-chip ${
                        overviewFilter === option.value ? 'settings-chip--active' : ''
                      }`}
                      onClick={() => setOverviewFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {overviewFilter === 'scoreRange' ? (
                  <div className="settings-score-range">
                    <div className="settings-score-range__sliders">
                      <label className="settings-score-range__field">
                        <span>Min</span>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={scoreFilterMin}
                          onChange={handleScoreFilterSliderChange('min')}
                        />
                      </label>
                      <label className="settings-score-range__field">
                        <span>Max</span>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={scoreFilterMax}
                          onChange={handleScoreFilterSliderChange('max')}
                        />
                      </label>
                    </div>
                    <div className="settings-score-range__inputs">
                      <label className="settings-score-range__input">
                        <span>Min</span>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={scoreFilterMin}
                          onChange={handleScoreFilterNumberChange('min')}
                        />
                      </label>
                      <label className="settings-score-range__input">
                        <span>Max</span>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={scoreFilterMax}
                          onChange={handleScoreFilterNumberChange('max')}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="settings-section">
                <div className="settings-section__header">
                  <div>
                    <h3 className="settings-section__title">Sortering</h3>
                    <p className="settings-section__description">
                      Välj hur filmerna ska sorteras i översikten.
                    </p>
                  </div>
                  <div className="settings-select">
                    <select
                      value={overviewSort}
                      onChange={(event) => setOverviewSort(event.target.value)}
                      aria-label="Välj sorteringsordning"
                    >
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="settings-section">
                <h3 className="settings-section__title">Betygsringar</h3>
                <p className="settings-section__description">
                  Styr om betygen visas ovanpå affischerna i översikten.
                </p>
                <button
                  type="button"
                  className={`settings-toggle ${isScoreOverlayVisible ? 'settings-toggle--active' : ''}`}
                  onClick={() => setIsScoreOverlayVisible((value) => !value)}
                  aria-pressed={isScoreOverlayVisible}
                >
                  <span className="settings-toggle__label">
                    {isScoreOverlayVisible ? 'Betyg visas' : 'Betyg dolda'}
                  </span>
                  <span className="settings-toggle__thumb" aria-hidden="true" />
                </button>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
