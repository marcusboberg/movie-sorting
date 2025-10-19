function OverviewGrid({ movies, ratings, onSelectMovie }) {
  return (
    <div className="overview-grid">
      {movies.map((movie, index) => {
        const posterUrl = movie.posterUrl ?? null;
        const ratingValue = ratings[movie.id];
        const hasRating = Number.isFinite(ratingValue);

        return (
          <button
            key={movie.id}
            type="button"
            className="overview-card"
            onClick={() => onSelectMovie(index)}
            aria-label={`Visa ${movie.title}`}
          >
            <div className="overview-card__poster-shell">
              {hasRating ? (
                <div className="overview-card__rating">
                  <span className="overview-card__rating-value">{ratingValue.toFixed(1)}</span>
                  <span className="overview-card__rating-scale">/10</span>
                </div>
              ) : null}
              {posterUrl ? (
                <img src={posterUrl} alt={movie.title} loading="lazy" />
              ) : (
                <div className="overview-card__fallback">Ingen affisch</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default OverviewGrid;
