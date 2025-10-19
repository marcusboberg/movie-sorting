const basePath = typeof import.meta?.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/';
const basePathWithTrailingSlash = basePath.endsWith('/') ? basePath : `${basePath}/`;

export const resolvePosterPath = (imdbId) => `${basePathWithTrailingSlash}posters/${imdbId}.jpg`;

export function normalizeMovie(movie, index) {
  const fallbackOrder = index + 1;
  const order = Number.isFinite(movie?.order) ? movie.order : fallbackOrder;
  const id = movie?.id ?? movie?.imdbId ?? order ?? fallbackOrder;
  const localPoster = typeof movie?.imdbId === 'string' ? resolvePosterPath(movie.imdbId) : null;
  const runtimeMinutes = Number.isFinite(movie?.runtime)
    ? movie.runtime
    : Number.isFinite(movie?.runtimeMinutes)
      ? movie.runtimeMinutes
      : null;
  const releaseYear = movie?.year ?? movie?.releaseYear ?? '—';

  return {
    id,
    order,
    title: movie?.title ?? 'Untitled',
    posterUrl: localPoster ?? movie?.image ?? movie?.posterUrl ?? null,
    runtimeMinutes,
    releaseYear: releaseYear != null ? String(releaseYear) : '—',
    overview: (() => {
      const description = typeof movie?.description === 'string' ? movie.description.trim() : '';
      if (description) return description;

      const overview = typeof movie?.overview === 'string' ? movie.overview.trim() : '';
      return overview || null;
    })(),
  };
}

export function prepareMovies(rawMovies) {
  if (!Array.isArray(rawMovies)) {
    return [];
  }

  return rawMovies
    .filter(Boolean)
    .map((movie, index) => normalizeMovie(movie, index))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(({ order, ...movie }) => movie);
}
