const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function RatingRing({
  value = 0,
  isActive = false,
  className = '',
  style = {},
  ariaHidden = false,
}) {
  const ratingValue = Number.isFinite(value) ? value : 0;
  const ratingRatio = clamp(ratingValue / 10, 0, 1);
  const strokeOffset = RING_CIRCUMFERENCE * (1 - ratingRatio);
  const ratingColor = `hsl(${Math.round(120 * ratingRatio)}, 80%, 54%)`;

  const classes = ['movie-rating-ring'];
  if (isActive) {
    classes.push('movie-rating-ring--active');
  }
  if (className) {
    classes.push(className);
  }

  return (
    <div
      className={classes.join(' ')}
      style={{ '--rating-ratio': ratingRatio, '--rating-color': ratingColor, ...style }}
      aria-hidden={ariaHidden}
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
      </div>
    </div>
  );
}

export default RatingRing;

