import { useEffect, useState } from 'react';

const placeholderPoster =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900"%3E%3Crect width="600" height="900" fill="%23222222"/%3E%3Ctext x="50%25" y="50%25" fill="%23666666" font-size="48" text-anchor="middle" font-family="Inter, sans-serif"%3ENo Poster%3C/text%3E%3C/svg%3E';

function formatRuntime(minutes) {
  if (!minutes) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function MovieCard({ movie, rating = 0, isRatingActive = false }) {
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    setIsFlipped(false);
  }, [movie?.id]);

  if (!movie) {
    return null;
  }

  const posterUrl = movie.posterUrl ?? placeholderPoster;
  const releaseYear = movie.releaseYear ?? '—';
  const runtime = formatRuntime(movie.runtimeMinutes);
  const overview =
    movie.overview ?? 'Plot summary unavailable right now.';
  const ratingValue = Number.isFinite(rating) ? rating : 0;
  const ratingRatio = Math.min(Math.max(ratingValue / 10, 0), 1);
  const strokeOffset = RING_CIRCUMFERENCE * (1 - ratingRatio);
  const ratingColor = `hsl(${Math.round(120 * ratingRatio)}, 80%, 54%)`;

  return (
    <div className="movie-card-wrapper">
      <div className={`movie-card ${isFlipped ? 'movie-card--flipped' : ''}`}>
        <button
          type="button"
          className="movie-face movie-face--front"
          onClick={() => setIsFlipped((value) => !value)}
        >
          <div className="movie-poster-shell">
            <div
              className={`movie-rating-ring ${isRatingActive ? 'movie-rating-ring--active' : ''}`}
              style={{ '--rating-ratio': ratingRatio, '--rating-color': ratingColor }}
            >
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="movie-rating-ring__background" cx="60" cy="60" r={RING_RADIUS} />
                <circle
                  className="movie-rating-ring__progress"
                  cx="60"
                  cy="60"
                  r={RING_RADIUS}
                  style={{
                    strokeDasharray: `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`,
                    strokeDashoffset: strokeOffset,
                  }}
                />
              </svg>
              <div className="movie-rating-ring__value">
                <span className="movie-rating-ring__value-number">{ratingValue.toFixed(1)}</span>
                <span className="movie-rating-ring__value-scale">/10</span>
              </div>
            </div>
            <div className={`movie-rating-preview ${isRatingActive ? 'movie-rating-preview--visible' : ''}`}>
              <span>{ratingValue.toFixed(1)}</span>
            </div>
            <img
              src={posterUrl}
              alt={movie.title}
              className="movie-poster"
              loading="lazy"
            />
          </div>
        </button>

        <button
          type="button"
          className="movie-face movie-face--back"
          onClick={() => setIsFlipped((value) => !value)}
        >
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
        </button>
      </div>
    </div>
  );
}

export default MovieCard;
