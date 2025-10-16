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
    overview: movie?.description ?? movie?.overview ?? '',
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
  const [touchState, setTouchState] = useState(null);

  const activeMovie = movies[currentIndex];

  const handlePrev = () => {
    if (movies.length === 0) return;
    setCurrentIndex((previous) => (previous - 1 + movies.length) % movies.length);
  };

  const handleNext = () => {
    if (movies.length === 0) return;
    setCurrentIndex((previous) => (previous + 1) % movies.length);
  };

  const handleTouchStart = (event) => {
    if (event.target.closest('.rating-area')) {
      setTouchState(null);
      return;
    }

    const touch = event.touches[0];
    setTouchState({
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      isSwiping: false,
    });
  };

  const handleTouchMove = (event) => {
    setTouchState((previous) => {
      if (!previous) return previous;
      const touch = event.touches[0];
      const deltaX = touch.clientX - previous.startX;
      const deltaY = touch.clientY - previous.startY;

      if (!previous.isSwiping) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
          return {
            ...previous,
            isSwiping: true,
            lastX: touch.clientX,
          };
        }
        return previous;
      }

      return {
        ...previous,
        lastX: touch.clientX,
      };
    });
  };

  const handleTouchEnd = (event) => {
    setTouchState((previous) => {
      if (!previous) return null;
      const touch = event.changedTouches[0];
      const endX = previous.isSwiping ? previous.lastX : touch.clientX;
      const delta = endX - previous.startX;

      if (Math.abs(delta) > 60) {
        if (delta > 0) {
          handlePrev();
        } else {
          handleNext();
        }
      }

      return null;
    });
  };

  const handleTouchCancel = () => {
    setTouchState(null);
  };

  const handleRatingChange = (movieId, value) => {
    setRatings((previous) => ({ ...previous, [movieId]: value }));
  };

  return (
    <div
      className="app-shell"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
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
          <MovieCard key={activeMovie?.id ?? 'empty'} movie={activeMovie} />
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
