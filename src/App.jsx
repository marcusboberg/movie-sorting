import { useMemo, useState } from 'react';
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
  const [gestureState, setGestureState] = useState(null);

  const activeMovie = movies[currentIndex];

  const handlePrev = () => {
    if (movies.length === 0) return;
    setTransitionDirection(-1);
    setCurrentIndex((previous) => (previous - 1 + movies.length) % movies.length);
  };

  const handleNext = () => {
    if (movies.length === 0) return;
    setTransitionDirection(1);
    setCurrentIndex((previous) => (previous + 1) % movies.length);
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest('.rating-area') || !event.target.closest('.movie-card-wrapper')) {
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);

    setGestureState({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      deltaX: 0,
      isSwiping: false,
    });
  };

  const handlePointerMove = (event) => {
    let shouldPreventDefault = false;
    setGestureState((previous) => {
      if (!previous || previous.pointerId !== event.pointerId) return previous;

      const deltaX = event.clientX - previous.startX;
      const deltaY = event.clientY - previous.startY;

      if (!previous.isSwiping) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 14) {
          if (previous.pointerType !== 'mouse') {
            shouldPreventDefault = true;
          }
          return {
            ...previous,
            isSwiping: true,
            lastX: event.clientX,
            deltaX,
          };
        }
        return previous;
      }

      if (previous.pointerType !== 'mouse') {
        shouldPreventDefault = true;
      }

      return {
        ...previous,
        lastX: event.clientX,
        deltaX,
      };
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
      if (!previous || previous.pointerId !== event.pointerId) return previous;

      const delta = previous.isSwiping
        ? previous.deltaX
        : event.clientX - previous.startX;

      if (Math.abs(delta) > 60) {
        navigate = delta > 0 ? -1 : 1;
      }

      return null;
    });

    if (navigate !== 0) {
      if (navigate < 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  const handlePointerCancel = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setGestureState((previous) => {
      if (!previous || previous.pointerId !== event.pointerId) return previous;
      return null;
    });
  };

  const handleRatingChange = (movieId, value) => {
    setRatings((previous) => ({ ...previous, [movieId]: value }));
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
            dragOffset={gestureState?.deltaX ?? 0}
            isDragging={Boolean(gestureState?.isSwiping)}
          />
        </main>

        {activeMovie && (
          <div className="rating-area">
            <RatingSlider
              value={ratings[activeMovie.id] ?? 5}
              onChange={(value) => handleRatingChange(activeMovie.id, value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
