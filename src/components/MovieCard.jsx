import { useState } from 'react';

const placeholderPoster =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900"%3E%3Crect width="600" height="900" fill="%23222222"/%3E%3Ctext x="50%25" y="50%25" fill="%23666666" font-size="48" text-anchor="middle" font-family="Inter, sans-serif"%3ENo Poster%3C/text%3E%3C/svg%3E';

function formatRuntime(minutes) {
  if (!minutes) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function MovieCard({ movie, transitionDirection = 0, dragOffset = 0, isDragging = false }) {
  const [isFlipped, setIsFlipped] = useState(false);

  if (!movie) {
    return null;
  }

  const posterUrl = movie.posterUrl ?? placeholderPoster;
  const backgroundImage = movie.posterUrl ? `url(${movie.posterUrl})` : undefined;
  const releaseYear = movie.releaseYear ?? '—';
  const runtime = formatRuntime(movie.runtimeMinutes);
  const overview =
    movie.overview ?? 'Plot summary unavailable right now.';
  const directionClass =
    transitionDirection > 0
      ? 'movie-card-wrapper--forward'
      : transitionDirection < 0
        ? 'movie-card-wrapper--backward'
        : '';

  const clampedOffset = Math.max(-180, Math.min(180, dragOffset ?? 0));
  const planarRotation = clampedOffset / 18;
  const flipRotation = clampedOffset / -45;
  const wrapperStyle = {
    ...(backgroundImage ? { '--poster-url': backgroundImage } : {}),
    transform: `translate3d(${clampedOffset}px, 0, 0) rotate(${planarRotation}deg) rotateY(${flipRotation}deg)`,
    transition: isDragging ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
  };

  return (
    <div className={`movie-card-wrapper ${directionClass}`} style={wrapperStyle}>
      <div className={`movie-card ${isFlipped ? 'movie-card--flipped' : ''}`}>
        <button
          type="button"
          className="movie-face movie-face--front"
          onClick={() => setIsFlipped((value) => !value)}
        >
          <div className="movie-poster-shell">
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
