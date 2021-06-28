const { settings } = require('./settings');
let board;

// here all the grid stuff happens
module.exports.grid = (function() {
  const self = {
    elements: {
      grid: $('#grid')
    },
    init: function() {
      board = require('./board').board;
      settings.board.grid.enable.listen(function(value) {
        self.elements.grid.toggleClass('transparent', !value);
      });
      let GKeyPressed = false;
      // `e` is a key event.
      // True if g key is the focus of the event.
      const testForG = (e) => e.key === 'g' || e.key === 'G' || e.which === 71;

      $(window).keydown(function(e) {
        if (['INPUT', 'TEXTAREA'].includes(e.target.nodeName)) {
          // prevent inputs from triggering shortcuts
          return;
        }

        if (testForG(e)) {
          if (GKeyPressed) {
            return;
          }
          GKeyPressed = true;

          settings.board.grid.enable.toggle();
        }
      });

      $(window).keyup(function(e) {
        if (testForG(e)) {
          GKeyPressed = false;
        }
      });
    },
    update: function() {
      const a = board.fromScreen(0, 0, false);
      const scale = board.getScale();
      const roundedScale = Math.max(1, Math.floor(scale));
      const scaleRoundingErrorMultiplier = scale / roundedScale;
      self.elements.grid.css({
        backgroundSize: roundedScale + 'px ' + roundedScale + 'px',
        transform: 'translate(' + Math.floor(-a.x % 1 * roundedScale) + 'px,' + Math.floor(-a.y % 1 * roundedScale) + 'px) scale(' + scaleRoundingErrorMultiplier + ')',
        opacity: (scale - 2) / 6
      });
    }
  };
  return {
    init: self.init,
    update: self.update
  };
})();
