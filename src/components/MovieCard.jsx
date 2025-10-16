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

function MovieCard({ movie, details, posterUrl, loading, error }) {
  const [isFlipped, setIsFlipped] = useState(false);

  if (!movie) {
    return null;
  }

  const effectivePoster = posterUrl ?? placeholderPoster;
  const backgroundImage = posterUrl ? `url(${posterUrl})` : undefined;

  return (
    <div
      className="movie-card-wrapper"
      style={backgroundImage ? { '--poster-url': backgroundImage } : undefined}
    >
      <div className={`movie-card ${isFlipped ? 'movie-card--flipped' : ''}`}>
        <button
          type="button"
          className="movie-face movie-face--front"
          onClick={() => setIsFlipped((value) => !value)}
        >
          <div className="movie-poster-shell">
            {loading && (
              <div className="movie-loader">
                <span className="loader-dot" />
                <span className="loader-dot" />
                <span className="loader-dot" />
              </div>
            )}
            {!loading && (
              <img
                src={effectivePoster}
                alt={movie.title}
                className="movie-poster"
                loading="lazy"
              />
            )}
          </div>
        </button>

        <button
          type="button"
          className="movie-face movie-face--back"
          onClick={() => setIsFlipped((value) => !value)}
        >
          <div className="movie-backdrop" />
          <div className="movie-details">
            <h2>{details?.title ?? movie.title}</h2>
            <p className="movie-meta">
              <span>{details?.release_date ? details.release_date.slice(0, 4) : '—'}</span>
              <span aria-hidden="true">•</span>
              <span>{formatRuntime(details?.runtime)}</span>
            </p>
            {error && <p className="movie-error">{error}</p>}
            {!error && (
              <p className="movie-overview">
                {details?.overview ?? 'Plot summary unavailable right now.'}
              </p>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

export default MovieCard;
