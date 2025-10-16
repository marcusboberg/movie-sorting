function MovieDots({ total, currentIndex, onSelect }) {
  return (
    <nav className="movie-dots" aria-label="Movie selection">
      {Array.from({ length: total }, (_, index) => (
        <button
          key={index}
          type="button"
          className={`movie-dot ${index === currentIndex ? 'movie-dot--active' : ''}`}
          onClick={() => onSelect(index)}
          aria-label={`Go to movie ${index + 1}`}
        />
      ))}
    </nav>
  );
}

export default MovieDots;
