import { useEffect, useMemo, useState } from 'react';
import movies from './movies.json';
import MovieCard from './components/MovieCard.jsx';
import RatingSlider from './components/RatingSlider.jsx';
import MovieDots from './components/MovieDots.jsx';
import './App.css';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [movieDetails, setMovieDetails] = useState({});
  const [ratings, setRatings] = useState(() =>
    movies.reduce((accumulator, movie) => {
      accumulator[movie.tmdbId] = 5;
      return accumulator;
    }, {})
  );
  const [fetchStatus, setFetchStatus] = useState({});
  const [touchStart, setTouchStart] = useState(null);

  const activeMovie = movies[currentIndex];
  const activeDetails = activeMovie
    ? movieDetails[activeMovie.tmdbId]
    : undefined;
  const activeStatus = activeMovie ? fetchStatus[activeMovie.tmdbId] : undefined;

  useEffect(() => {
    if (!activeMovie) return;
    const tmdbId = activeMovie.tmdbId;
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;

    if (!apiKey) {
      setFetchStatus((previous) => ({
        ...previous,
        [tmdbId]: { state: 'error', message: 'Missing TMDB API key' },
      }));
      return;
    }

    if (
      fetchStatus[tmdbId]?.state === 'loading' ||
      fetchStatus[tmdbId]?.state === 'ready'
    ) {
      return;
    }

    const controller = new AbortController();

    async function loadMovie() {
      try {
        setFetchStatus((previous) => ({
          ...previous,
          [tmdbId]: { state: 'loading' },
        }));

        const response = await fetch(
          `https://api.themoviedb.org/3/movie/${tmdbId}?language=en-US`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json;charset=utf-8',
            },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error('TMDB request failed');
        }

        const data = await response.json();

        setMovieDetails((previous) => ({ ...previous, [tmdbId]: data }));
        setFetchStatus((previous) => ({
          ...previous,
          [tmdbId]: { state: 'ready' },
        }));
      } catch (error) {
        if (error.name === 'AbortError') return;
        setFetchStatus((previous) => ({
          ...previous,
          [tmdbId]: { state: 'error', message: error.message },
        }));
      }
    }

    loadMovie();

    return () => controller.abort();
  }, [activeMovie, fetchStatus]);

  const handlePrev = () => {
    setCurrentIndex((previous) => (previous - 1 + movies.length) % movies.length);
  };

  const handleNext = () => {
    setCurrentIndex((previous) => (previous + 1) % movies.length);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    setTouchStart(touch.clientX);
  };

  const handleTouchEnd = (event) => {
    if (touchStart == null) return;
    const touch = event.changedTouches[0];
    const delta = touch.clientX - touchStart;

    if (Math.abs(delta) > 50) {
      if (delta > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }

    setTouchStart(null);
  };

  const handleRatingChange = (tmdbId, value) => {
    setRatings((previous) => ({ ...previous, [tmdbId]: value }));
  };

  const posterUrl = useMemo(() => {
    if (!activeDetails?.poster_path) return undefined;
    return `${TMDB_IMAGE_BASE}${activeDetails.poster_path}`;
  }, [activeDetails]);

  return (
    <div
      className="app-shell"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
            key={activeMovie?.tmdbId ?? 'empty'}
            loading={activeStatus?.state === 'loading'}
            error={activeStatus?.state === 'error' ? activeStatus.message : undefined}
            movie={activeMovie}
            details={activeDetails}
            posterUrl={posterUrl}
          />
        </main>

        {activeMovie && (
          <div className="rating-area">
            <RatingSlider
              value={ratings[activeMovie.tmdbId] ?? 5}
              onChange={(value) => handleRatingChange(activeMovie.tmdbId, value)}
            />
          </div>
        )}

        <MovieDots
          total={movies.length}
          currentIndex={currentIndex}
          onSelect={setCurrentIndex}
        />
      </div>
    </div>
  );
}

export default App;
