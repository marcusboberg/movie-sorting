import { useEffect, useMemo, useRef, useState } from 'react';
import './FloatingToolbar.css';

function FloatingToolbar({
  mode,
  onNavigateToOverview,
  onNavigateToPoster,
  currentUser,
  onUserChange,
  filterOption,
  onFilterChange,
  sortOption,
  onSortChange,
  isScoreOverlayVisible,
  onToggleScoreOverlay,
  filterOptions = [],
  sortOptions = [],
  scoreRange = [0, 10],
  onScoreRangeChange,
  userOptions = [],
}) {
  const surfaceRef = useRef(null);
  const previousModeRef = useRef(mode);
  const [openMenu, setOpenMenu] = useState(null);

  useEffect(() => {
    if (previousModeRef.current === mode) {
      return;
    }

    const surface = surfaceRef.current;
    if (!surface) {
      previousModeRef.current = mode;
      return;
    }

    surface.classList.remove('floating-toolbar__surface--animate');
    // Trigger reflow to restart the animation when modes swap.
    void surface.offsetWidth; // eslint-disable-line no-void
    surface.classList.add('floating-toolbar__surface--animate');

    const handleAnimationEnd = () => {
      surface.classList.remove('floating-toolbar__surface--animate');
    };

    surface.addEventListener('animationend', handleAnimationEnd, { once: true });
    previousModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    setOpenMenu(null);
  }, [mode]);

  useEffect(() => {
    if (!openMenu) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!surfaceRef.current?.contains(event.target)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [openMenu]);

  const handleToggleMenu = (menu) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const handleFilterChange = (value) => {
    if (typeof onFilterChange === 'function') {
      onFilterChange(value);
    }
    setOpenMenu(value === 'scoreRange' ? 'filter' : null);
  };

  const handleSortChange = (value) => {
    if (typeof onSortChange === 'function') {
      onSortChange(value);
    }
    setOpenMenu(null);
  };

  const sanitizedScoreRange = useMemo(() => {
    const [rawMin = 0, rawMax = 10] = Array.isArray(scoreRange) ? scoreRange : [0, 10];
    const min = Number.isFinite(rawMin) ? rawMin : Number.parseFloat(rawMin) || 0;
    const max = Number.isFinite(rawMax) ? rawMax : Number.parseFloat(rawMax) || 10;
    const clampedMin = Math.min(Math.max(0, min), 10);
    const clampedMax = Math.min(10, Math.max(clampedMin, max));
    return [clampedMin, clampedMax];
  }, [scoreRange]);

  const [scoreRangeMin, scoreRangeMax] = sanitizedScoreRange;

  const availableUsers = useMemo(() => {
    if (!Array.isArray(userOptions)) {
      return [];
    }
    return userOptions.filter(Boolean);
  }, [userOptions]);
  const hasUserOptions = availableUsers.length > 0;

  const handleUserSelect = (user) => {
    if (typeof onUserChange === 'function') {
      onUserChange(user);
    }
    setOpenMenu(null);
  };

  const updateScoreRange = (type, rawValue) => {
    if (typeof onScoreRangeChange !== 'function') {
      return;
    }

    const numeric =
      typeof rawValue === 'number' && Number.isFinite(rawValue)
        ? rawValue
        : Number.parseFloat(rawValue);

    if (!Number.isFinite(numeric)) {
      if (type === 'min') {
        onScoreRangeChange([0, scoreRangeMax]);
      } else {
        onScoreRangeChange([scoreRangeMin, 10]);
      }
      return;
    }

    if (type === 'min') {
      const nextMin = Math.min(Math.max(0, numeric), 10);
      const nextMax = Math.max(nextMin, scoreRangeMax);
      onScoreRangeChange([nextMin, nextMax]);
    } else {
      const nextMax = Math.min(10, Math.max(0, numeric));
      const nextMin = Math.min(scoreRangeMin, nextMax);
      const safeMin = Math.min(nextMin, nextMax);
      const safeMax = Math.max(nextMax, safeMin);
      onScoreRangeChange([safeMin, safeMax]);
    }
  };

  const handleScoreRangeSliderChange = (type) => (event) => {
    updateScoreRange(type, event.target.value);
  };

  const handleScoreRangeNumberChange = (type) => (event) => {
    updateScoreRange(type, event.target.value);
  };

  const isPosterView = mode !== 'overview';

  const toolbarLabel = useMemo(() => (isPosterView ? 'Filmvy' : 'Affischöversikt'), [isPosterView]);

  return (
    <nav className="floating-toolbar" aria-label={`Verktygsrad för ${toolbarLabel}`}>
      <div className="floating-toolbar__surface" ref={surfaceRef}>
        <button
          type="button"
          className="floating-toolbar__avatar"
          onClick={hasUserOptions ? () => handleToggleMenu('profile') : undefined}
          aria-haspopup={hasUserOptions ? 'true' : undefined}
          aria-expanded={hasUserOptions ? openMenu === 'profile' : undefined}
          aria-label={currentUser ? `Aktiv profil: ${currentUser}` : 'Välj profil'}
          disabled={!hasUserOptions}
        >
          <span aria-hidden="true">{currentUser ? currentUser.slice(0, 2).toUpperCase() : '?'}</span>
        </button>
        {openMenu === 'profile' && hasUserOptions ? (
          <div className="floating-toolbar__menu floating-toolbar__menu--profile" role="menu">
            {availableUsers.map((user) => (
              <button
                key={user}
                type="button"
                className={`floating-toolbar__menu-item ${
                  currentUser === user ? 'floating-toolbar__menu-item--active' : ''
                }`}
                role="menuitemradio"
                aria-checked={currentUser === user}
                onClick={() => handleUserSelect(user)}
              >
                {user}
              </button>
            ))}
          </div>
        ) : null}

        {isPosterView ? (
          <div className="floating-toolbar__actions floating-toolbar__actions--poster">
            <button
              type="button"
              className="floating-toolbar__icon-button"
              onClick={onNavigateToOverview}
              aria-label="Visa affischöversikt"
            >
              <i className="fa-solid fa-grip" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="floating-toolbar__actions floating-toolbar__actions--overview">
            <div className="floating-toolbar__action-wrapper">
              <button
                type="button"
                className="floating-toolbar__action"
                onClick={() => handleToggleMenu('filter')}
                aria-haspopup="true"
                aria-expanded={openMenu === 'filter'}
              >
                <i className="fa-solid fa-filter" aria-hidden="true" />
                <span>Filter</span>
              </button>
              {openMenu === 'filter' ? (
                <div className="floating-toolbar__menu" role="menu">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`floating-toolbar__menu-item ${
                        filterOption === option.value ? 'floating-toolbar__menu-item--active' : ''
                      }`}
                      role="menuitemradio"
                      aria-checked={filterOption === option.value}
                      onClick={() => handleFilterChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                  {filterOption === 'scoreRange' ? (
                    <div
                      className="floating-toolbar__score-range"
                      role="group"
                      aria-label="Begränsa betygsspann"
                    >
                      <div className="floating-toolbar__score-range-header">
                        <span className="floating-toolbar__score-range-title">Score span</span>
                        <span className="floating-toolbar__score-range-value">
                          {scoreRangeMin.toFixed(1)} – {scoreRangeMax.toFixed(1)}
                        </span>
                      </div>
                      <div className="floating-toolbar__score-range-sliders">
                        <label className="floating-toolbar__score-range-field">
                          <span>Min</span>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={scoreRangeMin}
                            onChange={handleScoreRangeSliderChange('min')}
                            aria-label="Minsta score"
                          />
                        </label>
                        <label className="floating-toolbar__score-range-field">
                          <span>Max</span>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={scoreRangeMax}
                            onChange={handleScoreRangeSliderChange('max')}
                            aria-label="Högsta score"
                          />
                        </label>
                      </div>
                      <div className="floating-toolbar__score-range-inputs">
                        <label className="floating-toolbar__score-range-input">
                          <span>Min</span>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={scoreRangeMin}
                            onChange={handleScoreRangeNumberChange('min')}
                            aria-label="Minsta score som visas"
                          />
                        </label>
                        <label className="floating-toolbar__score-range-input">
                          <span>Max</span>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={scoreRangeMax}
                            onChange={handleScoreRangeNumberChange('max')}
                            aria-label="Högsta score som visas"
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="floating-toolbar__action-wrapper">
              <button
                type="button"
                className="floating-toolbar__action"
                onClick={() => handleToggleMenu('sort')}
                aria-haspopup="true"
                aria-expanded={openMenu === 'sort'}
              >
                <i className="fa-solid fa-arrow-down-wide-short" aria-hidden="true" />
                <span>Sortera</span>
              </button>
              {openMenu === 'sort' ? (
                <div className="floating-toolbar__menu" role="menu">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`floating-toolbar__menu-item ${
                        sortOption === option.value ? 'floating-toolbar__menu-item--active' : ''
                      }`}
                      role="menuitemradio"
                      aria-checked={sortOption === option.value}
                      onClick={() => handleSortChange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={`floating-toolbar__action floating-toolbar__action--toggle ${
                isScoreOverlayVisible ? 'floating-toolbar__action--toggle-active' : ''
              }`}
              onClick={onToggleScoreOverlay}
              aria-pressed={isScoreOverlayVisible}
            >
              <i className="fa-solid fa-layer-group" aria-hidden="true" />
              <span>{isScoreOverlayVisible ? 'Dölj betyg' : 'Visa betyg'}</span>
            </button>
            <button
              type="button"
              className="floating-toolbar__icon-button floating-toolbar__icon-button--back"
              onClick={onNavigateToPoster}
              aria-label="Tillbaka till filmvy"
            >
              <i className="fa-solid fa-clapperboard" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default FloatingToolbar;
