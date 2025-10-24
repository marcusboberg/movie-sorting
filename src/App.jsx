import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import rawMovies from './movies.json';
import MovieCard from './components/MovieCard.jsx';
import RatingRing from './components/RatingRing.jsx';
import FloatingToolbar from './components/FloatingToolbar.jsx';
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
  };
}

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

const USER_OPTIONS = [...USERNAMES];
const USER_STORAGE_KEY = 'movie-sorting.activeUser';
const THEME_COLOR_FALLBACK = '#040404';

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
  const movies = useMemo(() => {
    if (!Array.isArray(rawMovies)) {
      return [];
    }

    return rawMovies
      .filter(Boolean)
      .map((movie, index) => normalizeMovie(movie, index))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(({ order, ...movie }) => movie);
  }, []);
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
  const [username, setUsername] = useState(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const stored = window.localStorage.getItem(USER_STORAGE_KEY);
      return stored && USER_OPTIONS.includes(stored) ? stored : null;
    } catch (_error) {
      return null;
    }
  });
  const [allRatings, setAllRatings] = useState(() =>
    USER_OPTIONS.reduce((accumulator, user) => {
      accumulator[user] = {};
      return accumulator;
    }, {})
  );
  const [activeRatingMovieId, setActiveRatingMovieId] = useState(null);
  const [transitionDirection, setTransitionDirection] = useState(null);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [overviewMode, setOverviewMode] = useState('grid');
  const [overviewFilter, setOverviewFilter] = useState('all');
  const [scoreFilterRange, setScoreFilterRange] = useState([0, 10]);
  const [overviewSort, setOverviewSort] = useState('viewingOrder');
  const [isScoreOverlayVisible, setIsScoreOverlayVisible] = useState(true);
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

    const cleanupImages = [];
    movies.forEach((movie) => {
      const posterUrl = movie.posterUrl;
      if (!posterUrl || preloadedPostersRef.current.has(posterUrl)) {
        return;
      }

      preloadedPostersRef.current.add(posterUrl);
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.src = posterUrl;
      image.decode?.().catch(() => {});
      cleanupImages.push(image);
    });

    return () => {
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
    if (isOverviewOpen) {
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
      interactionMode = event.target.closest('.movie-poster-shell') ? 'pending' : 'navigate';
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
      if (!nextUser || !USER_OPTIONS.includes(nextUser) || nextUser === username) {
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

      const ratedValues = values.filter((value) => value > 0.0001);
      const average =
        ratedValues.length > 0
          ? Math.round((ratedValues.reduce((sum, value) => sum + value, 0) / ratedValues.length) * 10) / 10
          : 0;

      return { movie, values, average };
    });
  }, [allRatings, movies, normalizeRating]);

  const shouldShowUserPicker = !username;

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
        <main
          className={`app-main ${isOverviewOpen ? 'app-main--overview' : 'app-main--focused'}`}
          ref={isOverviewOpen ? undefined : swipeAreaRef}
        >
          {isOverviewOpen ? (
            <div className="overview-panel">
              <div className="overview-panel__header">
                <div className="overview-tabs" role="tablist" aria-label="Vy">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={overviewMode === 'grid'}
                    className={`overview-tab ${overviewMode === 'grid' ? 'overview-tab--active' : ''}`}
                    onClick={() => setOverviewMode('grid')}
                  >
                    Affischer
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={overviewMode === 'compare'}
                    className={`overview-tab ${overviewMode === 'compare' ? 'overview-tab--active' : ''}`}
                    onClick={() => setOverviewMode('compare')}
                  >
                    Jämför
                  </button>
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
              ) : (
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
                              average > 0.0001 ? '' : 'compare-card__average--empty'
                            }`}
                            aria-label={
                              average > 0.0001
                                ? `Snittbetyg ${average.toFixed(1)}`
                                : 'Snittbetyg saknas'
                            }
                          >
                            {average > 0.0001 ? average.toFixed(1) : '—'}
                          </div>
                        </header>
                        <ul className="compare-card__ratings">
                          {values.map((value, index) => {
                            const user = USER_OPTIONS[index];
                            const hasScore = value > 0.0001;
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
              />
            </div>
          ) : (
            <div className="movie-stage movie-stage--empty">Inga filmer att visa.</div>
          )}
        </main>

      </div>
      <FloatingToolbar
        mode={isOverviewOpen ? 'overview' : 'poster'}
        onNavigateToOverview={handleOpenOverview}
        onNavigateToPoster={handleCloseOverview}
        currentUser={username}
        userOptions={USER_OPTIONS}
        onUserChange={handleUserSelection}
        filterOption={overviewFilter}
        onFilterChange={setOverviewFilter}
        sortOption={overviewSort}
        onSortChange={setOverviewSort}
        isScoreOverlayVisible={isScoreOverlayVisible}
        onToggleScoreOverlay={() => setIsScoreOverlayVisible((value) => !value)}
        filterOptions={filterOptions}
        sortOptions={sortOptions}
        scoreRange={scoreFilterRange}
        onScoreRangeChange={handleScoreFilterRangeChange}
      />
      {shouldShowUserPicker ? (
        <div className="user-picker-overlay">
          <div className="user-picker" role="dialog" aria-modal="true" aria-labelledby="user-picker-title">
            <h2 id="user-picker-title">Vem är du?</h2>
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
    </div>
  );
}

export default App;
