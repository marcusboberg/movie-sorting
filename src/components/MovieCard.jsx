import { useEffect, useState } from 'react';
import RatingRing from './RatingRing.jsx';

const placeholderPoster =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900"%3E%3Crect width="600" height="900" fill="%23222222"/%3E%3Ctext x="50%25" y="50%25" fill="%23666666" font-size="48" text-anchor="middle" font-family="Inter, sans-serif"%3ENo Poster%3C/text%3E%3C/svg%3E';

function formatRuntime(minutes) {
  if (!minutes) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function MovieCard({ movie, rating = 0, isRatingActive = false, resetTrigger = 0 }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [posterAspectRatio, setPosterAspectRatio] = useState(null);

  useEffect(() => {
    setIsFlipped(false);
    setPosterAspectRatio(null);
  }, [movie?.id, resetTrigger]);

  if (!movie) {
    return null;
  }

  const posterUrl = movie.posterUrl ?? placeholderPoster;
  const releaseYear = movie.releaseYear ?? '—';
  const runtime = formatRuntime(movie.runtimeMinutes);
  const overview =
    movie.overview ?? 'Plot summary unavailable right now.';
  const ratingValue = Number.isFinite(rating) ? rating : 0;
  const handlePosterLoad = (event) => {
    const { naturalWidth, naturalHeight } = event.target;
    if (naturalWidth && naturalHeight) {
      setPosterAspectRatio(naturalWidth / naturalHeight);
    }
  };

  const handlePosterError = (event) => {
    if (event?.target?.src !== placeholderPoster) {
      event.target.src = placeholderPoster;
    }
  };

  const aspectStyle =
    posterAspectRatio && Number.isFinite(posterAspectRatio)
      ? { '--poster-aspect-ratio': posterAspectRatio.toString() }
      : undefined;

  return (
    <div className="movie-card-wrapper" style={aspectStyle}>
      <div className={`movie-card ${isFlipped ? 'movie-card--flipped' : ''}`}>
        <button
          type="button"
          className="movie-face movie-face--front"
          onClick={() => setIsFlipped((value) => !value)}
        >
          <div className="movie-poster-shell movie-poster-shell--front">
            <RatingRing value={ratingValue} isActive={isRatingActive} />
            <img
              src={posterUrl}
              alt={movie.title}
              className="movie-poster"
              decoding="async"
              onLoad={handlePosterLoad}
              onError={handlePosterError}
            />
          </div>
        </button>

        <button
          type="button"
          className="movie-face movie-face--back"
          onClick={() => setIsFlipped((value) => !value)}
        >
          <div className="movie-poster-shell movie-poster-shell--back">
            <div className="movie-backdrop" />
            <div className="movie-details">
              <h2>{movie.title}</h2>
              <p className="movie-meta">
                <span>{releaseYear}</span>
                <span aria-hidden="true">•</span>
                <span>{runtime}</span>
              </p>
              <p className="movie-overview">{overview}</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

export default MovieCard;
