import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import rawMovies from './movies.json';
import MovieCard from './components/MovieCard.jsx';
import RatingSlider from './components/RatingSlider.jsx';
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
  const [activeRatingMovieId, setActiveRatingMovieId] = useState(null);
  const [transitionDirection, setTransitionDirection] = useState(null);
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

  const handlePrev = () => navigateBy(-1);
  const handleNext = () => navigateBy(1);

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
      } else {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateBy]);
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

  useEffect(() => {
    const swipeElement = swipeAreaRef.current;
    if (!swipeElement) return;

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    const horizontalThreshold = 48;
    const verticalTolerance = 60;

    const handlePointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
    };

    const handlePointerMove = (event) => {
      if (event.pointerId !== pointerId) return;

      const deltaX = event.clientX - startX;
      const deltaY = Math.abs(event.clientY - startY);

      if (Math.abs(deltaX) < horizontalThreshold || deltaY > verticalTolerance) {
        return;
      }

      // The old implementation only reacted to keyboard clicks, so swiping did nothing on mobile.
      // Trigger the same navigation logic once a clear horizontal swipe is detected.
      navigateBy(deltaX < 0 ? 1 : -1);
      pointerId = null;
    };

    const resetSwipe = () => {
      pointerId = null;
    };

    swipeElement.addEventListener('pointerdown', handlePointerDown, { passive: true });
    swipeElement.addEventListener('pointermove', handlePointerMove, { passive: true });
    swipeElement.addEventListener('pointerup', resetSwipe, { passive: true });
    swipeElement.addEventListener('pointercancel', resetSwipe);
    swipeElement.addEventListener('pointerleave', resetSwipe);

    return () => {
      swipeElement.removeEventListener('pointerdown', handlePointerDown);
      swipeElement.removeEventListener('pointermove', handlePointerMove);
      swipeElement.removeEventListener('pointerup', resetSwipe);
      swipeElement.removeEventListener('pointercancel', resetSwipe);
      swipeElement.removeEventListener('pointerleave', resetSwipe);
    };
  }, [navigateBy]);

  return (
    <div
      className="app-shell"
      style={
        activeMovie?.posterUrl
          ? { '--active-poster': `url(${activeMovie.posterUrl})` }
          : undefined
      }
    >
      <div className="app-stage">
        <header className="app-header">
          <button
            type="button"
            className="nav-button"
            onClick={handlePrev}
            disabled={movies.length <= 1}
            aria-label="Previous movie"
          >
            ‹
          </button>
          <div className="app-title">Movie Night</div>
          <button
            type="button"
            className="nav-button"
            onClick={handleNext}
            disabled={movies.length <= 1}
            aria-label="Next movie"
          >
            ›
          </button>
        </header>

        <main className="app-main" ref={swipeAreaRef}>
          {activeMovie ? (
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
