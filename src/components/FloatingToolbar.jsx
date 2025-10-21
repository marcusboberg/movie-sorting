import { useEffect, useMemo, useRef, useState } from 'react';
import './FloatingToolbar.css';

function FloatingToolbar({
  mode,
  onNavigateToOverview,
  onNavigateToPoster,
  filterOption,
  onFilterChange,
  sortOption,
  onSortChange,
  isScoreOverlayVisible,
  onToggleScoreOverlay,
  filterOptions = [],
  sortOptions = [],
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
    setOpenMenu(null);
  };

  const handleSortChange = (value) => {
    if (typeof onSortChange === 'function') {
      onSortChange(value);
    }
    setOpenMenu(null);
  };

  const isPosterView = mode !== 'overview';

  const toolbarLabel = useMemo(() => (isPosterView ? 'Filmvy' : 'Affischöversikt'), [isPosterView]);

  return (
    <nav className="floating-toolbar" aria-label={`Verktygsrad för ${toolbarLabel}`}>
      <div className="floating-toolbar__surface" ref={surfaceRef}>
        <button type="button" className="floating-toolbar__avatar" aria-label="Profil (kommer snart)">
          <span aria-hidden="true">MB</span>
        </button>

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
