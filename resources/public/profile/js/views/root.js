const ConfirmDialogStyles = Object.freeze({
  OK_CANCEL: 0,
  YES_NO: 1
});

(async () => {
  console.debug('%csocc dindu nuffin. probably.', 'font-size: 16px;background-color: #000; color: #000; padding: 5px;');

  $('[data-toggle="tooltip"]').tooltip();
  $('[data-toggle="popover"]').popover();

  // hook up collapseable card triggers
  Array.from(document.querySelectorAll('.collapseable')).forEach(elMain => {
    const collapseButton = elMain.querySelector('[data-action="collapse"]');
    if (collapseButton) {
      collapseButton.addEventListener('click', function() {
        handleCollapseIconToggle(this.closest('.collapseable').querySelector('.body-collapse-target'), this.querySelector('.fas'));
      });
    }
  });

  // ensure our current action is selected, and show slideins if necessary
  if (location.search) {
    const _search = location.search.substr(location.search.startsWith('?') ? 1 : 0).split('&').map(x => x.split('='));
    const action = _search.find(x => x[0].toLowerCase().trim() === 'action');
    if (Array.isArray(action) && action[1] != null) {
      Array.from(document.querySelectorAll('.tab-pane.active')).forEach(x => x.classList.remove('active'));
      Array.from(document.querySelectorAll('.list-group-item[data-action].active')).forEach(x => x.classList.remove('active'));
      const elPane = document.querySelector(`.tab-pane[data-tab="${action[1].toLowerCase()}"]`);
      const elAction = document.querySelector(`.list-group-item[data-action="${action[1].toLowerCase()}"]`);
      if (elPane && elAction) {
        elPane.classList.add('active');
        elAction.classList.add('active');
      }
    }

    const detailsIndex = _search.findIndex(x => x[0].toLowerCase().trim() === 'details');
    let _details = (Array.isArray(_search[detailsIndex]) && _search[detailsIndex][1] != null) ? _search[detailsIndex][1] : false;
    if (_details !== false) {
      _details = decodeURIComponent(_details).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      _search.splice(detailsIndex, 1);
    }

    const successIndex = _search.findIndex(x => x[0].toLowerCase().trim() === 'success');
    if (Array.isArray(_search[successIndex]) && _search[successIndex][1] != null) {
      const wasSuccessful = _search[successIndex][1] === '1';
      new SLIDEIN.Slidein(wasSuccessful ? `${_details === false ? 'Operation completed successfully.' : _details}` : `${_details === false ? 'Operation failed. No additional information was provided by the sever.' : _details}`, null, wasSuccessful ? SLIDEIN.SLIDEIN_TYPES.SUCCESS : SLIDEIN.SLIDEIN_TYPES.DANGER, true).show().closeAfter(5e3);

      _search.splice(successIndex, 1);
    }

    // update our search in the URL in case we added or removed elements
    history.replaceState(null, document.title, `${document.location.protocol}//${document.location.host}${document.location.pathname}?${_search.map(x => `${x[0]}=${x[1]}`).join('&')}${document.location.hash}`);
  }
})();

// eslint-disable-next-line no-unused-vars
function initInPageTabNavigation(page) {
  if (page.startsWith('/')) page = page.substr(1);
  document.querySelectorAll('#tabsTriggers a[data-action]').forEach(x => x.addEventListener('click', handleTabTrigger));

  function handleTabTrigger(e) {
    e.preventDefault();

    let oldTarget = document.querySelector('#tabsWrapper .tab-pane[data-tab].active');
    oldTarget = oldTarget ? (oldTarget.dataset.tab || false) : false;

    if (oldTarget === this.dataset.action) return;

    const targetTab = document.querySelector(`#tabsWrapper .tab-pane[data-tab="${this.dataset.action}"]`);
    if (!targetTab) return;

    history.replaceState(null, document.title, `/${page}?action=${this.dataset.action}`); // updates the URL in-place without triggering a navigation

    document.querySelectorAll('#tabsTriggers a[data-action].active').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#tabsWrapper .tab-pane[data-tab].active').forEach(el => el.classList.remove('active'));

    targetTab.classList.add('active');
    this.classList.add('active');
  }
}

