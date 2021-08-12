// first we define the global helperfunctions and figure out what kind of settings our browser needs to use
module.exports.binaryAjax = async function(url) {
  const response = await fetch(url);
  const data = new Uint8Array(await response.arrayBuffer());
  return data;
};
module.exports.createImageData = function(w, h) {
  try {
    return new ImageData(w, h);
  } catch (e) {
    const imgCanv = document.createElement('canvas');
    imgCanv.width = w;
    imgCanv.height = h;
    return imgCanv.getContext('2d').getImageData(0, 0, w, h);
  }
};
module.exports.intToHex = (i) => `#${('000000' + (i >>> 0).toString(16)).slice(-6)}`;
module.exports.hexToRGB = function(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};
module.exports.analytics = function() {
  if (window.ga) {
    window.ga.apply(this, arguments);
  }
};
const nua = navigator.userAgent;
let haveImageRendering = (function() {
  const checkImageRendering = function(prefix, crisp, pixelated, optimizeContrast) {
    const d = document.createElement('div');
    if (crisp) {
      d.style.imageRendering = prefix + 'crisp-edges';
      if (d.style.imageRendering === prefix + 'crisp-edges') {
        return true;
      }
    }
    if (pixelated) {
      d.style.imageRendering = prefix + 'pixelated';
      if (d.style.imageRendering === prefix + 'pixelated') {
        return true;
      }
    }
    if (optimizeContrast) {
      d.style.imageRendering = prefix + 'optimize-contrast';
      if (d.style.imageRendering === prefix + 'optimize-contrast') {
        return true;
      }
    }
    return false;
  };
  return checkImageRendering('', true, true, false) || checkImageRendering('-o-', true, false, false) || checkImageRendering('-moz-', true, false, false) || checkImageRendering('-webkit-', true, false, true);
})();
let haveZoomRendering = false;
const webkitBased = nua.match(/AppleWebKit/i);
const iOSSafari = (nua.match(/(iPod|iPhone|iPad)/i) && webkitBased);
const desktopSafari = (nua.match(/safari/i) && !nua.match(/chrome/i));
const msEdge = nua.indexOf('Edge') > -1;
const possiblyMobile = window.innerWidth < 768 && nua.includes('Mobile');
if (iOSSafari) {
  const iOS = parseFloat(
    ('' + (/CPU.*OS ([0-9_]{1,5})|(CPU like).*AppleWebKit.*Mobile/i.exec(navigator.userAgent) || [0, ''])[1])
      .replace('undefined', '3_2').replace('_', '.').replace('_', '')
  ) || false;
  haveImageRendering = false;
  if (iOS >= 11) {
    haveZoomRendering = true;
  }
} else if (desktopSafari) {
  haveImageRendering = false;
  haveZoomRendering = true;
}
if (msEdge) {
  haveImageRendering = false;
}
module.exports.flags = {
  haveZoomRendering,
  webkitBased,
  possiblyMobile,
  haveImageRendering
};
