import { useCallback, useEffect, useMemo, useState } from 'react';
import rawMovies from './movies.json';
import MovieCard from './components/MovieCard.jsx';
import OverviewGrid from './components/OverviewGrid.jsx';
import DebugConsole from './components/DebugConsole.jsx';
import { prepareMovies } from './utils/movies.js';
import { useCardTilt } from './hooks/useCardTilt.js';
import { useRatings } from './hooks/useRatings.js';
import { useSwipeInteractions } from './hooks/useSwipeInteractions.js';
import './App.css';

function App() {
  const movies = useMemo(() => prepareMovies(rawMovies), []);
  const {
    ratings,
    activeRatingMovieId,
    handleRatingChange,
    handleRatingCommit,
    handleRatingInteractionChange,
    clearActiveRating,
    getRating,
  } = useRatings(movies);

  const { cardTilt, setCardTiltAnimated, resetCardTilt } = useCardTilt();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitionDirection, setTransitionDirection] = useState(null);
  const [previousMovie, setPreviousMovie] = useState(null);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);

  const activeMovie = movies[currentIndex] ?? null;

  const navigateBy = useCallback(
    (step) => {
      if (!step || movies.length <= 1) return;

      const direction = step > 0 ? 'forward' : 'backward';
      setTransitionDirection(direction);
      setCurrentIndex((previous) => {
        const nextIndex = (previous + step + movies.length) % movies.length;
        const exitingMovie = movies[previous] ?? null;
        const enteringMovie = movies[nextIndex] ?? null;

        if (exitingMovie?.id !== enteringMovie?.id) {
          setPreviousMovie(exitingMovie);
        } else {
          setPreviousMovie(null);
        }

        return nextIndex;
      });
      clearActiveRating();
    },
    [clearActiveRating, movies]
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

  const closeOverview = useCallback(() => {
    clearActiveRating();
    setTransitionDirection(null);
    setPreviousMovie(null);
    setIsOverviewOpen(false);
  }, [clearActiveRating]);

  const openOverview = useCallback(() => {
    clearActiveRating();
    setTransitionDirection(null);
    setPreviousMovie(null);
    setIsOverviewOpen(true);
  }, [clearActiveRating]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return;

      if (event.key === 'ArrowRight') {
        navigateBy(1);
      } else if (event.key === 'ArrowLeft') {
        navigateBy(-1);
      } else if (event.key === 'Escape' && isOverviewOpen) {
        closeOverview();
      } else {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeOverview, isOverviewOpen, navigateBy]);

  useEffect(() => {
    resetCardTilt();
  }, [activeMovie?.id, isOverviewOpen, resetCardTilt]);

  const swipeAreaRef = useSwipeInteractions({
    isEnabled: !isOverviewOpen,
    activeMovieId: activeMovie?.id ?? null,
    getRating,
    onNavigate: navigateBy,
    onRatingChange: handleRatingChange,
    onRatingCommit: handleRatingCommit,
    onRatingInteractionChange: handleRatingInteractionChange,
    resetCardTilt,
    setCardTiltAnimated,
  });

  const handleSelectMovie = (index) => {
    setCurrentIndex(index);
    clearActiveRating();
    setTransitionDirection(null);
    setPreviousMovie(null);
    setIsOverviewOpen(false);
  };

  const handleStageAnimationEnd = useCallback((event) => {
    if (!event.target.classList?.contains('movie-stage__card--incoming')) {
      return;
    }

    if (!['movie-stage-slide-in-right', 'movie-stage-slide-in-left'].includes(event.animationName)) {
      return;
    }

    setPreviousMovie(null);
    setTransitionDirection(null);
  }, []);

  const stageClassNames = [
    'movie-stage',
    previousMovie ? 'movie-stage--transitioning' : null,
    previousMovie && transitionDirection ? `movie-stage--${transitionDirection}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`app-shell ${isOverviewOpen ? 'app-shell--overview' : 'app-shell--focused'}`}
      style={
        !isOverviewOpen && activeMovie?.posterUrl
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
            onClick={isOverviewOpen ? closeOverview : openOverview}
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
            <OverviewGrid movies={movies} ratings={ratings} onSelectMovie={handleSelectMovie} />
          ) : activeMovie ? (
            <div className={stageClassNames} onAnimationEnd={handleStageAnimationEnd}>
              {previousMovie ? (
                <div className="movie-stage__card movie-stage__card--outgoing" key={previousMovie.id}>
                  <MovieCard
                    movie={previousMovie}
                    rating={ratings[previousMovie.id] ?? 0}
                    isRatingActive={false}
                    tilt={{ x: 0, y: 0 }}
                  />
                </div>
              ) : null}

              <div
                className={`movie-stage__card ${
                  previousMovie ? 'movie-stage__card--incoming' : 'movie-stage__card--static'
                }`}
                key={activeMovie.id}
              >
                <MovieCard
                  movie={activeMovie}
                  rating={ratings[activeMovie.id] ?? 0}
                  isRatingActive={activeRatingMovieId === activeMovie.id}
                  tilt={cardTilt}
                />
              </div>
            </div>
          ) : (
            <div className="movie-stage movie-stage--empty">Inga filmer att visa.</div>
          )}
        </main>

        <DebugConsole />
      </div>
    </div>
  );
}

export default App;
