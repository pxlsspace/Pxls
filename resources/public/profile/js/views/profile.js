(() => {
  console.debug('spawned');

  // hook up in-page tab navigation
  // document.querySelectorAll('#tabsTriggers a[data-action]').forEach(x => x.addEventListener('click', handleTabTrigger));
  initInPageTabNavigation(document.location.pathname);

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

  // hook up global faction actions
  Array.from(document.querySelectorAll('.global-faction-action[data-action]')).forEach(elAction => elAction.addEventListener('click', handleGlobalFactionAction));

  // hook up faction membership actions
  Array.from(document.querySelectorAll('.faction-media[data-faction-id] .faction-action[data-action]')).forEach(elAction => elAction.addEventListener('click', handleFactionAction));

  Array.from(document.querySelectorAll('.member-list-modal[data-faction-id] .member-row[data-member] .faction-subaction[data-action]')).forEach(elAction => elAction.addEventListener('click', handleFactionSubaction));
})();

async function handleFactionAction(e) {
  const fmedia = this.closest('.faction-media[data-faction-id]');
  const fid = fmedia.dataset.factionId;
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
    case 'factionedit': {
      popFactionModal(true, {name: fmedia.dataset.factionName, tag: fmedia.dataset.factionTag, fid});
      break;
    }
  }
}

async function handleFactionSubaction(e) {
  const fid = this.closest('[data-faction-id]').dataset.factionId;
  const action = this.dataset.action.toLowerCase().trim();
  const member = this.closest('[data-member]').dataset.member;
  if (!fid || !action || !member) return;
  console.debug(fid, member, action);
  switch(action) {
    case 'transfer': {
      if (await popConfirmDialog(`Are you sure you want to transfer ownership? You'll have to ask ${member} to transfer back if you change your mind, and they can say no!`) === true) {
        console.debug('handling %s on member %s and faction %s', action, member, fid);
        let res;
        try {
          res = await putJSON(`/factions/${fid}`, {newOwner: member});
        } catch (e) {}
        if (res && res.success === true) {
          alert('Faction updated. The page will now reload.');
          document.location.href = document.location.href; //TODO replace with slidein
        } else {
          alert((res && res.details) || 'An unknown error occurred. Please try again later.');
        }
      }
      break;
    }
    case 'ban': {
      if (await popConfirmDialog(`Are you sure you want to ban ${member}?`) === true) {
        console.debug('handling %s on member %s and faction %s', action, member, fid);
        let res;
        try {
          res = await putJSON(`/factions/${fid}`, {user: member, banState: true});
        } catch (e) {}
        if (res && res.success === true) {
          alert('Faction updated. The page will now reload.');
          document.location.href = document.location.href; //TODO replace with slidein
        } else {
          alert((res && res.details) || 'An unknown error occurred. Please try again later.');
        }
      }
      break;
    }
    case 'unban': {
      if (await popConfirmDialog(`Are you sure you want to unban ${member}?`) === true) {
        console.debug('handling %s on member %s and faction %s', action, member, fid);
        let res;
        try {
          res = await putJSON(`/factions/${fid}`, {user: member, banState: false});
        } catch (e) {}
        if (res && res.success === true) {
          alert('Faction updated. The page will now reload.');
          document.location.href = document.location.href; //TODO replace with slidein
        } else {
          alert((res && res.details) || 'An unknown error occurred. Please try again later.');
        }
      }
      break;
    }
  }
}

function popFactionModal(isEdit=false,data={}) {
  if (isEdit && data.fid == null) throw new Error('Invalid data supplied to popFactionModal. Missing fid');

  const txtFactionName = crel('input', {'type': 'text', 'autocomplete': 'disabled', 'class': 'form-control', 'required': 'true', 'value': data.name || ''});
  const txtFactionTag = crel('input', {'type': 'text', 'autocomplete': 'disabled', 'class': 'form-control', 'maxLength': '4', 'required': 'true', 'value': data.tag || ''});
  const btnCancel = crel('button', {'class': 'btn btn-secondary ml-1', 'data-dismiss': 'modal', 'type': 'button'}, 'Cancel');
  const btnSave = crel('button', {'class': 'btn btn-primary ml-1', 'type': 'submit'}, isEdit ? 'Update' : 'Create');
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
      let endpoint = isEdit ? `/factions/${data.fid}` : `/factions`;
      let _toPost = {name: txtFactionName.value, tag: txtFactionTag.value};
      let res = await (isEdit ? putJSON : postJSON)(endpoint, _toPost);
      console.debug('got res from faction op: %o', res);
      if (res && res.success === true) {
        alert(`Faction ${isEdit ? 'edit' : 'creat'}ed. The page will now reload`);
        document.location.href = document.location.href; //TODO replace with slideins
      } else {
        alert((res && res.details) || `An error ocurred while ${isEdit ? 'edit' : 'creat'}ing the faction. Please try again later.`);
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
}

function handleGlobalFactionAction(e) {
  console.log(this.dataset.action);
  switch (this.dataset.action.toLowerCase().trim()) {
    case 'factioncreate': {
      popFactionModal();
      break;
    }
    default: {
      console.warn('Unhandled global faction action: %o', this.dataset.action);
      break;
    }
  }
}