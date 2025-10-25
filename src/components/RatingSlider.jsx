import { useCallback, useRef, useState } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const markers = Array.from({ length: 11 }, (_, index) => index);

function RatingSlider({ value, onChange, onCommit, onInteractionChange }) {
  const trackRef = useRef(null);
  const pointerActiveRef = useRef(false);
  const [isPointerActive, setIsPointerActive] = useState(false);

  const updateValueFromPointer = useCallback(
    (event) => {
      const trackElement = trackRef.current;
      if (!trackElement) return value ?? 0;

      const rect = trackElement.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      const ratio = rect.width > 0 ? relativeX / rect.width : 0;
      const nextValue = clamp(Math.round(ratio * 20) / 2, 0, 10);
      return nextValue;
    },
    [value]
  );

  const handlePointerDown = useCallback(
    (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointerActiveRef.current = true;
      setIsPointerActive(true);

      const nextValue = updateValueFromPointer(event);
      onInteractionChange?.(true);
      onChange?.(nextValue);
      event.preventDefault();
    },
    [onChange, onInteractionChange, updateValueFromPointer]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!pointerActiveRef.current) return;
      const nextValue = updateValueFromPointer(event);
      onChange?.(nextValue);
      event.preventDefault();
    },
    [onChange, updateValueFromPointer]
  );

  const finishInteraction = useCallback(
    (event) => {
      if (!pointerActiveRef.current) return;
      pointerActiveRef.current = false;
      setIsPointerActive(false);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const nextValue = updateValueFromPointer(event);
      onChange?.(nextValue);
      onCommit?.(nextValue);
      onInteractionChange?.(false);
      event.preventDefault();
    },
    [onChange, onCommit, onInteractionChange, updateValueFromPointer]
  );

  const cancelInteraction = useCallback(
    (event) => {
      if (!pointerActiveRef.current) return;
      pointerActiveRef.current = false;
      setIsPointerActive(false);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onInteractionChange?.(false);
    },
    [onInteractionChange]
  );

  const fillRatio = clamp((value ?? 0) / 10, 0, 1);

  return (
    <div className={`rating-slider${isPointerActive ? ' rating-slider--active' : ''}`}>
      <div className="rating-label">Dra för att betygsätta</div>
      <div
        ref={trackRef}
        className={`rating-track${isPointerActive ? ' rating-track--interacting' : ''}`}
        style={{ '--rating-ratio': fillRatio }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishInteraction}
        onPointerCancel={cancelInteraction}
        onPointerLeave={finishInteraction}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={Math.round((value ?? 0) * 10) / 10}
        aria-label="Sätt betyg"
      >
        <div className="rating-track-fill" />
        <div className="rating-track-thumb" />
        <div className="rating-track-markers">
          {markers.map((marker) => (
            <span key={marker} className="rating-track-marker" />
          ))}
        </div>
      </div>
      <div className="rating-readout">{(value ?? 0).toFixed(1)} av 10</div>
    </div>
  );
}

export default RatingSlider;
