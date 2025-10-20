import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import rawMovies from './movies.json';
import MovieCard from './components/MovieCard.jsx';
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
      accumulator[movie.id] = 5;
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
  const swipeAreaRef = useRef(null);

  const activeMovie = movies[currentIndex];

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
    setActiveRatingMovieId(null);
    setTransitionDirection(null);
    setIsOverviewOpen(true);
  };

  const handleCloseOverview = () => {
    setActiveRatingMovieId(null);
    setTransitionDirection(null);
    setIsOverviewOpen(false);
  };

  const handleSelectMovie = (index) => {
    setCurrentIndex(index);
    setActiveRatingMovieId(null);
    setTransitionDirection(null);
    setIsOverviewOpen(false);
  };

  return (
    <div
      className={`app-shell ${isOverviewOpen ? 'app-shell--overview' : 'app-shell--focused'}`}
      style={
        activeMovie?.posterUrl
          ? { '--active-poster': `url(${activeMovie.posterUrl})` }
          : undefined
      }
    >
      <div className="app-stage">
        <header className="app-header">
          <div className="app-title">Movie Night</div>
          <button
            type="button"
            className="overview-button"
            onClick={isOverviewOpen ? handleCloseOverview : handleOpenOverview}
            aria-label={isOverviewOpen ? 'Tillbaka till filmvy' : 'Visa affischöversikt'}
          >
            {isOverviewOpen ? 'Tillbaka' : 'Översikt'}
          </button>
        </header>

        <main
          className={`app-main ${isOverviewOpen ? 'app-main--overview' : 'app-main--focused'}`}
          ref={isOverviewOpen ? undefined : swipeAreaRef}
        >
          {isOverviewOpen ? (
            <div className="overview-grid">
              {movies.map((movie, index) => {
                const posterUrl = movie.posterUrl ?? null;
                return (
                  <button
                    key={movie.id}
                    type="button"
                    className="overview-card"
                    onClick={() => handleSelectMovie(index)}
                    aria-label={`Visa ${movie.title}`}
                  >
                    <div className="overview-card__poster-shell">
                      {posterUrl ? (
                        <img src={posterUrl} alt={movie.title} loading="lazy" />
                      ) : (
                        <div className="overview-card__fallback">Ingen affisch</div>
                      )}
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
    </div>
  );
}

export default App;
