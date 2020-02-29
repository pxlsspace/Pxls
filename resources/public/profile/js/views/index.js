(() => {
  console.debug('spawned');

  // hook up in-page tab navigation
  document.querySelectorAll('#tabsTriggers a[data-action]').forEach(x => x.addEventListener('click', handleTabTrigger));

  // ensure our current action is selected
  if (location.search) {
    const _search = location.search.substr(location.search.startsWith('?') ? 1 : 0).split('&').map(x => x.split('='));
    let action = _search.find(x => x[0].toLowerCase().trim() === 'action');
    if (Array.isArray(action) && action[1] != null) {
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

  // hook up collapseable card triggers
  Array.from(document.querySelectorAll('.collapseable')).forEach(elMain => {
    const collapseButton = elMain.querySelector('[data-action="collapse"]');
    if (collapseButton) {
      collapseButton.addEventListener('click', function() {
        handleCollapseIconToggle(this.closest('.collapseable').querySelector('.body-collapse-target'), this.querySelector('.fas'));
      })
    }
  });

  // hook up global faction actions
  Array.from(document.querySelectorAll('.global-faction-action[data-action]')).forEach(elAction => elAction.addEventListener('click', handleGlobalFactionAction));

  // hook up faction membership actions
  Array.from(document.querySelectorAll('.faction-media[data-faction-id] .faction-action[data-action]')).forEach(elAction => elAction.addEventListener('click', handleFactionAction));
})();

function handleFactionAction(e) {
  console.log(this.closest('.faction-media[data-faction-id]').dataset.factionId, this.dataset.action);
}

function handleGlobalFactionAction(e) {
  console.log(this.dataset.action);
}

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

function popModal(modalDom, focusInput) {
  $(modalDom).on('shown.bs.modal', () => focusInput && focusInput.focus && focusInput.focus()).on('hidden.bs.modal', () => $(modalDom).modal('dispose').remove()).modal({keyboard: false, backdrop: 'static', focus: true, show: true});
}

async function getJSON(url) {
  return _doGetLike(url, 'GET');
}

async function deleteJSON(url, body = null) {
  if (body != null) {
    return _doPostLike(url, 'DELETE', body);
  } else {
    return _doGetLike(url, 'DELETE');
  }
}

async function putJSON(url, data = {}) {
  return _doPostLike(url, 'PUT', data);
}

async function postJSON(url, data = {}) {
  return _doPostLike(url, 'POST', data);
}

async function patchJSON(url, data = {}) {
  return _doPostLike(url, 'PATCH', data);
}

async function _doGetLike(url, type) {
  return new Promise((resolve, reject) => {
    let req = new XMLHttpRequest();
    req.onload = function() {
      try {
        resolve(JSON.parse(this.responseText));
      } catch (e) {
        reject(e);
      }
    };
    req.onerror = reject;
    req.open(type.trim().toUpperCase(), url);
    req.setRequestHeader('Accept', 'application/json;q=1.0, */*;q=0.5');
    req.send();
  });
}

async function _doPostLike(url, type, data = {}) {
  return new Promise((resolve, reject) => {
    let req = new XMLHttpRequest();
    req.onload = function() {
      try {
        resolve(JSON.parse(this.responseText));
      } catch (e) {
        reject(e);
      }
    };
    req.onerror = reject;
    req.open(type.toUpperCase().trim(), url);
    req.setRequestHeader('Content-Type', 'application/json');
    req.setRequestHeader('Accept', 'application/json;q=1.0, */*;q=0.5');
    req.send(JSON.stringify(data));
  });
}