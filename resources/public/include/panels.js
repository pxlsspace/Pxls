const { ls } = require('./storage');

module.exports.panels = (function() {
  const self = {
    init: () => {
      Array.from(document.querySelectorAll('.panel-trigger')).forEach(panelTrigger => {
        panelTrigger.addEventListener('click', e => {
          if (!e.target) {
            return console.debug('[PANELS:TRIGGER] No target?');
          }

          const closestTrigger = e.target.closest('.panel-trigger');
          if (closestTrigger) {
            const _panelDescriptor = closestTrigger.dataset.panel;
            if (_panelDescriptor && _panelDescriptor.trim()) {
              const targetPanel = document.querySelector(`.panel[data-panel="${_panelDescriptor.trim()}"]`);
              if (targetPanel) {
                self._setOpenState(targetPanel, true, true);
              } else {
                console.debug('[PANELS:TRIGGER] Bad descriptor? Got: %o', _panelDescriptor);
              }
            } else {
              console.debug('[PANELS:TRIGGER] No descriptor? Elem: %o', closestTrigger);
            }
          } else {
            console.debug('[PANELS:TRIGGER] No trigger?');
          }
        });
      });
      Array.from(document.querySelectorAll('.panel-closer')).forEach(panelClose => {
        panelClose.addEventListener('click', e => {
          if (!e.target) {
            return console.debug('[PANELS:CLOSER] No target?');
          }
          const closestPanel = e.target.closest('.panel');
          if (closestPanel) {
            self._setOpenState(closestPanel, false, false);
          } else {
            console.debug('[PANELS:CLOSER] No panel?');
          }
        });
      });
      if (ls.get('seen_initial_info') !== true) {
        ls.set('seen_initial_info', true);
        self._setOpenState('info', true);
      }
    },
    _getPanelElement: (panel) => panel instanceof HTMLElement ? panel : document.querySelector(`.panel[data-panel="${panel}"]`),
    _getPanelTriggerElement: (panel) => {
      panel = self._getPanelElement(panel);
      if (!panel) {
        return null;
      }
      return document.querySelector(`.panel-trigger[data-panel="${panel.dataset.panel}"]`);
    },
    setEnabled: (panel, enabled) => {
      panel = self._getPanelElement(panel);
      if (enabled) {
        delete panel.dataset.disabled;
      } else {
        panel.dataset.disabled = '';
      }

      const panelTrigger = self._getPanelTriggerElement(panel);
      if (panelTrigger) {
        panelTrigger.style.display = enabled ? '' : 'none';
      }
    },
    isEnabled: (panel) => {
      panel = self._getPanelElement(panel);
      return panel && panel.dataset.disabled == null;
    },
    isOpen: panel => {
      panel = self._getPanelElement(panel);
      return panel && self.isEnabled(panel) && panel.classList.contains('open');
    },
    _toggleOpenState: (panel, exclusive = true) => {
      panel = self._getPanelElement(panel);
      if (panel && self.isEnabled(panel)) {
        self._setOpenState(panel, !panel.classList.contains('open'), exclusive);
      }
    },
    _setOpenState: (panel, state, exclusive = true) => {
      state = !!state;

      panel = self._getPanelElement(panel);
      if (panel) {
        const panelDescriptor = panel.dataset.panel;
        const panelPosition = panel.classList.contains('right') ? 'right' : 'left';

        if (state) {
          if (exclusive) {
            document.querySelectorAll(`.panel[data-panel].${panelPosition}.open`).forEach(x => {
              x.classList.remove('open');
              $(window).trigger('pxls:panel:closed', x.dataset.panel);
            });
          }
          $(window).trigger('pxls:panel:opened', panelDescriptor);
          document.body.classList.toggle('panel-open', true);
          document.body.classList.toggle(`panel-${panelPosition}`, true);
        } else {
          $(window).trigger('pxls:panel:closed', panelDescriptor);
          document.body.classList.toggle('panel-open', document.querySelectorAll('.panel.open').length - 1 > 0);
          document.body.classList.toggle(`panel-${panelPosition}`, false);
        }
        panel.classList.toggle('open', state);

        document.body.classList.toggle(`panel-${panelPosition}-halfwidth`, $(`.panel[data-panel].${panelPosition}.open.half-width`).length > 0);
        document.body.classList.toggle(`panel-${panelPosition}-horizontal`, $(`.panel[data-panel].${panelPosition}.open.horizontal`).length > 0);
      }
    }
  };
  return {
    init: self.init,
    open: panel => self._setOpenState(panel, true),
    close: panel => self._setOpenState(panel, false),
    toggle: (panel, exclusive = true) => self._toggleOpenState(panel, exclusive),
    isOpen: self.isOpen,
    setEnabled: self.setEnabled,
    isEnabled: self.isEnabled
  };
})();
