import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import rawMovies from './movies.json';
import MovieCard from './components/MovieCard.jsx';
import FloatingToolbar from './components/FloatingToolbar.jsx';
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState(() =>
    movies.reduce((accumulator, movie) => {
      accumulator[movie.id] = 0;
      return accumulator;
    }, {})
  );
  const ratingsRef = useRef(ratings);
  useEffect(() => {
    ratingsRef.current = ratings;
  }, [ratings]);
  const [activeRatingMovieId, setActiveRatingMovieId] = useState(null);
  const [transitionDirection, setTransitionDirection] = useState(null);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [hasUserRatingMap, setHasUserRatingMap] = useState(() =>
    movies.reduce((accumulator, movie) => {
      accumulator[movie.id] = false;
      return accumulator;
    }, {})
  );
  const [overviewFilter, setOverviewFilter] = useState('all');
  const [scoreFilterRange, setScoreFilterRange] = useState([0, 10]);
  const [overviewSort, setOverviewSort] = useState('viewingOrder');
  const [isScoreOverlayVisible, setIsScoreOverlayVisible] = useState(true);
  const swipeAreaRef = useRef(null);
  const appShellRef = useRef(null);

  const activeMovie = movies[currentIndex];
  const nextMovie = movies.length > 1 ? movies[(currentIndex + 1) % movies.length] : null;

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
  const normalizeRating = useCallback((value) => Math.round((value ?? 0) * 10) / 10, []);

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

  const handleRatingChange = useCallback(
    (movieId, value) => {
      const normalized = normalizeRating(value);
      setRatings((previous) => {
        const current = previous[movieId] ?? 0;
        if (Math.abs(current - normalized) < 0.0001) {
          return previous;
        }

        return { ...previous, [movieId]: normalized };
      });
    },
    [normalizeRating]
  );

  const handleRatingCommit = useCallback(
    (movieId, value) => {
      const normalized = normalizeRating(value);
      setRatings((previous) => {
        const current = previous[movieId] ?? 0;
        if (Math.abs(current - normalized) < 0.0001) {
          return previous;
        }

        return { ...previous, [movieId]: normalized };
      });
      setHasUserRatingMap((previous) => {
        const hasScore = normalized > 0.0001;
        if ((previous[movieId] ?? false) === hasScore) {
          return previous;
        }

        return { ...previous, [movieId]: hasScore };
      });
      setActiveRatingMovieId(null);
    },
    [normalizeRating]
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
      <div className="app-stage">
        <main
          className={`app-main ${isOverviewOpen ? 'app-main--overview' : 'app-main--focused'}`}
          ref={isOverviewOpen ? undefined : swipeAreaRef}
        >
          {isOverviewOpen ? (
            <div className="overview-grid">
              {overviewMovies.map(({ movie, index: movieIndex, ratingValue, hasScore }) => {
                const posterUrl = movie.posterUrl ?? null;
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
                        isScoreOverlayVisible && hasScore ? 'overview-card__poster-shell--with-score' : ''
                      }`}
                    >
                      {posterUrl ? (
                        <img src={posterUrl} alt={movie.title} loading="lazy" />
                      ) : (
                        <div className="overview-card__fallback">Ingen affisch</div>
                      )}
                      {isScoreOverlayVisible && hasScore ? (
                        <div className="overview-card__rating" aria-hidden="true">
                          <span className="overview-card__rating-value">{ratingValue.toFixed(1)}</span>
                          <span className="overview-card__rating-scale">/10</span>
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : activeMovie ? (
            <div
              key={activeMovie.id}
              className={`movie-stage ${
                transitionDirection ? `movie-stage--${transitionDirection}` : ''
              }`}
            >
              <MovieCard
                movie={activeMovie}
                rating={ratings[activeMovie.id] ?? 0}
                isRatingActive={activeRatingMovieId === activeMovie.id}
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
    </div>
  );
}

export default App;
