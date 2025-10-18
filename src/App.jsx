import { useCallback, useMemo, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCards, Keyboard } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-cards';
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
  const swiperRef = useRef(null);

  const activeMovie = movies[currentIndex];

  const navigateBy = (step) => {
    if (!swiperRef.current) return;
    if (step > 0) {
      swiperRef.current.slideNext();
    } else if (step < 0) {
      swiperRef.current.slidePrev();
    }
  };

  const handlePrev = () => navigateBy(-1);
  const handleNext = () => navigateBy(1);
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

        <main className="app-main">
          <Swiper
            effect="cards"
            modules={[EffectCards, Keyboard]}
            keyboard={{ enabled: true }}
            grabCursor
            loop={movies.length > 1}
            onSwiper={(instance) => {
              swiperRef.current = instance;
            }}
            onRealIndexChange={(instance) => {
              setCurrentIndex(instance.realIndex);
              setActiveRatingMovieId(null);
            }}
            cardsEffect={{ perSlideOffset: 18, perSlideRotate: 5, slideShadows: false }}
            className="movie-swiper"
            initialSlide={currentIndex}
          >
            {movies.map((movie) => (
              <SwiperSlide key={movie.id} className="movie-swiper-slide">
                <MovieCard
                  movie={movie}
                  rating={ratings[movie.id] ?? 0}
                  isRatingActive={activeRatingMovieId === movie.id}
                />
              </SwiperSlide>
            ))}
          </Swiper>
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
