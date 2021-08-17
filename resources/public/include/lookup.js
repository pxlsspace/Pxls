const { modal } = require('./modal');
const { settings } = require('./settings');
const { user } = require('./user');
const { template } = require('./template');
const { chat } = require('./chat');
const { coords } = require('./coords');
let board;

// this is the user lookup helper
module.exports.lookup = (function() {
  const self = {
    elements: {
      lookup: $('#lookup'),
      prompt: $('#prompt')
    },
    handle: null,
    report: function(id, x, y) {
      const reportButton = crel('button', { class: 'text-button dangerous-button' }, __('Report'));
      reportButton.addEventListener('click', function() {
        this.disabled = true;
        this.textContent = __('Sending...');

        const selectedRule = this.closest('.modal').querySelector('select').value;
        const textarea = this.closest('.modal').querySelector('textarea').value.trim();
        let msg = selectedRule;
        if (selectedRule === 'other') {
          if (textarea === '') {
            modal.showText(__('You must specify the details.'));
            return;
          }
          msg = textarea;
        } else if (textarea !== '') {
          msg += `; ${__('additional information:')} ' ${textarea}`;
        }
        $.post('/report', {
          id: id,
          x: x,
          y: y,
          message: msg
        }, function() {
          modal.showText(__('Sent report!'));
          self.elements.prompt.hide();
          self.elements.lookup.hide();
        }).fail(function() {
          modal.showText(__('Error sending report.'));
        });
      });
      modal.show(modal.buildDom(
        crel('h2', { class: 'modal-title' }, __('Report Pixel')),
        crel('div',
          crel('select', { style: 'width: 100%; margin-bottom: 1em;' },
            crel('option', __('Rule #1: Hateful/derogatory speech or symbols')),
            crel('option', __('Rule #2: Nudity, genitalia, or non-PG-13 content')),
            crel('option', __('Rule #3: Multi-account')),
            crel('option', __('Rule #4: Botting')),
            crel('option', { value: 'other' }, __('Other (specify below)'))
          ),
          crel('textarea', {
            placeholder: __('Additional information (if applicable)'),
            style: 'width: 100%; height: 5em',
            onkeydown: e => e.stopPropagation()
          }),
          crel('div', { class: 'buttons' },
            crel('button', { class: 'text-button', onclick: () => modal.closeAll() }, __('Cancel')),
            reportButton
          )
        )
      ));
    },
    /**
       * All lookup hooks.
       */
    hooks: [],
    /**
       * Registers hooks.
       * @param {...Object} hooks Information about the hook.
       * @param {String} hooks.id An ID for the hook.
       * @param {String} hooks.name A user-facing name for the hook.
       * @param {Boolean} hooks.sensitive Whenever the hook contains sensitive information.
       * @param {Boolean} hooks.backgroundCompatible Whenever the hook should appear even if the pixel is background.
       * @param {Function} hooks.get A function that returns the text information shown in the lookup.
       * @param {Object} hooks.css An object mapping CSS rules to values for the hook value.
       */
    registerHook: function(...hooks) {
      return self.hooks.push(...$.map(hooks, function(hook) {
        return {
          id: hook.id || 'hook',
          name: hook.name || 'Hook',
          sensitive: hook.sensitive || false,
          backgroundCompatible: hook.backgroundCompatible || false,
          get: hook.get || function() {
          },
          css: hook.css || {}
        };
      }));
    },
    /**
       * Replace a hook by its ID.
       * @param {String} hookId The ID of the hook to replace.
       * @param {Object} newHook Information about the hook.
       * @param {String} newHook.name New user-facing name for the hook.
       * @param {Boolean} newHook.sensitive Whenever the new hook contains sensitive information.
       * @param {Boolean} newHook.backgroundCompatible Whenever the new hook should appear even if the pixel is background.
       * @param {Function} newHook.get A function that returns the text information shown in the lookup.
       * @param {Object} newHook.css An object mapping CSS rules to values for the new hook value.
       */
    replaceHook: function(hookId, newHook) {
      delete newHook.id;
      for (const idx in self.hooks) {
        const hook = self.hooks[idx];
        if (hook.id === hookId) {
          self.hooks[idx] = Object.assign(hook, newHook);
          return;
        }
      }
    },
    /**
       * Unregisters a hook by its ID.
       * @param {string} hookId The ID of the hook to unregister.
       */
    unregisterHook: function(hookId) {
      self.hooks = $.grep(self.hooks, function(hook) {
        return hook.id !== hookId;
      });
    },
    create: function(data) {
      const sensitiveElems = [];
      self._makeShell(data).find('.content').first().append(() => {
        if (!data.bg) {
          return '';
        }

        return $('<p>').text(__('This pixel is background (was not placed by a user).'));
      }).append(() => {
        const hooks = data.bg
          ? self.hooks.filter((hook) => hook.backgroundCompatible)
          : self.hooks;

        return $.map(hooks, (hook) => {
          const get = hook.get(data);
          if (get == null) {
            return null;
          }

          const value = typeof get === 'object'
            ? (get instanceof Node ? $(get) : get)
            : $('<span>').text(get);

          const _retVal = $('<div data-sensitive="' + hook.sensitive + '">').append(
            $('<b>').text(hook.name + ': '),
            value.css(hook.css)
          ).attr('id', 'lookuphook_' + hook.id);
          if (hook.sensitive) {
            sensitiveElems.push(_retVal);
            if (settings.lookup.filter.sensitive.enable.get()) {
              _retVal.css('display', 'none');
            }
          }
          return _retVal;
        });
      }).append(() => {
        if (data.bg || sensitiveElems.length < 1) {
          return '';
        }

        const label = $('<label>');
        const checkbox = $('<input type="checkbox">').css('margin-top', '10px');
        const span = $('<span class="label-text">').text(__('Hide sensitive information'));
        label.prepend(checkbox, span);
        settings.lookup.filter.sensitive.enable.controls.add(checkbox);
        return label;
      });
      self.elements.lookup.fadeIn(200);
    },
    _makeShell: function(data) {
      return self.elements.lookup.empty().append(
        $('<div>').addClass('content'),
        (!data.bg && user.isLoggedIn()
          ? $('<button>').css('float', 'left').addClass('dangerous-button text-button').text(__('Report')).click(function() {
            self.report(data.id, data.x, data.y);
          })
          : ''),
        $('<button>').css('float', 'right').addClass('text-button').text(__('Close')).click(function() {
          self.elements.lookup.fadeOut(200);
        }),
        (template.getOptions().use ? $('<button>').css('float', 'right').addClass('text-button').text(__('Move Template Here')).click(function() {
          template.queueUpdate({
            ox: data.x,
            oy: data.y
          });
        }) : '')
      );
    },
    runLookup(clientX, clientY) {
      const pos = board.fromScreen(clientX, clientY);
      $.get('/lookup', pos, function(data) {
        data = data || { x: pos.x, y: pos.y, bg: true };
        if (data && data.username && chat.typeahead.helper) {
          chat.typeahead.helper.getDatabase('users').addEntry(data.username, data.username);
        }
        if (self.handle) {
          self.handle(data);
        } else {
          self.create(data);
        }
      }).fail(function() {
        self._makeShell({ x: pos.x, y: pos.y }).find('.content').first().append($('<p>').css('color', '#c00').text(__("An error occurred, either you aren't logged in or you may be attempting to look up users too fast. Please try again in 60 seconds")));
        self.elements.lookup.fadeIn(200);
      });
    },
    init: function() {
      board = require('./board').board;

      // Register default hooks
      self.registerHook(
        {
          id: 'coords',
          name: __('Coords'),
          get: data => $('<a>').text('(' + data.x + ', ' + data.y + ')').attr('href', coords.getLinkToCoords(data.x, data.y)),
          backgroundCompatible: true
        }, {
          id: 'username',
          name: __('Username'),
          get: data => data.username
            ? !board.snipMode
              ? crel('a', {
                href: `/profile/${data.username}`,
                target: '_blank',
                title: __('View Profile')
              }, data.username)
              : data.username
            : null
        }, {
          id: 'faction',
          name: __('Faction'),
          get: data => data.faction || null
        }, {
          id: 'origin',
          name: __('Origin'),
          get: data => {
            switch (data.origin) {
              case 'nuke':
                return __('Part of a nuke');
              case 'mod':
                return __('Placed by a staff member using placement overrides');
              default:
                return null;
            }
          }
        }, {
          id: 'time',
          name: __('Time'),
          get: data => {
            const delta = ((new Date()).getTime() - data.time) / 1000;
            const stamp = (new Date(data.time)).toLocaleString();

            const span = $('<span>');
            span.attr('title', stamp);

            if (delta > 24 * 3600) {
              return span.text(stamp);
            } else if (delta < 5) {
              return span.text(__('just now'));
            } else {
              const secs = Math.floor(delta % 60);
              const secsStr = secs < 10 ? '0' + secs : secs;
              const minutes = Math.floor((delta / 60)) % 60;
              const minuteStr = minutes < 10 ? '0' + minutes : minutes;
              const hours = Math.floor(delta / 3600);
              const hoursStr = hours < 10 ? '0' + hours : hours;
              return span.text(__(`${hoursStr}:${minuteStr}:${secsStr} ago`));
            }
          }
        }, {
          id: 'pixels',
          name: __('Pixels'),
          get: data => data.pixelCount
        }, {
          id: 'pixels_alltime',
          name: __('Alltime Pixels'),
          get: data => data.pixelCountAlltime
        }, {
          id: 'discord_name',
          name: __('Discord'),
          get: data => data.discordName
        }
      );

      settings.lookup.filter.sensitive.enable.listen(function(value) {
        $('[data-sensitive=true]').css('display', value ? 'none' : '');
      });

      self.elements.lookup.hide();
      self.elements.prompt.hide();
      board.getRenderBoard().on('click', function(evt) {
        if (evt.shiftKey) {
          evt.preventDefault();
          self.runLookup(evt.clientX, evt.clientY);
        }
      });
    },
    registerHandle: function(fn) {
      self.handle = fn;
    },
    clearHandle: function() {
      self.handle = null;
    }
  };
  return {
    init: self.init,
    registerHandle: self.registerHandle,
    registerHook: self.registerHook,
    replaceHook: self.replaceHook,
    unregisterHook: self.unregisterHook,
    runLookup: self.runLookup,
    clearHandle: self.clearHandle
  };
})();
