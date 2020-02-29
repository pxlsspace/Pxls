(() => {
  console.debug('spawned');

  document.querySelectorAll('#tabsTriggers a[data-action]').forEach(x => x.addEventListener('click', handleTabTrigger));
  if (location.search) {
    const _search = location.search.substr(location.search.startsWith('?') ? 1 : 0).split('&').map(x => x.split('='));
    let action = _search.find(x => x[0].toLowerCase().trim() === 'action');
    if (Array.isArray(action) && action[1] != null) {
      console.log(action[1]);
      Array.from(document.querySelectorAll('.tab-pane.active')).forEach(x => x.classList.remove('active'));
      Array.from(document.querySelectorAll('.list-group-item[data-action].active')).forEach(x => x.classList.remove('active'));
      let elPane = document.querySelector(`.tab-pane[data-tab="${action[1].toLowerCase()}"]`);
      let elAction = document.querySelector(`.list-group-item[data-action="${action[1].toLowerCase()}"]`);
      if (elPane && elAction) {
        elPane.classList.add('active');
        elAction.classList.add('active');
      }
    }
  }
  Array.from(document.querySelectorAll('.collapseable')).forEach(elMain => {
    const collapseButton = elMain.querySelector('[data-action="collapse"]');
    if (collapseButton) {
      collapseButton.addEventListener('click', function() {
        handleCollapseIconToggle(this.closest('.collapseable').querySelector('.body-collapse-target'), this.querySelector('.fas'));
      })
    }
  });
})();

function handleTabTrigger(e) {
  e.preventDefault();
  console.debug('[tab-nav] handling tab trigger %o (%o)', this.dataset.action, e);

  let oldTarget = document.querySelector(`#tabsWrapper .tab-pane[data-tab].active`);
  oldTarget = oldTarget ? (oldTarget.dataset.tab || false) : false;

  if (oldTarget === this.dataset.action) return console.debug('[tab-nav] user attempted to reactivate an already activated tab, aborting');

  const targetTab = document.querySelector(`#tabsWrapper .tab-pane[data-tab="${this.dataset.action}"]`);
  if (!targetTab) return console.error('Tried to set tab %o active but no associated tab-pane', this.dataset.action);

  window.history.replaceState(null, document.title, `/profile/view?action=${this.dataset.action}`); // updates the URL in-place without triggering a navigation

  document.querySelectorAll('#tabsTriggers a[data-action].active').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#tabsWrapper .tab-pane[data-tab].active').forEach(el => el.classList.remove('active'));

  targetTab.classList.add('active');
  this.classList.add('active');
}

function handleCollapseIconToggle(colTarget, elIcon) {
  let wasCollapsed = colTarget.classList.contains('collapse') && !colTarget.classList.contains('show');
  elIcon.classList.toggle('fa-chevron-down', !wasCollapsed);
  elIcon.classList.toggle('fa-chevron-up', wasCollapsed); //update icons immediately so that they don't wait for the animation to complete
  $(colTarget).collapse('toggle').one(wasCollapsed ? 'shown.bs.collapse' : 'hidden.bs.collapse', function() { //bind to ensure we show the correct icon once collapse fires
    let isCollapsed = colTarget.classList.contains('collapse') && !colTarget.classList.contains('show');
    elIcon.classList.toggle('fa-chevron-down', isCollapsed);
    elIcon.classList.toggle('fa-chevron-up', !isCollapsed);
  });
}