/* globals
  DEFAULT_SPECTRUM_OPTIONS,
  initInPageTabNavigation,
  handleCollapseIconToggle,
  _reloadPageWithStatus,
  popConfirmDialog,
  popModal,
  getJSON,
  putJSON,
  deleteJSON,
  postJSON
 */
window.DEFAULT_SPECTRUM_OPTIONS = window.DEFAULT_SPECTRUM_OPTIONS || {
  showInput: true,
  clickoutFiresChange: true,
  flat: false,
  allowEmpty: false,
  showAlpha: false,
  disabled: false,
  showPalette: true,
  showPaletteOnly: false,
  preferredFormat: 'hex',
  theme: 'sp-purple'
};

(() => {
  // hook up in-page tab navigation
  initInPageTabNavigation(document.location.pathname);

  // hook up global faction actions
  Array.from(document.querySelectorAll('.global-faction-action[data-action]')).forEach(elAction => elAction.addEventListener('click', handleGlobalFactionAction));

  // hook up faction membership actions
  Array.from(document.querySelectorAll('.faction-media[data-faction-id] .faction-action[data-action]')).forEach(elAction => elAction.addEventListener('click', handleFactionAction));
  Array.from(document.querySelectorAll('.member-list-modal[data-faction-id] .member-row[data-member] .faction-subaction[data-action]')).forEach(elAction => elAction.addEventListener('click', handleFactionSubaction));

  // hook up faction search/join interaction
  initFactionSearch();

  // hook up log key copy interaction
  Array.from(document.querySelectorAll('[data-action="copy-log-key"]')).forEach(elAction => elAction.addEventListener('click', e => handleCopyLogKey(e, elAction)));

  // hook up any existing color inputs if available
  if ($ && $.spectrum) {
    if (document.body.dataset.palette) { DEFAULT_SPECTRUM_OPTIONS.palette = document.body.dataset.palette.trim().split(','); }

    $('input[type="color"]').spectrum(DEFAULT_SPECTRUM_OPTIONS);
  }
})();

