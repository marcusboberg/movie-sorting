import './FloatingToolbar.css';

function FloatingToolbar({ mode, onNavigateToOverview, onNavigateToPoster }) {
  const isPosterView = mode !== 'overview';

  return (
    <nav className="floating-toolbar" aria-label="Verktygsrad">
      <div className="floating-toolbar__surface">
        <div className="floating-toolbar__items">
          {isPosterView ? (
            <div className="floating-toolbar__item-wrapper">
              <button
                type="button"
                className="floating-toolbar__button"
                onClick={onNavigateToOverview}
                aria-label="Visa affischöversikt"
              >
                <i className="fa-solid fa-grip" aria-hidden="true" />
                <span className="floating-toolbar__label">Översikt</span>
              </button>
            </div>
          ) : (
            <>
              <div className="floating-toolbar__item-wrapper">
                <a
                  className="floating-toolbar__button"
                  href="#profile-settings"
                  aria-label="Välj profil"
                >
                  <i className="fa-solid fa-user" aria-hidden="true" />
                  <span className="floating-toolbar__label">Profil</span>
                </a>
              </div>
              <div className="floating-toolbar__item-wrapper">
                <a
                  className="floating-toolbar__button"
                  href="#overview-filter"
                  aria-label="Filterinställningar"
                >
                  <i className="fa-solid fa-filter" aria-hidden="true" />
                  <span className="floating-toolbar__label">Filter</span>
                </a>
              </div>
              <div className="floating-toolbar__item-wrapper">
                <a
                  className="floating-toolbar__button"
                  href="#overview-sort"
                  aria-label="Sorteringsalternativ"
                >
                  <i className="fa-solid fa-arrow-down-wide-short" aria-hidden="true" />
                  <span className="floating-toolbar__label">Sortera</span>
                </a>
              </div>
              <div className="floating-toolbar__item-wrapper">
                <a
                  className="floating-toolbar__button"
                  href="#score-visibility"
                  aria-label="Inställningar för betygsvisning"
                >
                  <i className="fa-solid fa-layer-group" aria-hidden="true" />
                  <span className="floating-toolbar__label">Betyg</span>
                </a>
              </div>
              <div className="floating-toolbar__item-wrapper">
                <button
                  type="button"
                  className="floating-toolbar__button"
                  onClick={onNavigateToPoster}
                  aria-label="Tillbaka till filmvy"
                >
                  <i className="fa-solid fa-clapperboard" aria-hidden="true" />
                  <span className="floating-toolbar__label">Filmer</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default FloatingToolbar;
