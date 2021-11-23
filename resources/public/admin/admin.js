'use strict';
(function () {
  let admin = null;
  const genButton = function(s) {
    return $('<button>').css({
      position: 'initial',
      right: 'auto',
      left: 'auto',
      bottom: 'auto'
    }).addClass('text-button').text(s);
  };
  const sendAlert = function(username) {
    return $('<input>').attr('type', 'text').attr('placeholder', __('Send alert...')).keydown(function (evt) {
      if (evt.which === 13) {
        admin.socket.send({
          type: 'admin_message',
          username: username,
          message: this.value
        });
        this.value = '';
      }
      evt.stopPropagation();
    });
  };
  const ban = (function () {
    var self = {
      elements: {
        prompt: $('#prompt')
      },
      init: function () {},
      deinit: function () {},
      prompt: function (s, time, fn) {
        const timeInput = $('<input>').attr('type', 'number').attr('step', 'any').addClass('admin-bannumber').val(time);
        self.elements.prompt.empty().append(
          $('<p>').addClass('text').css({
            fontWeight: 800,
            marginTop: 0
          }).text(s),
          $('<select>').append(
            $('<option>').text(__('Rule #1: Hateful/derogatory speech or symbols')),
            $('<option>').text(__('Rule #2: Nudity, genitalia, or non-PG-13 content')),
            $('<option>').text(__('Rule #3: Multi-account')),
            $('<option>').text(__('Rule #4: Botting')),
            $('<option>').attr('value', 'other').text(__('Other (specify below)'))
          ).css({
            width: '100%',
            'margin-bottom': '1em'
          }),
          $('<textarea>').attr('placeholder', __('Additional information (if applicable)')).css({
            width: '100%',
            height: '5em'
          }).keydown(function (evt) {
            evt.stopPropagation();
          }),
          $('<div>').addClass('text').append(
            // "Revert pixels of the last *n* hours", part before 'n'
            __('Revert pixels of the last '),
            timeInput,
            // "Revert pixels of the last *n* hours", part after 'n'
            __(' hours')
          ),
          $('<div>').addClass('buttons').append(
            genButton('Cancel').click(function () {
              self.elements.prompt.fadeOut(200);
            }),
            genButton('Ban').addClass('dangerous-button').click(function () {
              const selectedRule = self.elements.prompt.find('select').val();
              const textarea = self.elements.prompt.find('textarea').val().trim();
              let msg = selectedRule;
              if (selectedRule === 'other') {
                if (textarea === '') {
                  alert.show(__('You must specify the details.'));
                  return;
                }
                msg = textarea;
              } else if (textarea !== '') {
                msg += '; additional information: ' + textarea;
              }
              fn(msg, parseFloat(timeInput.val()));
              self.elements.prompt.fadeOut(200);
            })
          )
        ).fadeIn(200);
      },
      ban_internal: function (username, fn, msg, doneMsg, path, time) {
        self.prompt(msg, time ? 0 : 24, function (reason, length) {
          var data = {
            username: username,
            reason: reason,
            rollback_time: length * 3600
          };
          if (time) {
            data.time = time;
          }
          $.post(path, data, function () {
            admin.modal.showText(`${doneMsg} ${username}`);
            if (fn) {
              fn();
            }
          }).fail(function () {
            admin.modal.showText(__('Something went wrong! Perhaps insufficient permissions?'));
          });
        });
      },
      shadow: function (username, fn) {
        self.ban_internal(username, fn, __('Shadowban user'), __('Shadowbanned user'), '/admin/shadowban');
      },
      perma: function (username, fn) {
        self.ban_internal(username, fn, __('Permaban user'), __('Permabanned user'), '/admin/permaban');
      },
      ban: function (username, time, fn) {
        self.ban_internal(username, fn, __('Ban user'), __('Banned user'), '/admin/ban', time);
      },
      ban_24h: function (username, fn) {
        self.ban(username, 24 * 3600, fn);
      },
      unban: function (username, reason, fn) {
        if (typeof reason === 'function') {
          reason = '';
          fn = reason;
        }
        $.post('/admin/unban', {
          username,
          reason
        }, function () {
          admin.modal.showText(__(`Unbanned user ${username}`), { modalOpts: { closeExisting: true } });
          if (fn) {
            fn();
          }
        });
      }
    };
    return {
      init: self.init,
      deinit: self.deinit,
      shadow: self.shadow,
      perma: self.perma,
      ban: self.ban,
      ban_24h: self.ban_24h,
      unban: self.unban
    };
  })();
  const style = (function () {
    var self = {
      elements: {
        sheet: $('<link>', { rel: 'stylesheet', href: '/admin/admin.css' })
      },
      init: function () {
        self.elements.sheet.appendTo(document.head);
      },
      deinit: function () {
        self.elements.sheet.remove();
      }
    };
    return {
      init: self.init,
      deinit: self.deinit
    };
  })();
  const checkUser = (function () {
    const self = {
      elements: {
        check: $('<div>').addClass('message floating-panel')
      },
      callback: function (data) {
        const delta = (data.banExpiry - (new Date()).getTime()) / 1000;
        const chatbanDelta = (data.chatbanExpiry - (new Date()).getTime()) / 1000;
        const secs = Math.floor(delta % 60);
        const secsStr = secs < 10 ? '0' + secs : secs;
        const minutes = Math.floor((delta / 60)) % 60;
        const minuteStr = minutes < 10 ? '0' + minutes : minutes;
        const hours = Math.floor(delta / 3600);
        const hoursStr = hours < 10 ? '0' + hours : hours;
        let bannedStr = '';
        let expiracyStr = hoursStr + ':' + minuteStr + ':' + secsStr;
        let chatbannedStr = '';
        if (data.shadowBanned) {
          // translator: Context: ban type
          bannedStr = __('shadow');
          expiracyStr = __('never');
        } else if (data.banExpiry === 0) {
          bannedStr = __('permanent');
          expiracyStr = __('never');
        } else {
          bannedStr = data.banned ? __('Yes') : __('No');
        }
        chatbannedStr = data.chatbanIsPerma ? __('Yes (permanent)') : (data.chatBanned ? __('Yes') : __('No'));
        const items = [
          [__('Username'), crel('a', {
            href: `https://admin.${location.host}/userinfo/${data.username}`,
            target: '_blank'
          }, data.username)],
          [__('Profile'), crel('a', { href: `/profile/${data.username}`, target: '_blank' }, data.username)],
          [__('Logins'), data.logins
            ? data.logins.map(({ serviceID, serviceUserID }) => `${serviceID}:${serviceUserID}`).join(', ')
            : null
          ],
          [__('Roles'), data.roles.map(role => role.name).join(', ')],
          [__('Pixels'), data.pixelCount],
          [__('All Time Pixels'), data.pixelCountAllTime],
          [__('Rename Requested'), data.renameRequested ? 'Yes' : 'No'],
          [__('Discord Name'), data.discordName || '(not set)'],
          [__('Banned'), bannedStr],
          [__('Chatbanned'), chatbannedStr]
        ];
        if (data.banned) {
          items.push([__('Ban Reason'), data.ban_reason]);
          items.push([__('Ban Expiracy'), expiracyStr]);
        }
        if (data.chatBanned) {
          items.push([__('Chatban Reason'), App.chat.canvasBanRespected && !data.chatbanReason ? __('(canvas ban)') : data.chatbanReason]);
          if (!data.isChatbanPerma) {
            const chatbannedExpiracyStr = App.chat.canvasBanRespected && chatbanDelta < 0 ? __('when canvas ban ends') : `${chatbanDelta >> 0}s`;
            items.push([__('Chatban Expires'), chatbannedExpiracyStr]);
          }
        }
        self.elements.check.empty().append(
          $('<div>').addClass('content').append(
            $.map(items, function ([name, value]) {
              if (value == null) {
                return null;
              }

              return $('<div>').append(
                $('<b>').text(name + ': '),
                typeof value === 'string' ? $('<span>').text(value) : value
              );
            }),
            (admin.user.hasPermission('user.alert') ? $('<div>').append(sendAlert(data.username)) : ''),
            $('<div>').append(
              genButton(__('Ban (24h)')).click(function () {
                ban.ban_24h(data.username, function () {
                  self.elements.check.fadeOut(200);
                });
              }),
              (admin.user.hasPermission('user.permaban') ? genButton(__('Permaban')).click(function () {
                ban.perma(data.username, function () {
                  self.elements.check.fadeOut(200);
                });
              }) : '')
            ),
            $('<div>').append(
              (data.banned ? genButton(__('Unban')).click(() => self.popUnban(data.username)) : ''),
              (admin.user.hasPermission('user.shadowban') ? genButton(__('Shadowban')).click(function () {
                ban.shadow(data.username, function () {
                  self.elements.check.fadeOut(200);
                });
              }) : '')
            ),
            crel('div',
              crel('button', {
                class: 'text-button',
                'data-action': 'chatban',
                'data-target': data.username,
                style: 'position: initial; right: auto; left: auto; bottom: auto;',
                onclick: admin.chat._handleActionClick
              }, 'Chat (un)ban'),
              crel('button', {
                class: 'text-button',
                'data-action': 'purge',
                'data-target': data.username,
                style: 'position: initial; right: auto; left: auto; bottom: auto;',
                onclick: admin.chat._handleActionClick
              }, 'Chat purge'),
              crel('button', {
                class: 'text-button',
                'data-action': 'lookup-chat',
                'data-target': data.username,
                style: 'position: initial; right: auto; left: auto; bottom: auto;',
                onclick: admin.chat._handleActionClick
              }, 'Chat lookup')
            ),
            (admin.user.hasPermission('user.namechange.flag') ? crel('div',
              crel('button', {
                class: 'text-button',
                'data-action': 'request-rename',
                'data-target': data.username,
                style: 'position: initial; right: auto; left: auto; bottom: auto;',
                onclick: admin.chat._handleActionClick
              }, 'Request Rename'),
              (admin.user.hasPermission('user.namechange.force') ? crel('button', {
                class: 'text-button',
                'data-action': 'force-rename',
                'data-target': data.username,
                style: 'position: initial; right: auto; left: auto; bottom: auto;',
                onclick: admin.chat._handleActionClick
              }, 'Force Rename') : '')
            ) : ''),
            $('<div>').append(
              $('<b>').text(__('Custom ban length: ')), '<br>',
              $('<input>').attr('type', 'number').attr('step', 'any').addClass('admin-bannumber').val(24),
              ' hours ',
              genButton('Ban').click(function () {
                ban.ban(data.username, parseFloat($(this).parent().find('input').val()) * 3600, function () {
                  self.elements.check.fadeOut(200);
                });
              })
            )
          ),
          genButton(__('Close')).addClass('float-right').click(function () {
            self.elements.check.fadeOut(200);
          })
        ).fadeIn(200);
      },
      init: function () {
        self.elements.check.hide().appendTo(document.body);
      },
      deinit: function () {
        self.elements.check.remove();
      },
      check: function (arg, type = 'username') {
        const toPost = {};
        toPost[type] = arg;
        $.post('/admin/check', toPost, self.callback).fail(function () {
          // translator: Admin check. Example: type = 'username', arg = 'pxlsuser94'
          admin.modal.showText(__(`${type} ${arg} not found.`));
        });
      },
      popUnban: username => {
        const btnSubmit = crel('button', { class: 'text-button', type: 'submit' }, __('Unban'));
        const txtUnbanReason = crel('input', { type: 'text', required: 'true' });
        const lblUnbanReason = crel('label', __('Unban Reason:') + ' ', txtUnbanReason);

        txtUnbanReason.addEventListener('keydown', e => e.stopPropagation());

        const unbanWrapper = crel('form', { class: 'chatmod-container' },
          crel('p', __(`Unbanning ${username}`)),
          lblUnbanReason,
          crel('div', { class: 'buttons' },
            crel('button', {
              class: 'text-button',
              type: 'button',
              onclick: () => { admin.modal.closeAll(); }
            }, __('Cancel')),
            btnSubmit
          )
        );

        unbanWrapper.onsubmit = e => {
          e.preventDefault();
          ban.unban(username, txtUnbanReason.value, function () {
            self.elements.check.fadeOut(200);
          });
        };

        admin.modal.show(admin.modal.buildDom(
          crel('h2', { class: 'modal-title' }, __('Unban')),
          unbanWrapper
        ));
      }
    };
    return {
      init: self.init,
      deinit: self.deinit,
      check: self.check,
      popUnban: self.popUnban
    };
  })();
  const panel = (function () {
    const self = {
      elements: {
        panel: $('<div>')
      },
      init: function () {
        self.elements.panel.hide().addClass('admin bubble').append(
          // Moderator panel label
          $('<h2>').text(__('MOD')),
          $('<div>').append(
            // first do the checkboxes
            $.map(
              [
                {
                  text: __('Ignore cooldown'),
                  onChange: function () {
                    admin.socket.send({ type: 'admin_placement_overrides', ignoreCooldown: this.checked });
                  },
                  checkState: admin.user.placementOverrides.ignoreCooldown,
                  disabled: !(admin.user.hasPermission('board.cooldown.override') || admin.user.hasPermission('board.cooldown.ignore'))
                },
                {
                  text: __('Place any color'),
                  onChange: function () {
                    admin.socket.send({ type: 'admin_placement_overrides', canPlaceAnyColor: this.checked });
                  },
                  checkState: admin.user.placementOverrides.canPlaceAnyColor,
                  disabled: !admin.user.hasPermission('board.palette.all')
                },
                {
                  text: __('Ignore placemap'),
                  onChange: function () {
                    admin.socket.send({ type: 'admin_placement_overrides', ignorePlacemap: this.checked });
                  },
                  checkState: admin.user.placementOverrides.ignorePlacemap,
                  disabled: !admin.user.hasPermission('board.placemap.ignore')
                }
              ],
              function (cbox) {
                return $('<label>').append(
                  $('<input>').attr('type', 'checkbox').prop('checked', !!cbox.checkState).prop('disabled', !!cbox.disabled).change(cbox.onChange), $('<span class="label-text">').text(cbox.text)
                );
              }
            ),
            // next do the text input
            $.map([
              [__('Ban user (24h)'), ban.ban_24h],
              [__('Unban user'), checkUser.popUnban],
              [__('Check user'), checkUser.check]
            ], function (o) {
              return $('<input>').attr({
                type: 'text',
                placeholder: o[0]
              }).on('keydown', function (evt) {
                if (evt.which === 13) {
                  o[1](this.value);
                  this.value = '';
                }
                evt.stopPropagation();
              });
            })
          )
        ).appendTo($('#ui-top')).fadeIn(200);
      },
      deinint: function () {
        self.elements.panel.remove();
      }
    };
    return {
      init: self.init,
      deinit: self.deinint
    };
  })();
  const lookup = (function () {
    const self = {
      elements: {
        lookup: $('#lookup')
      },
      /**
       * Register hooks for admin-specific lookups.
       */
      init: function () {
        App.lookup.replaceHook('username', {
          get: data => data.username
            ? crel('span', crel('a', {
              href: `https://admin.${location.host}/userinfo/${data.username}`,
              target: '_blank'
            }, data.username), ' (', crel('a', {
              href: `/profile/${data.username}`,
              target: '_blank'
            }, __('profile')), ')')
            : null
        });
        App.lookup.registerHook({
          id: 'logins',
          name: __('Logins'),
          sensitive: true,
          get: data => {
            if (data.logins == null) {
              return null;
            }

            const elems = $('<div>');
            for (let i = 0; i < data.logins.length; i++) {
              const login = data.logins[i];
              elems.append($('<span>').text(`${login.serviceID}:${login.serviceUserID}`));
              if (i !== data.logins.length - 1) {
                elems.append(', ');
              }
            }
            return elems;
          }
        }, {
          id: 'user_agent',
          name: __('User Agent'),
          sensitive: true,
          get: data => $('<div>').text(data.userAgent)
        }, {
          id: 'alert',
          name: __('Send Alert'),
          sensitive: true,
          get: data => sendAlert(data.username)
        }, {
          id: 'admin_actions',
          name: __('Mod Actions'),
          sensitive: true,
          get: data => $('<span>').append(
            genButton(__('Ban (24h)')).click(() => {
              ban.ban_24h(data.username, function () {
                self.elements.lookup.fadeOut(200);
              });
            }),
            genButton(__('More...')).click(() => {
              checkUser.check(data.username);
              self.elements.lookup.fadeOut(200);
            })
          )
        });
      },
      /**
       * Unregister hooks for admin-specific lookups.
       */
      deinit: function () {
        App.lookup.unregisterHook('login');
        App.lookup.unregisterHook('user_agent');
        App.lookup.unregisterHook('day_ban');
        App.lookup.unregisterHook('more');
      }
    };
    return {
      init: self.init,
      deinit: self.deinit
    };
  })();
  window.initAdmin = function (_admin, cb) {
    admin = _admin;
    ban.init();
    style.init();
    checkUser.init();
    panel.init();
    lookup.init();
    if (cb && (typeof cb === 'function')) {
      // eslint-disable-next-line standard/no-callback-literal
      cb({ ban, style, checkUser, panel, lookup });
    }
  };
  window.deInitAdmin = function () {
    ban.deinit();
    style.deinit();
    checkUser.deinit();
    panel.deinit();
    lookup.deinit();
  };
})();
