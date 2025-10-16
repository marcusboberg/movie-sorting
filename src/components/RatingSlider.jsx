const steps = Array.from({ length: 11 }, (_, index) => index);

function RatingSlider({ value, onChange }) {
  return (
    <div className="rating-slider">
      <div className="rating-label">Rate this movie</div>
      <div className="rating-control">
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="Rate this movie"
        />
        <div className="rating-dots">
          {steps.map((step) => (
            <span
              key={step}
              className={`rating-dot ${value === step ? 'rating-dot--active' : ''}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      <div className="rating-value">{value.toFixed(0)} / 10</div>
    </div>
  );
}

export default RatingSlider;
