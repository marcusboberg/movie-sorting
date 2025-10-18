import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCards, Keyboard, Navigation } from 'swiper/modules';
import rawMovies from './movies.json';
import MovieCard from './components/MovieCard.jsx';
import RatingSlider from './components/RatingSlider.jsx';
import './App.css';
import 'swiper/css';
import 'swiper/css/effect-cards';
import 'swiper/css/navigation';

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
  const swiperRef = useRef(null);
  const prevButtonRef = useRef(null);
  const nextButtonRef = useRef(null);

  const activeMovie = movies[currentIndex];

  const navigateBy = useCallback(
    (step) => {
      if (!step || movies.length <= 1) return;
      const swiper = swiperRef.current;
      if (swiper) {
        if (step > 0) {
          swiper.slideNext();
        } else {
          swiper.slidePrev();
        }
      } else {
        setCurrentIndex((previous) => {
          const nextIndex = (previous + step + movies.length) % movies.length;
          return nextIndex;
        });
      }
      setActiveRatingMovieId(null);
    },
    [movies.length]
  );

  const handlePrev = () => navigateBy(-1);
  const handleNext = () => navigateBy(1);

  useEffect(() => {
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
    const swiper = swiperRef.current;
    if (!swiper) return;

    // Keep Swiper in sync with React so touch gestures stay enabled on mobile.
    swiper.allowTouchMove = movies.length > 1;
    swiper.update();

    if (swiper.realIndex !== currentIndex) {
      if (swiper.params.loop) {
        swiper.slideToLoop(currentIndex, 0);
      } else {
        swiper.slideTo(currentIndex, 0);
      }
    }
  }, [currentIndex, movies.length]);

  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper || !swiper.navigation) return;

    // Re-bind navigation elements so the same buttons control Swiper and keyboard nav.
    swiper.params.navigation.prevEl = prevButtonRef.current;
    swiper.params.navigation.nextEl = nextButtonRef.current;
    swiper.navigation.destroy();
    swiper.navigation.init();
    swiper.navigation.update();
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
            ref={prevButtonRef}
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
            ref={nextButtonRef}
          >
            ›
          </button>
        </header>

        <main className="app-main">
          {movies.length > 0 ? (
            <Swiper
              modules={[EffectCards, Keyboard, Navigation]}
              effect="cards"
              keyboard={{ enabled: true }}
              navigation={{
                prevEl: prevButtonRef.current,
                nextEl: nextButtonRef.current,
              }}
              loop={movies.length > 1}
              allowTouchMove={movies.length > 1}
              onSwiper={(instance) => {
                swiperRef.current = instance;
              }}
              onBeforeInit={(swiper) => {
                // Hook up the existing navigation buttons to Swiper's navigation module.
                swiper.params.navigation.prevEl = prevButtonRef.current;
                swiper.params.navigation.nextEl = nextButtonRef.current;
              }}
              onSlideChange={(swiper) => {
                // Update React state whenever Swiper changes slides (including touch swipes).
                setCurrentIndex(swiper.realIndex);
                setActiveRatingMovieId(null);
              }}
              className="movie-stage"
            >
              {movies.map((movie) => (
                <SwiperSlide key={movie.id} className="movie-stage__slide">
                  <MovieCard
                    movie={movie}
                    rating={ratings[movie.id] ?? 0}
                    isRatingActive={activeRatingMovieId === movie.id}
                  />
                </SwiperSlide>
              ))}
            </Swiper>
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