async function initFactionSearch() {
  const frmSearch = document.getElementById('frmFactionSearch');
  const txtSearch = document.getElementById('txtFactionSearch');
  const btnSearch = document.getElementById('btnFactionSearch');
  const searchTarget = document.getElementById('searchTarget');
  const btnLoadMore = document.getElementById('btnFactionSearchLoadMore');
  if (frmSearch && txtSearch && btnSearch && searchTarget && btnLoadMore) {
    let offset = 0;
    let lastQuery;
    const handleSearch = async function(e) {
      if (e) { e.preventDefault(); } else if (typeof frmSearch.reportValidity === 'function' && !frmSearch.reportValidity()) { return; }

      const oldHtml = btnSearch.innerHTML;
      btnSearch.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>';
      btnSearch.disabled = true;
      txtSearch.disabled = true;
      const curQuery = txtSearch.value.toLowerCase().trim();
      let res;
      try {
        if (curQuery !== lastQuery) { offset = 0; }
        res = await getJSON(`/factions/search?term=${encodeURIComponent(txtSearch.value)}&after=${offset}`);
      } catch (e) {}
      if (res && res.success === true) {
        if (Array.isArray(res.details)) {
          if (res.details.length > 0) {
            if (offset === 0) { searchTarget.innerHTML = ''; }
            btnLoadMore.classList.toggle('d-none', res.details.length !== 50);
            offset += res.details.length;
            crel(searchTarget,
              res.details.map(x => {
                const btnCollapseToggle = crel('button', { class: 'btn btn-sm mr-2 btn-info', 'data-action': 'collapse' },
                  crel('i', { class: 'fas fa-chevron-down' })
                );
                const btnJoin = crel('button', { class: 'btn btn-sm btn-success ml-1' },
                  crel('i', { class: 'fas fa-user-plus mr-1' }),
                  x.userJoined === true ? 'Already Joined' : 'Join'
                );
                btnJoin.disabled = x.userJoined === true;

                const card = crel('div', { class: 'card collapseable mb-2' },
                  crel('div', { class: 'card-header d-flex align-items-center' },
                    crel('div', { class: 'flex-shrink-1' },
                      btnCollapseToggle
                    ),
                    crel('div', { class: 'd-flex flex-grow-1 justify-content-between align-items-center' },
                      crel('span', { class: 'faction-name' }, `(ID: ${x.id}) [${x.tag}] ${x.name}, from ${x.owner}`),
                      crel('div', { class: 'd-inline-block' },
                        btnJoin
                      )
                    )
                  ),
                  crel('div', { class: 'card-body p-0 body-collapse-target collapse' },
                    crel('div', { class: 'p-3' },
                      crel('table',
                        crel('tbody',
                          crel('tr',
                            crel('th', { class: 'text-right pr-3' }, 'ID'),
                            crel('td', { class: 'text-left' }, x.id)
                          ),
                          crel('tr',
                            crel('th', { class: 'text-right pr-3' }, 'Name'),
                            crel('td', { class: 'text-left' }, x.name)
                          ),
                          crel('tr',
                            crel('th', { class: 'text-right pr-3' }, 'Tag'),
                            crel('td', { class: 'text-left' }, x.tag)
                          ),
                          crel('tr',
                            crel('th', { class: 'text-right pr-3' }, 'Owner'),
                            crel('td', { class: 'text-left' }, crel('a', { href: `/profile/${x.owner}`, target: '_blank' }, x.owner))
                          ),
                          crel('tr',
                            crel('th', { class: 'text-right pr-3' }, 'Member Count'),
                            crel('td', { class: 'text-left' }, x.memberCount || -1)
                          ),
                          crel('tr',
                            crel('th', { class: 'text-right pr-3' }, 'Created Date'),
                            crel('td', { class: 'text-left' }, new Date(x.creation_ms).toString())
                          ),
                          crel('tr',
                            crel('th', { class: 'text-right pr-3' }, 'Created Canvas'),
                            crel('td', { class: 'text-left' }, x.canvasCode)
                          )
                        )
                      )
                    )
                  )
                );
                btnCollapseToggle.addEventListener('click', function() {
                  handleCollapseIconToggle(card.querySelector('.body-collapse-target'), this.querySelector('.fas'));
                });
                btnJoin.addEventListener('click', async function() {
                  if (await popConfirmDialog('Are you sure you want to join this faction?') === true) {
                    let res;
                    try {
                      res = await putJSON(`/factions/${x.id}`, { joinState: true });
                    } catch (e) {}
                    if (res && res.success === true) {
                      _reloadPageWithStatus(true, 'Faction Joined');
                    } else {
                      new SLIDEIN.Slidein((res && res.details) || 'An unknown error occurred. Please try again later.', null, SLIDEIN.SLIDEIN_TYPES.DANGER).show().closeAfter(10e3);
                    }
                  }
                });
                return card;
              })
            );
          } else {
            if (offset === 0) {
              searchTarget.innerHTML = '<p class="text-muted text-center">No results for this search term.</p>';
            } else {
              if (btnLoadMore) { btnLoadMore.disabled = true; }
            }
          }
        }
      } else {
        alert((res && res.details) || 'An unknown error occurred. Please try again later.');
      }
      lastQuery = curQuery;
      btnSearch.innerHTML = oldHtml;
      btnSearch.disabled = false;
      txtSearch.disabled = false;
    };
    frmSearch.addEventListener('submit', handleSearch);
    btnLoadMore.addEventListener('click', () => handleSearch());
  }
}

async function handleFactionAction() {
  const fmedia = this.closest('.faction-media[data-faction-id]');
  const fid = fmedia.dataset.factionId;
  const action = this.dataset.action.toLowerCase().trim();
  if (!fid) return;
  switch (action) {
    case 'factiondelete': {
      if (await popConfirmDialog('Are you sure you want to delete this faction? This cannot be undone!') === true) {
        let res;
        try {
          res = await deleteJSON(`/factions/${fid}`);
        } catch (e) {}
        if (res && res.success === true) {
          _reloadPageWithStatus(true, 'Faction Deleted');
        } else {
          new SLIDEIN.Slidein((res && res.details) || 'An unknown error occurred. Please try again later.', null, SLIDEIN.SLIDEIN_TYPES.DANGER).show().closeAfter(10e3);
        }
      }
      break;
    }
    case 'factionremovedisplayed': {
      if (await popConfirmDialog('Are you sure you want to remove this from your displayed status? It will no longer show up next to your name in chat.') === true) {
        let res;
        try {
          res = await putJSON(`/factions/${fid}`, { displayed: false });
        } catch (e) {}
        if (res && res.success === true) {
          _reloadPageWithStatus(true, 'Displayed faction updated');
        } else {
          new SLIDEIN.Slidein((res && res.details) || 'An unknown error occurred. Please try again later.', null, SLIDEIN.SLIDEIN_TYPES.DANGER).show().closeAfter(10e3);
        }
      }
      break;
    }
    case 'factionsetdisplayed': {
      if (await popConfirmDialog('Are you sure you want to set this as your displayed status? It will show up next to your name in chat.') === true) {
        let res;
        try {
          res = await putJSON(`/factions/${fid}`, { displayed: true });
        } catch (e) {}
        if (res && res.success === true) {
          _reloadPageWithStatus(true, 'Displayed faction updated');
        } else {
          new SLIDEIN.Slidein((res && res.details) || 'An unknown error occurred. Please try again later.', null, SLIDEIN.SLIDEIN_TYPES.DANGER).show().closeAfter(10e3);
        }
      }
      break;
    }
    case 'factionleave': {
      if (await popConfirmDialog('Are you sure you want to leave this faction? You will have to find it again in the factions list if you want to rejoin.') === true) {
        let res;
        try {
          res = await putJSON(`/factions/${fid}`, { joinState: false });
        } catch (e) {}
        if (res && res.success === true) {
          _reloadPageWithStatus(true, 'Left Faction');
        } else {
          new SLIDEIN.Slidein((res && res.details) || 'An unknown error occurred. Please try again later.', null, SLIDEIN.SLIDEIN_TYPES.DANGER).show().closeAfter(10e3);
        }
      }
      break;
    }
    case 'factionedit': {
      popFactionModal(true, { name: fmedia.dataset.factionName, tag: fmedia.dataset.factionTag, color: fmedia.dataset.factionColor >> 0, fid });
      break;
    }
  }
}

