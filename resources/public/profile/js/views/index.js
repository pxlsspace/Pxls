const ConfirmDialogStyles = Object.freeze({
  OK_CANCEL: 0,
  YES_NO: 1,
});

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

async function handleFactionAction(e) {
  const fid = this.closest('.faction-media[data-faction-id]').dataset.factionId;
  const action = this.dataset.action.toLowerCase().trim();
  if (!fid) return;
  console.debug(fid, action);
  switch(action) {
    case 'factiondelete': {
      if (await popConfirmDialog('Are you sure you want to delete this faction? This cannot be undone!') === true) {
        let res = await deleteJSON(`/factions/${fid}`);
        if (res && res.success === true) {
          alert('Faction deleted. The page will now reload.');
          document.location.href = document.location.href; //TODO replace with slidein
        } else {
          alert((res && res.details) || 'An unknown error occurred. Please try again later.');
        }
      }
      break;
    }
    case 'factionremovedisplayed': {
      if (await popConfirmDialog('Are you sure you want to remove this from your displayed status? It will no longer show up next to your name in chat.') === true) {
        let res = await putJSON(`/factions/${fid}`, {displayed: false});
        if (res && res.success === true) {
          alert('Status updated. The page will now reload.');
          document.location.href = document.location.href; //TODO replace with slidein
        } else {
          alert((res && res.details) || 'An unknown error occurred. Please try again later.');
        }
      }
      break;
    }
    case 'factionsetdisplayed': {
      if (await popConfirmDialog('Are you sure you want to set this as your displayed status? It will show up next to your name in chat.') === true) {
        let res = await putJSON(`/factions/${fid}`, {displayed: true});
        if (res && res.success === true) {
          alert('Status updated. The page will now reload.');
          document.location.href = document.location.href; //TODO replace with slidein
        } else {
          alert((res && res.details) || 'An unknown error occurred. Please try again later.');
        }
      }
      break;
    }
    case 'factionleave': {
      if (await popConfirmDialog('Are you sure you want to leave this faction? You will have to find it again in the factions list if you want to rejoin.') === true) {
        let res = await putJSON(`/factions/${fid}`, {joinState: false});
        if (res && res.success === true) {
          alert('Faction left. The page will now reload.');
          document.location.href = document.location.href; //TODO replace with slidein
        } else {
          alert((res && res.details) || 'An unknown error occurred. Please try again later.');
        }
      }
      break;
    }
  }
}

function handleGlobalFactionAction(e) {
  console.log(this.dataset.action);
  switch (this.dataset.action.toLowerCase().trim()) {
    case 'factioncreate': {
      const txtFactionName = crel('input', {'type': 'text', 'autocomplete': 'disabled', 'class': 'form-control', 'required': 'true'});
      const txtFactionTag = crel('input', {'type': 'text', 'autocomplete': 'disabled', 'class': 'form-control', 'maxLength': '4', 'required': 'true'});
      const btnCancel = crel('button', {'class': 'btn btn-secondary ml-1', 'data-dismiss': 'modal', 'type': 'button'}, 'Cancel');
      const btnSave = crel('button', {'class': 'btn btn-primary ml-1', 'type': 'submit'}, 'Create');
      const frmMain = crel('form', {'action': '#', 'method': 'POST'}, // abusing forms for required input checks
        crel('h5', {'class': 'mx-0 mt-0 mb-3'}, 'Faction Details'),
        crel('div', {'class': 'ml-3'},
          crel('div', {'class': 'input-group my-0'},
            crel('div', {'class': 'input-group-prepend'},
              crel('span', {'class': 'input-group-text'}, 'Faction Name:')
            ),
            txtFactionName
          ),
          crel('small', {'class': 'text-muted'}, 'The name of your faction will be displayed when your tag is hovered in chat.'),
          crel('div', {'class': 'input-group mt-3 mb-0'},
            crel('div', {'class': 'input-group-prepend'},
              crel('span', {'class': 'input-group-text'}, 'Faction Tag:')
            ),
            txtFactionTag
          ),
          crel('small', {'class': 'text-muted'}, 'Your tag is displayed next to your name in chat. Maximum of 4 characters.'),
          crel('div', {'class': 'mt-3 text-right'},
            btnCancel,
            btnSave
          )
        )
      );

      frmMain.addEventListener('submit', async function(e) {
        e.preventDefault();
        txtFactionName.disabled = true;
        txtFactionTag.disabled = true;
        btnCancel.disabled = true;
        btnSave.disabled = true;
        btnSave.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Working...`;

        try {
          let res = await postJSON('/factions', {name: txtFactionName.value, tag: txtFactionTag.value});
          console.debug('got res from faction creation: %o', res);
          if (res && res.success === true) {
            alert('Faction created. The page will now reload');
            document.location.href = document.location.href; //TODO replace with slideins
          } else {
            alert((res && res.details) || 'An error ocurred while creating the faction. Please try again later.');
            btnCancel.disabled = false;
            btnSave.innerHTML = `Create`;
          }
        } catch (e) {
          console.error('Failed to create faction', e);
        }
      });

      popModal(crel('div', {'class': 'modal', 'tabindex': '-1', 'data-backdrop': 'static', 'data-keyboard': 'false'},
        crel('div', {'class': 'modal-dialog'},
          crel('div', {'class': 'modal-content'},
            crel('div', {'class': 'modal-header'},
              crel('h5', {'class': 'modal-title'}, `Create Faction`)
            ),
            crel('div', {'class': 'modal-body'},
              frmMain
            )
          )
        )
      ), txtFactionName);
      break;
    }
    default: {
      console.warn('Unhandled global faction action: %o', this.dataset.action);
      break;
    }
  }
}

async function popConfirmDialog(text, style=ConfirmDialogStyles.YES_NO) {
  return new Promise(function(resolve) {
    const noButton = crel('button', {'class': 'btn btn-secondary', 'data-dismiss': 'modal'}, style === ConfirmDialogStyles.YES_NO ? 'No' : 'Cancel');
    const yesButton = crel('button', {'class': 'btn btn-primary', 'data-dismiss': 'modal'}, style === ConfirmDialogStyles.YES_NO ? 'Yes' : 'OK');
    noButton.addEventListener('click', () => resolve(false));
    yesButton.addEventListener('click', () => resolve(true));
    popModal(
      crel('div', {'class': 'modal', 'tabindex': '-1', 'role': 'dialog'},
        crel('div', {'class': 'modal-dialog', 'role': 'document'},
          crel('div', {'class': 'modal-content'},
            crel('div', {'class': 'modal-header'},
              crel('h5', {'class': 'modal-title'}, 'Confirmation')
            ),
            crel('div', {'class': 'modal-body'},
              crel('div',
                crel('p', text)
              )
            ),
            crel('div', {'class': 'modal-footer'},
              noButton,
              yesButton
            )
          )
        )
      )
    );
  });
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