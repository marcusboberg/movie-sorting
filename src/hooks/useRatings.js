import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_RATING = 5;

const createInitialRatings = (movies) =>
  movies.reduce((accumulator, movie) => {
    accumulator[movie.id] = DEFAULT_RATING;
    return accumulator;
  }, {});

export function useRatings(movies) {
  const [ratings, setRatings] = useState(() => createInitialRatings(movies));
  const ratingsRef = useRef(ratings);
  const [activeRatingMovieId, setActiveRatingMovieId] = useState(null);

  useEffect(() => {
    ratingsRef.current = ratings;
  }, [ratings]);

  useEffect(() => {
    setRatings((previous) => {
      if (movies.length === 0) {
        return {};
      }

      const next = { ...previous };
      let hasChanges = false;
      const validMovieIds = new Set();

      movies.forEach((movie) => {
        validMovieIds.add(movie.id);
        if (!(movie.id in next)) {
          next[movie.id] = DEFAULT_RATING;
          hasChanges = true;
        }
      });

      Object.keys(next).forEach((id) => {
        if (!validMovieIds.has(id)) {
          delete next[id];
          hasChanges = true;
        }
      });

      return hasChanges ? next : previous;
    });
  }, [movies]);

  const normalizeRating = useCallback((value) => Math.round((value ?? 0) * 10) / 10, []);

  const updateRating = useCallback(
    (movieId, value) => {
      const normalized = normalizeRating(value);
      setRatings((previous) => {
        const current = previous[movieId] ?? 0;
        if (Math.abs(current - normalized) < 0.0001) {
          return previous;
        }

        return { ...previous, [movieId]: normalized };
      });
      return normalized;
    },
    [normalizeRating]
  );

  const clearActiveRating = useCallback(() => {
    setActiveRatingMovieId(null);
  }, []);

  const handleRatingChange = useCallback(
    (movieId, value) => {
      updateRating(movieId, value);
    },
    [updateRating]
  );

  const handleRatingCommit = useCallback(
    (movieId, value) => {
      updateRating(movieId, value);
      clearActiveRating();
    },
    [clearActiveRating, updateRating]
  );

  const handleRatingInteractionChange = useCallback((movieId, isActive) => {
    setActiveRatingMovieId(isActive ? movieId : null);
  }, []);

  const getRating = useCallback((movieId) => ratingsRef.current[movieId] ?? 0, []);

  const ratingsSummary = useMemo(
    () => ({
      ratings,
      activeRatingMovieId,
    }),
    [activeRatingMovieId, ratings]
  );

  return {
    ...ratingsSummary,
    handleRatingChange,
    handleRatingCommit,
    handleRatingInteractionChange,
    clearActiveRating,
    getRating,
  };
}