async function handleFactionSubaction() {
  const fid = this.closest('[data-faction-id]').dataset.factionId;
  const action = this.dataset.action.toLowerCase().trim();
  const member = this.closest('[data-member]').dataset.member;
  if (!fid || !action || !member) return;
  switch (action) {
    case 'transfer': {
      if (await popConfirmDialog(`Are you sure you want to transfer ownership? You'll have to ask ${member} to transfer back if you change your mind, and they can say no!`) === true) {
        let res;
        try {
          res = await putJSON(`/factions/${fid}`, { newOwner: member });
        } catch (e) {}
        if (res && res.success === true) {
          _reloadPageWithStatus(true, 'Faction ownership transfered');
        } else {
          new SLIDEIN.Slidein((res && res.details) || 'An unknown error occurred. Please try again later.', null, SLIDEIN.SLIDEIN_TYPES.DANGER).show().closeAfter(10e3);
        }
      }
      break;
    }
    case 'ban': {
      if (await popConfirmDialog(`Are you sure you want to ban ${member}?`) === true) {
        let res;
        try {
          res = await putJSON(`/factions/${fid}`, { user: member, banState: true });
        } catch (e) {}
        if (res && res.success === true) {
          _reloadPageWithStatus(true, `${member} has been banned from the faction`);
        } else {
          new SLIDEIN.Slidein((res && res.details) || 'An unknown error occurred. Please try again later.', null, SLIDEIN.SLIDEIN_TYPES.DANGER).show().closeAfter(10e3);
        }
      }
      break;
    }
    case 'unban': {
      if (await popConfirmDialog(`Are you sure you want to unban ${member}?`) === true) {
        let res;
        try {
          res = await putJSON(`/factions/${fid}`, { user: member, banState: false });
        } catch (e) {}
        if (res && res.success === true) {
          _reloadPageWithStatus(true, `${member} was unbanned from the faction`);
        } else {
          new SLIDEIN.Slidein((res && res.details) || 'An unknown error occurred. Please try again later.', null, SLIDEIN.SLIDEIN_TYPES.DANGER).show().closeAfter(10e3);
        }
      }
      break;
    }
  }
}