// eslint-disable-next-line no-unused-vars
async function popConfirmDialog(text, style = ConfirmDialogStyles.YES_NO) {
  return new Promise(function(resolve) {
    const noButton = crel('button', { class: 'btn btn-secondary', 'data-dismiss': 'modal' }, style === ConfirmDialogStyles.YES_NO ? 'No' : 'Cancel');
    const yesButton = crel('button', { class: 'btn btn-primary', 'data-dismiss': 'modal' }, style === ConfirmDialogStyles.YES_NO ? 'Yes' : 'OK');
    noButton.addEventListener('click', () => resolve(false));
    yesButton.addEventListener('click', () => resolve(true));
    popModal(
      crel('div', { class: 'modal', tabindex: '-1', role: 'dialog' },
        crel('div', { class: 'modal-dialog', role: 'document' },
          crel('div', { class: 'modal-content' },
            crel('div', { class: 'modal-header' },
              crel('h5', { class: 'modal-title' }, 'Confirmation')
            ),
            crel('div', { class: 'modal-body' },
              crel('div',
                crel('p', text)
              )
            ),
            crel('div', { class: 'modal-footer' },
              noButton,
              yesButton
            )
          )
        )
      )
    );
  });
}

function handleCollapseIconToggle(colTarget, elIcon) {
  const wasCollapsed = colTarget.classList.contains('collapse') && !colTarget.classList.contains('show');
  elIcon.classList.toggle('fa-chevron-down', !wasCollapsed);
  elIcon.classList.toggle('fa-chevron-up', wasCollapsed); // update icons immediately so that they don't wait for the animation to complete
  $(colTarget).collapse('toggle').one(wasCollapsed ? 'shown.bs.collapse' : 'hidden.bs.collapse', function() { // bind to ensure we show the correct icon once collapse fires
    const isCollapsed = colTarget.classList.contains('collapse') && !colTarget.classList.contains('show');
    elIcon.classList.toggle('fa-chevron-down', isCollapsed);
    elIcon.classList.toggle('fa-chevron-up', !isCollapsed);
  });
}

function popModal(modalDom, focusInput) {
  $(modalDom).on('shown.bs.modal', () => focusInput && focusInput.focus && focusInput.focus()).on('hidden.bs.modal', () => $(modalDom).modal('dispose').remove()).modal({ keyboard: false, backdrop: 'static', focus: true, show: true });
}

// eslint-disable-next-line no-unused-vars
async function getJSON(url) {
  return _doGetLike(url, 'GET');
}

// eslint-disable-next-line no-unused-vars
async function deleteJSON(url, body = null) {
  if (body != null) {
    return _doPostLike(url, 'DELETE', body);
  } else {
    return _doGetLike(url, 'DELETE');
  }
}

// eslint-disable-next-line no-unused-vars
async function putJSON(url, data = {}) {
  return _doPostLike(url, 'PUT', data);
}

// eslint-disable-next-line no-unused-vars
async function postJSON(url, data = {}) {
  return _doPostLike(url, 'POST', data);
}

// eslint-disable-next-line no-unused-vars
async function patchJSON(url, data = {}) {
  return _doPostLike(url, 'PATCH', data);
}

async function _doGetLike(url, type) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
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
    const req = new XMLHttpRequest();
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

// eslint-disable-next-line no-unused-vars
function _reloadPageWithStatus(success, details = null) {
  const arr = [['success', (success) ? 1 : 0]];
  if (details != null) {
    arr.push(['details', encodeURIComponent(details)]);
  }
  let _search = document.location.search || '';
  _search += `${_search ? '&' : '?'}${arr.map(x => `${x[0]}=${x[1]}`).join('&')}`;
  document.location.href = `${document.location.protocol}//${document.location.host}${document.location.pathname}${_search}${document.location.hash}`;
}

// eslint-disable-next-line no-unused-vars
function _reloadPage() {
  document.location.href = document.location.href.substring(0, document.location.href.indexOf('#'));
}
