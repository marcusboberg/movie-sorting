import { useCallback, useEffect, useRef, useState } from 'react';

export function useCardTilt() {
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });
  const tiltTargetRef = useRef(cardTilt);
  const tiltFrameRef = useRef(null);

  const commitCardTilt = useCallback(() => {
    tiltFrameRef.current = null;
    setCardTilt(tiltTargetRef.current);
  }, []);

  const setCardTiltAnimated = useCallback(
    (nextTilt) => {
      tiltTargetRef.current = nextTilt;

      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        setCardTilt(nextTilt);
        return;
      }

      if (tiltFrameRef.current != null) {
        return;
      }

      tiltFrameRef.current = window.requestAnimationFrame(commitCardTilt);
    },
    [commitCardTilt]
  );

  const resetCardTilt = useCallback(() => {
    setCardTiltAnimated({ x: 0, y: 0 });
  }, [setCardTiltAnimated]);

  useEffect(
    () => () => {
      if (tiltFrameRef.current != null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(tiltFrameRef.current);
      }
      tiltFrameRef.current = null;
    },
    []
  );

  return { cardTilt, setCardTiltAnimated, resetCardTilt };
}
