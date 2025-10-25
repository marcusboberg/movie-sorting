import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const actionsContainerRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [expandedAction, setExpandedAction] = useState(null);
  const actionRefs = useRef(new Map());
  const updateExpandedActionRef = useRef(() => {});
  const expandedActionRef = useRef(expandedAction);
  const openMenuRef = useRef(openMenu);
  const isUserInteractingRef = useRef(false);
  const previousModeRef = useRef(mode);

  useEffect(() => {
    expandedActionRef.current = expandedAction;
  }, [expandedAction]);

  useEffect(() => {
    openMenuRef.current = openMenu;
  }, [openMenu]);

  useEffect(() => {
    if (mode === 'overview') {
      return;
    }

    isUserInteractingRef.current = false;
  }, [mode]);

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

  const isPosterView = mode !== 'overview';

  const scrollActionIntoCenter = useCallback((key, { behavior = 'smooth' } = {}) => {
    const container = actionsContainerRef.current;
    const element = actionRefs.current.get(key);

    if (!container || !element) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    if (!containerRect || containerRect.width <= 0 || !elementRect || elementRect.width <= 0) {
      return;
    }

    const containerCenter = containerRect.left + containerRect.width / 2;
    const elementCenter = elementRect.left + elementRect.width / 2;
    const offset = elementCenter - containerCenter;
    const targetScroll = container.scrollLeft + offset;
    const maxScroll = container.scrollWidth - container.clientWidth;
    const clampedScroll = Math.max(0, Math.min(Number.isFinite(maxScroll) ? maxScroll : 0, targetScroll));

    container.scrollTo({
      left: clampedScroll,
      behavior,
    });
  }, []);

  const handleToggleMenu = (menu) => {
    const nextMenu = openMenu === menu ? null : menu;

    if (nextMenu) {
      scrollActionIntoCenter(nextMenu);
    }

    setOpenMenu(nextMenu);
  };

  const registerActionRef = useCallback(
    (key) => (element) => {
      if (element) {
        actionRefs.current.set(key, element);
        requestAnimationFrame(() => {
          updateExpandedActionRef.current();
          if (!isPosterView) {
            const targetKey = openMenu ?? expandedAction ?? 'filter';
            if (targetKey === key) {
              scrollActionIntoCenter(key, { behavior: 'auto' });
            }
          }
        });
      } else {
        actionRefs.current.delete(key);
      }
    },
    [expandedAction, isPosterView, openMenu, scrollActionIntoCenter],
  );

  const handleFilterChange = (value) => {
    if (typeof onFilterChange === 'function') {
      onFilterChange(value);
    }
    setOpenMenu(value === 'scoreRange' ? 'filter' : null);
    scrollActionIntoCenter('filter');
  };

  const handleSortChange = (value) => {
    if (typeof onSortChange === 'function') {
      onSortChange(value);
    }
    setOpenMenu(null);
    scrollActionIntoCenter('sort');
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
    scrollActionIntoCenter('filter');
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

  const toolbarLabel = useMemo(() => (isPosterView ? 'Filmvy' : 'Affischöversikt'), [isPosterView]);

  const updateExpandedAction = useCallback(() => {
    if (isPosterView) {
      setExpandedAction(null);
      return;
    }

    const container = actionsContainerRef.current;
    if (!container) {
      setExpandedAction(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    if (!containerRect || containerRect.width <= 0) {
      setExpandedAction(null);
      return;
    }

    const containerCenter = containerRect.left + containerRect.width / 2;
    let bestKey = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    actionRefs.current.forEach((element, key) => {
      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      if (!rect || rect.width <= 0) {
        return;
      }

      const actionCenter = rect.left + rect.width / 2;
      const distance = Math.abs(actionCenter - containerCenter);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestKey = key;
      }
    });

    setExpandedAction((current) => (current === bestKey ? current : bestKey));
  }, [isPosterView]);

  updateExpandedActionRef.current = updateExpandedAction;

  useEffect(() => {
    if (isPosterView) {
      setExpandedAction(null);
      return undefined;
    }

    const container = actionsContainerRef.current;
    if (!container) {
      return undefined;
    }

    let frameId = null;

    const handleScroll = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        updateExpandedActionRef.current();
      });
    };

    handleScroll();

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isPosterView]);

  useEffect(() => {
    if (isPosterView) {
      return undefined;
    }

    const container = actionsContainerRef.current;
    if (!container) {
      return undefined;
    }

    let pointerCount = 0;

    const beginInteraction = () => {
      pointerCount += 1;
      isUserInteractingRef.current = true;
    };

    const endInteraction = () => {
      pointerCount = Math.max(0, pointerCount - 1);
      if (pointerCount > 0) {
        return;
      }

      requestAnimationFrame(() => {
        isUserInteractingRef.current = false;
        updateExpandedActionRef.current();
        const targetKey = openMenuRef.current ?? expandedActionRef.current ?? 'filter';
        scrollActionIntoCenter(targetKey, { behavior: 'smooth' });
      });
    };

    container.addEventListener('pointerdown', beginInteraction, { passive: true });
    container.addEventListener('pointerup', endInteraction, { passive: true });
    container.addEventListener('pointercancel', endInteraction, { passive: true });
    container.addEventListener('pointerleave', endInteraction, { passive: true });

    return () => {
      container.removeEventListener('pointerdown', beginInteraction);
      container.removeEventListener('pointerup', endInteraction);
      container.removeEventListener('pointercancel', endInteraction);
      container.removeEventListener('pointerleave', endInteraction);
      isUserInteractingRef.current = false;
    };
  }, [isPosterView, scrollActionIntoCenter]);

  useEffect(() => {
    if (!isPosterView && !isUserInteractingRef.current) {
      requestAnimationFrame(() => {
        updateExpandedActionRef.current();
        scrollActionIntoCenter(openMenu ?? expandedAction ?? 'filter', { behavior: 'auto' });
      });
    }
  }, [
    isPosterView,
    filterOption,
    sortOption,
    scoreRangeMin,
    scoreRangeMax,
    isScoreOverlayVisible,
    openMenu,
    expandedAction,
    scrollActionIntoCenter,
  ]);

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
          <div
            className="floating-toolbar__actions floating-toolbar__actions--overview"
            ref={actionsContainerRef}
          >
            <div className="floating-toolbar__actions-indicator" aria-hidden="true" />
            <div className="floating-toolbar__action-wrapper">
              <button
                type="button"
                className={`floating-toolbar__action ${
                  expandedAction === 'filter' ? 'floating-toolbar__action--expanded' : ''
                }`}
                onClick={() => handleToggleMenu('filter')}
                aria-haspopup="true"
                aria-expanded={openMenu === 'filter'}
                aria-label="Filter"
                ref={registerActionRef('filter')}
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
                className={`floating-toolbar__action ${
                  expandedAction === 'sort' ? 'floating-toolbar__action--expanded' : ''
                }`}
                onClick={() => handleToggleMenu('sort')}
                aria-haspopup="true"
                aria-expanded={openMenu === 'sort'}
                aria-label="Sortera"
                ref={registerActionRef('sort')}
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
              } ${expandedAction === 'score-toggle' ? 'floating-toolbar__action--expanded' : ''}`}
              onClick={onToggleScoreOverlay}
              aria-pressed={isScoreOverlayVisible}
              aria-label={isScoreOverlayVisible ? 'Dölj betyg' : 'Visa betyg'}
              ref={registerActionRef('score-toggle')}
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
