import { useEffect, useRef } from 'react';

const horizontalThreshold = 48;
const verticalTolerance = 60;
const ratingActivationThreshold = 12;
const ratingActivationAngle = Math.tan((12 * Math.PI) / 180);
const pixelsPerRatingPoint = 28;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function useSwipeInteractions({
  isEnabled,
  activeMovieId,
  getRating,
  onNavigate,
  onRatingChange,
  onRatingCommit,
  onRatingInteractionChange,
  resetCardTilt,
  setCardTiltAnimated,
}) {
  const swipeAreaRef = useRef(null);

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }

    const swipeElement = swipeAreaRef.current;
    if (!swipeElement || activeMovieId == null) {
      return undefined;
    }

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let interactionMode = null;
    let initialRating = getRating(activeMovieId);
    let hasRatingChanged = false;
    let shouldCancelClick = false;

    const resetInteraction = () => {
      pointerId = null;
      startX = 0;
      startY = 0;
      interactionMode = null;
      hasRatingChanged = false;
      initialRating = getRating(activeMovieId);
      resetCardTilt();
    };

    const maybeCommitRating = (event) => {
      if (interactionMode !== 'rate' || !hasRatingChanged) {
        return;
      }

      const deltaY = event.clientY - startY;
      const rawValue = initialRating + (startY - event.clientY) / pixelsPerRatingPoint;
      const nextValue = clamp(rawValue, 0, 10);
      onRatingCommit(activeMovieId, nextValue);
      onRatingInteractionChange(activeMovieId, false);
      shouldCancelClick = true;
    };

    const clampTilt = (value, limit) => Math.min(limit, Math.max(-limit, value));

    const updateTiltFromDelta = (dx, dy, xLimit = 8, yLimit = 16) => {
      const nextTilt = {
        x: clampTilt(-dy / 24, xLimit),
        y: clampTilt(dx / 18, yLimit),
      };
      setCardTiltAnimated(nextTilt);
    };

    const handlePointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      shouldCancelClick = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      interactionMode = event.target.closest('.movie-poster-shell') ? 'pending' : 'navigate';
      hasRatingChanged = false;
      initialRating = getRating(activeMovieId);
      if (interactionMode === 'pending') {
        setCardTiltAnimated({ x: 0, y: 0 });
      }
    };

    const handlePointerMove = (event) => {
      if (event.pointerId !== pointerId || !interactionMode) return;

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      if (interactionMode === 'navigate') {
        updateTiltFromDelta(deltaX, deltaY);
        if (Math.abs(deltaX) < horizontalThreshold || Math.abs(deltaY) > verticalTolerance) {
          return;
        }

        onNavigate(deltaX < 0 ? 1 : -1);
        resetInteraction();
        return;
      }

      if (interactionMode === 'pending') {
        updateTiltFromDelta(deltaX, deltaY);
        if (Math.abs(deltaY) >= ratingActivationThreshold) {
          const horizontalRatio = Math.abs(deltaX) / Math.max(Math.abs(deltaY), 1);
          if (horizontalRatio <= ratingActivationAngle) {
            interactionMode = 'rate';
            onRatingInteractionChange(activeMovieId, true);
            updateTiltFromDelta(deltaX, deltaY, 10, 10);
          } else if (Math.abs(deltaX) >= horizontalThreshold) {
            interactionMode = 'navigate';
          } else {
            return;
          }
        } else if (
          Math.abs(deltaX) >= horizontalThreshold &&
          Math.abs(deltaY) <= verticalTolerance
        ) {
          interactionMode = 'navigate';
        } else {
          return;
        }
      }

      if (interactionMode === 'navigate') {
        updateTiltFromDelta(deltaX, deltaY);
        if (Math.abs(deltaX) < horizontalThreshold || Math.abs(deltaY) > verticalTolerance) {
          return;
        }

        onNavigate(deltaX < 0 ? 1 : -1);
        resetInteraction();
        return;
      }

      if (interactionMode === 'rate') {
        updateTiltFromDelta(deltaX, deltaY, 12, 8);
        const rawValue = initialRating + (startY - event.clientY) / pixelsPerRatingPoint;
        const nextValue = clamp(rawValue, 0, 10);
        hasRatingChanged = true;
        onRatingChange(activeMovieId, nextValue);
        event.preventDefault();
      }
    };

    const handlePointerUp = (event) => {
      if (event.pointerId !== pointerId) return;
      maybeCommitRating(event);
      resetInteraction();
    };

    const handlePointerCancel = (event) => {
      if (event.pointerId !== pointerId) return;
      if (interactionMode === 'rate' && hasRatingChanged) {
        onRatingInteractionChange(activeMovieId, false);
        shouldCancelClick = true;
      }
      resetInteraction();
    };

    const handleClickCapture = (event) => {
      if (!shouldCancelClick) return;
      shouldCancelClick = false;
      event.stopPropagation();
      event.preventDefault();
    };

    swipeElement.addEventListener('pointerdown', handlePointerDown, { passive: false });
    swipeElement.addEventListener('pointermove', handlePointerMove, { passive: false });
    swipeElement.addEventListener('pointerup', handlePointerUp, { passive: false });
    swipeElement.addEventListener('pointercancel', handlePointerCancel, { passive: false });
    swipeElement.addEventListener('pointerleave', handlePointerCancel, { passive: false });
    swipeElement.addEventListener('click', handleClickCapture, true);

    return () => {
      swipeElement.removeEventListener('pointerdown', handlePointerDown);
      swipeElement.removeEventListener('pointermove', handlePointerMove);
      swipeElement.removeEventListener('pointerup', handlePointerUp);
      swipeElement.removeEventListener('pointercancel', handlePointerCancel);
      swipeElement.removeEventListener('pointerleave', handlePointerCancel);
      swipeElement.removeEventListener('click', handleClickCapture, true);
    };
  }, [
    activeMovieId,
    getRating,
    isEnabled,
    onNavigate,
    onRatingChange,
    onRatingCommit,
    onRatingInteractionChange,
    resetCardTilt,
    setCardTiltAnimated,
  ]);

  return swipeAreaRef;
}
