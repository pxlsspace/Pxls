window.SLIDEIN = window.SLIDEIN || (() => {
  const SLIDEIN_TYPES = Object.freeze({
    SUCCESS: 'success',
    DANGER: 'danger',
    WARNING: 'warning',
    INFO: 'info'
  });

  { // ensure our fa-times is loaded into dom at least once so that the font is fetched and loaded by the browser. Fixes the close button not displaying on network drop.
    const icon = crel('div', { style: 'transform: translateX(-99999em);' }, crel('i', { class: 'fas fa-times' }));
    crel(document.body, icon);
    setTimeout(() => icon.remove, 5);
  }

  /**
   * A slidein instance.
   *
   * @param content {string|HTMLElement} The slidein text.
   * @param [icon=''] {string} The slidein's icon. Appended to `i.fas.fa-`, so an icon of "`check`" becomes `i.fas.fa-check`
   * @param [type='dark'] {string} The type of slidein. Used for contextual styles, e.g. background color.
   * @param [closeable=true]
   * @constructor
   */
  function Slidein(content, icon = '', type = SLIDEIN_TYPES.INFO, closeable = true) {
    if (!content || !((typeof content === 'string' && content.trim().length > 0) || content instanceof HTMLElement)) throw new Error('Invalid argument: text');
    this.content = content;
    this.closeable = closeable === true;
    this.icon = icon || false;
    this.type = type || SLIDEIN_TYPES.INFO;
    this._dom = _buildSlideinDom(this);
    this._delayClose = 0;
    this.show = () => {
      if (!this._dom) this._dom = _buildSlideinDom(this);
      this._dom.removeEventListener('animationend', showingHandler);
      this._dom.remove();
      this._dom.classList.remove('shown', 'showing');
      this._dom.removeEventListener('animationend', showingHandler);
      this._dom.removeEventListener('animationend', hidingHandler);
      requestAnimationFrame(() => {
        this._dom.addEventListener('animationend', showingHandler);
        document.body.appendChild(this._dom);
        this._dom.classList.add('showing');
      });
      return this;
    };
    this.hide = () => {
      this._dom.removeEventListener('animationend', showingHandler);
      this._dom.removeEventListener('animationend', hidingHandler);
      this._dom.classList.remove('showing');
      requestAnimationFrame(() => {
        this._dom.addEventListener('animationend', hidingHandler);
        this._dom.classList.add('hiding');
      });
      return this;
    };
    this.closeAfter = (ms) => {
      if (this._delayClose !== 0) clearTimeout(this._delayClose);
      this._delayClose = setTimeout(() => this.hide(), ms);
      return this;
    };
  }

  function showingHandler() {
    this.removeEventListener('animationend', showingHandler);
    this.classList.add('shown');
    this.classList.remove('showing');
  }

  function hidingHandler() {
    if (this._delayClose !== 0) {
      clearTimeout(this._delayClose);
      this._delayClose = 0;
    }
    this.removeEventListener('animationend', hidingHandler);
    this.classList.remove('shown', 'showing', 'hiding');
    this.remove();
  }

  function _buildSlideinDom(slidein) {
    const _class = (() => {
      switch (slidein.type.toLowerCase().trim()) {
        case SLIDEIN_TYPES.SUCCESS: {
          return `slidein-${SLIDEIN_TYPES.SUCCESS} bg-gradient-${SLIDEIN_TYPES.SUCCESS}`;
        }
        case SLIDEIN_TYPES.DANGER: {
          return `slidein-${SLIDEIN_TYPES.DANGER} bg-gradient-${SLIDEIN_TYPES.DANGER}`;
        }
        case SLIDEIN_TYPES.WARNING: {
          return `slidein-${SLIDEIN_TYPES.WARNING} bg-gradient-${SLIDEIN_TYPES.WARNING}`;
        }
        case SLIDEIN_TYPES.INFO:
        default: {
          return `slidein-${SLIDEIN_TYPES.INFO} bg-gradient-${SLIDEIN_TYPES.INFO}`;
        }
      }
    })();
    const _close = crel('i', { class: 'fas fa-times close-button' });
    const _dom = crel('div', { class: `slidein ${_class}`, 'data-icon': slidein.icon, 'data-type': slidein.type, 'data-closeable': slidein.closeable },
      crel('div', { class: 'slidein-icon' }, !slidein.icon ? null : crel('i', { class: `fas fa-${slidein.icon}` })),
      crel('div', { class: 'slidein-body' },
        slidein.content instanceof HTMLElement ? slidein.content : crel('p', slidein.content),
        slidein.closeable ? _close : null
      )
    );

    _close.addEventListener('click', function() {
      if (this && this.closest && this.closest('.slidein')) {
        slidein.hide();
      }
    });

    return _dom;
  }

  return {
    Slidein,
    SLIDEIN_TYPES
  };
})();
