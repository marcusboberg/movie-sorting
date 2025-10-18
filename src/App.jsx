import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import rawMovies from './movies.json';
import MovieCard from './components/MovieCard.jsx';
import RatingSlider from './components/RatingSlider.jsx';
import './App.css';

function normalizeMovie(movie, index) {
  const fallbackOrder = index + 1;
  const order = Number.isFinite(movie?.order) ? movie.order : fallbackOrder;
  const runtimeMinutes = Number.isFinite(movie?.runtime)
    ? movie.runtime
    : Number.isFinite(movie?.runtimeMinutes)
      ? movie.runtimeMinutes
      : null;
  const releaseYear = movie?.year ?? movie?.releaseYear ?? '—';

  return {
    id: movie?.id ?? order ?? fallbackOrder,
    order,
    title: movie?.title ?? 'Untitled',
    posterUrl: movie?.image ?? movie?.posterUrl ?? null,
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
  const [transitionDirection, setTransitionDirection] = useState(0);
  const [ratings, setRatings] = useState(() =>
    movies.reduce((accumulator, movie) => {
      accumulator[movie.id] = 5;
      return accumulator;
    }, {})
  );
  const [activeRatingMovieId, setActiveRatingMovieId] = useState(null);
  const createGestureState = useCallback(
    () => ({
      phase: 'idle',
      pointerId: null,
      pointerType: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      exitDirection: 0,
    }),
    []
  );
  const [gestureState, setGestureState] = useState(() => createGestureState());
  const swipeAnimationTimeoutRef = useRef(null);

  const activeMovie = movies[currentIndex];
  const isRatingActive = activeRatingMovieId === activeMovie?.id;

  const navigateBy = (step) => {
    if (!movies.length) return;
    setTransitionDirection(step);
    setCurrentIndex((previous) => (previous + step + movies.length) % movies.length);
  };

  const handlePrev = () => navigateBy(-1);
  const handleNext = () => navigateBy(1);

  useEffect(() => () => {
    if (swipeAnimationTimeoutRef.current) {
      clearTimeout(swipeAnimationTimeoutRef.current);
    }
  }, []);

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('.rating-area') || !event.target.closest('.movie-card-wrapper')) {
      return;
    }

    if (gestureState.phase === 'animating') {
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);

    setGestureState({
      phase: 'pending',
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: 0,
      exitDirection: 0,
    });
  };

  const handlePointerMove = (event) => {
    let shouldPreventDefault = false;
    setGestureState((previous) => {
      if (previous.pointerId !== event.pointerId) return previous;
      if (previous.phase === 'animating') return previous;

      const deltaX = event.clientX - previous.startX;
      const deltaY = event.clientY - previous.startY;

      if (previous.phase === 'pending') {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 6) {
          if (previous.pointerType !== 'mouse') {
            shouldPreventDefault = true;
          }
          return {
            ...previous,
            phase: 'dragging',
            offsetX: deltaX,
          };
        }
        return previous;
      }

      if (previous.phase === 'dragging') {
        if (previous.pointerType !== 'mouse') {
          shouldPreventDefault = true;
        }

        return {
          ...previous,
          offsetX: deltaX,
        };
      }

      return previous;
    });

    if (shouldPreventDefault) {
      event.preventDefault();
    }
  };

  const handlePointerUp = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    let navigate = 0;
    setGestureState((previous) => {
      if (previous.pointerId !== event.pointerId) return previous;

      const effectiveOffset =
        previous.phase === 'dragging'
          ? previous.offsetX
          : event.clientX - previous.startX;

      if (previous.phase === 'dragging' && Math.abs(effectiveOffset) > 56) {
        const exitDirection = effectiveOffset > 0 ? 1 : -1;
        navigate = exitDirection > 0 ? -1 : 1;
        return {
          phase: 'animating',
          pointerId: null,
          pointerType: previous.pointerType,
          startX: previous.startX,
          startY: previous.startY,
          offsetX: exitDirection * 420,
          exitDirection,
        };
      }

      return createGestureState();
    });

    if (navigate !== 0) {
      setActiveRatingMovieId(null);
      if (swipeAnimationTimeoutRef.current) {
        clearTimeout(swipeAnimationTimeoutRef.current);
      }

      swipeAnimationTimeoutRef.current = setTimeout(() => {
        navigateBy(navigate);
        setGestureState(createGestureState());
      }, 280);
    }
  };

  const handlePointerCancel = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setGestureState((previous) => {
      if (previous.pointerId !== event.pointerId) return previous;
      return createGestureState();
    });
  };

  const normalizeRating = useCallback((value) => Math.round((value ?? 0) * 10) / 10, []);

  const handleRatingChange = (movieId, value) => {
    const normalized = normalizeRating(value);
    setRatings((previous) => ({ ...previous, [movieId]: normalized }));
  };

  const handleRatingCommit = (movieId, value) => {
    const normalized = normalizeRating(value);
    setRatings((previous) => ({ ...previous, [movieId]: normalized }));
    setActiveRatingMovieId(null);
  };

  const handleRatingInteractionChange = (movieId, isActive) => {
    setActiveRatingMovieId(isActive ? movieId : null);
  };

  return (
    <div
      className="app-shell"
      style={
        activeMovie?.posterUrl
          ? { '--active-poster': `url(${activeMovie.posterUrl})` }
          : undefined
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    >
      <div className="app-stage">
        <header className="app-header">
          <button
            type="button"
            className="nav-button"
            onClick={handlePrev}
            aria-label="Previous movie"
          >
            ‹
          </button>
          <div className="app-title">Movie Night</div>
          <button
            type="button"
            className="nav-button"
            onClick={handleNext}
            aria-label="Next movie"
          >
            ›
          </button>
        </header>

        <main className="app-main">
            <MovieCard
              key={activeMovie?.id ?? 'empty'}
              movie={activeMovie}
              transitionDirection={transitionDirection}
              dragOffset={gestureState.offsetX}
              isDragging={gestureState.phase === 'dragging'}
              rating={activeMovie ? ratings[activeMovie.id] ?? 0 : 0}
              isRatingActive={isRatingActive}
            />
        </main>

        {activeMovie && (
          <div className="rating-area">
            <RatingSlider
              value={ratings[activeMovie.id] ?? 5}
              onChange={(value) => handleRatingChange(activeMovie.id, value)}
              onCommit={(value) => handleRatingCommit(activeMovie.id, value)}
              onInteractionChange={(isActive) =>
                handleRatingInteractionChange(activeMovie.id, isActive)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
