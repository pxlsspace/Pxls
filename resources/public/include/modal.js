const modal = (function() {
  return {
    showText: function(text, opts) {
      opts = Object.assign({}, { title: 'Pxls', modalOpts: {} }, opts);
      return modal.show(modal.buildDom(
        crel('h2', { class: 'modal-title' }, opts.title || 'Pxls'),
        crel('p', { style: 'margin: 0;' }, text)
      ), opts.modalOpts);
    },
    show: function(modal, opts) {
      if (!(modal instanceof HTMLElement)) throw new Error('Invalid modal object supplied. Expected an HTMLElement');
      opts = Object.assign({}, $.modal.defaults || {}, {
        closeExisting: true,
        escapeClose: true,
        clickClose: true,
        showClose: false,
        closeText: '<i class="fas fa-times"></i>'
      }, { removeOnClose: true }, opts);
      if (!document.body.contains(modal)) {
        document.body.appendChild(modal);
      }
      const modalObj = $(modal).modal(opts);
      if (opts.removeOnClose === true) {
        modalObj.on($.modal.AFTER_CLOSE, function() {
          $(this).remove();
        });
      }
      return modalObj;
    },
    buildCloser: function() {
      const button = crel('button', { class: 'panel-closer' }, crel('i', { class: 'fas fa-times' }));
      button.addEventListener('click', () => modal.closeTop());
      return button;
    },
    buildDom: function(headerContent, bodyContent, footerContent) {
      return crel('div', { class: 'modal panel', tabindex: '-1', role: 'dialog' },
        crel('div', { class: 'modal-wrapper', role: 'document' },
          headerContent == null ? null : crel('header', { class: 'modal-header panel-header' },
            crel('div', { class: 'left' }),
            crel('div', { class: 'mid' }, headerContent),
            crel('div', { class: 'right' }, this.buildCloser())),
          bodyContent == null ? null : crel('div', { class: 'modal-body panel-body' }, bodyContent),
          footerContent == null ? null : crel('footer', { class: 'modal-footer panel-footer' }, footerContent)
        )
      );
    },
    closeAll: function(clearDom = true) {
      while ($.modal.isActive()) { $.modal.close(); }
      if (clearDom) { Array.from(document.querySelectorAll('.modal')).forEach(el => el.remove()); }
    },
    closeTop: function(clearDom = true) {
      const elem = $.modal.close();
      if (clearDom && elem && elem[0]) { elem[0].remove(); }
    }
  };
})();

module.exports.modal = modal;