function popFactionModal(isEdit = false, data = {}) {
  if (isEdit && data.fid == null) throw new Error('Invalid data supplied to popFactionModal. Missing fid');
  const _nameMax = document.body.dataset.factionMaxName || 99999;
  const _tagMax = document.body.dataset.factionMaxTag || 99999;

  const txtFactionName = crel('input', { type: 'text', autocomplete: 'disabled', class: 'form-control', maxLength: _nameMax, required: 'true', value: data.name || '' });
  const txtFactionTag = crel('input', { type: 'text', autocomplete: 'disabled', class: 'form-control', maxLength: _tagMax, required: 'true', value: data.tag || '' });
  const txtFactionColor = crel('input', { type: 'color', autocomplete: 'disabled', class: 'form-control', required: 'true', value: isEdit ? intToHex(data.color >> 0) : '#000000' });
  const btnCancel = crel('button', { class: 'btn btn-secondary ml-1', 'data-dismiss': 'modal', type: 'button' }, 'Cancel');
  const btnSave = crel('button', { class: 'btn btn-primary ml-1', type: 'submit' }, isEdit ? 'Update' : 'Create');
  const frmMain = crel('form', { action: '#', method: 'POST' }, // abusing forms for required input checks
    crel('h5', { class: 'mx-0 mt-0 mb-3' }, 'Faction Details'),
    crel('div', { class: 'ml-3' },
      crel('div', { class: 'input-group my-0' },
        crel('div', { class: 'input-group-prepend' },
          crel('span', { class: 'input-group-text' }, 'Faction Name:')
        ),
        txtFactionName
      ),
      crel('small', { class: 'text-muted' }, `The name of your faction will be displayed when your tag is hovered in chat. Maximum of ${_nameMax} characters.`),
      crel('div', { class: 'input-group mt-3 mb-0' },
        crel('div', { class: 'input-group-prepend' },
          crel('span', { class: 'input-group-text' }, 'Faction Tag:')
        ),
        txtFactionTag
      ),
      crel('small', { class: 'text-muted' }, `Your tag is displayed next to your name in chat. Maximum of ${_tagMax} characters.`),
      crel('div', { class: 'input-group mt-3 mb-0' },
        crel('div', { class: 'input-group-prepend' },
          crel('span', { class: 'input-group-text' }, 'Faction Color:')
        ),
        txtFactionColor
      ),
      crel('small', { class: 'text-muted' }, 'Your faction color changes your tag color in chat.'),
      crel('div', { class: 'mt-3 text-right' },
        btnCancel,
        btnSave
      )
    )
  );

  if ($.spectrum) {
    $(txtFactionColor).spectrum(DEFAULT_SPECTRUM_OPTIONS);
  }

  frmMain.addEventListener('submit', async function(e) {
    e.preventDefault();
    const oldHtml = btnSave.innerHTML;
    txtFactionName.disabled = true;
    txtFactionTag.disabled = true;
    btnCancel.disabled = true;
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Working...';

    try {
      const endpoint = isEdit ? `/factions/${data.fid}` : '/factions';
      const _toPost = { name: txtFactionName.value, tag: txtFactionTag.value, color: parseInt(txtFactionColor.value.substring(1), 16) };
      let res;
      try {
        res = await (isEdit ? putJSON : postJSON)(endpoint, _toPost);
      } catch (e) {}
      if (res && res.success === true) {
        _reloadPageWithStatus(true, `Faction ${isEdit ? 'edit' : 'creat'}ed`);
      } else {
        new SLIDEIN.Slidein((res && res.details) || 'An unknown error occurred. Please try again later.', null, SLIDEIN.SLIDEIN_TYPES.DANGER).show().closeAfter(10e3);
        btnCancel.disabled = false;
        btnSave.innerHTML = 'Create';
      }
    } catch (e) {} finally {
      txtFactionName.disabled = false;
      txtFactionTag.disabled = false;
      btnCancel.disabled = false;
      btnSave.disabled = false;
      btnSave.innerHTML = oldHtml;
    }
  });

  popModal(crel('div', { class: 'modal', 'data-backdrop': 'static', 'data-keyboard': 'false' }, // tabindex is interfering with the color picker's inputs. see https://github.com/bgrins/spectrum/issues/161#issuecomment-118562439
    crel('div', { class: 'modal-dialog' },
      crel('div', { class: 'modal-content' },
        crel('div', { class: 'modal-header' },
          crel('h5', { class: 'modal-title' }, `${isEdit ? 'Edit' : 'Create'} Faction`)
        ),
        crel('div', { class: 'modal-body' },
          frmMain
        )
      )
    )
  ), txtFactionName);
}

function handleGlobalFactionAction(e) {
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

function handleCopyLogKey(e, elAction) {
  e.preventDefault();
  const btnCopy = elAction;
  const btnIcon = btnCopy.querySelector('i');
  const logKey = btnCopy.parentNode.parentNode.querySelector('code').innerText;

  navigator.clipboard.writeText(logKey).then(() => {
    // Primary -> Success
    btnCopy.classList.remove('btn-primary');
    btnCopy.classList.add('btn-success');
    // Clipboard List -> Check
    btnIcon.classList.remove('fa-clipboard-list');
    btnIcon.classList.add('fa-clipboard-check');
    setTimeout(() => {
      // Success -> Primary
      btnCopy.classList.remove('btn-success');
      btnCopy.classList.add('btn-primary');
      // Clipboard Check -> List
      btnIcon.classList.remove('fa-clipboard-check');
      btnIcon.classList.add('fa-clipboard-list');
    }, 1500);
  }, err => {
    console.error('Failed to copy log key');
    console.trace(err);
    // Primary -> Danger
    btnCopy.classList.remove('btn-primary');
    btnCopy.classList.add('btn-danger');
    // Clipboard List -> Blank
    btnIcon.classList.remove('fa-clipboard-list');
    btnIcon.classList.add('fa-clipboard');
    setTimeout(() => {
      // Danger -> Primary
      btnCopy.classList.remove('btn-danger');
      btnCopy.classList.add('btn-primary');
      // Clipboard Blank -> List
      btnIcon.classList.remove('fa-clipboard');
      btnIcon.classList.add('fa-clipboard-list');
    }, 1500);
  });
}

function intToHex(int) {
  return `#${('000000' + ((int) >>> 0).toString(16)).slice(-6)}`;
}
