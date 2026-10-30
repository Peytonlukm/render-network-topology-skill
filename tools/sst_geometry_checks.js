async function measureSstDeployment(selector) {
  await document.fonts.load('600 12.5px "IBM Plex Sans"');
  await document.fonts.load('400 12px "IBM Plex Sans"');
  await document.fonts.ready;
  const ctx = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas').getContext('2d');
  ctx.font = '600 1000px "IBM Plex Sans"';
  ctx.fontKerning = 'none';
  const transform = (x, y, matrix) => new DOMPoint(x, y).matrixTransform(matrix);
  return [...document.querySelectorAll(selector)].map(tag => {
    const n = tag.closest('.node'), rect = tag.querySelector('.deployment-shape');
    const text = tag.querySelector('.deployment-text'), symbol = tag.querySelector('.deployment-symbol');
    const pill = rect.getBoundingClientRect(), disc = n.querySelector('.node-disc').getBoundingClientRect();
    const scale = disc.width / (2 * Number(n.querySelector('.node-disc').getAttribute('r')));
    const size = Number(text.getAttribute('font-size')), ink = ctx.measureText(text.textContent), textScale = size / 1000;
    const tx = Number(text.getAttribute('x')), ty = Number(text.getAttribute('y')), tm = text.getScreenCTM();
    const textA = transform(tx - ink.actualBoundingBoxLeft * textScale, ty - ink.actualBoundingBoxAscent * textScale, tm);
    const textB = transform(tx + ink.actualBoundingBoxRight * textScale, ty + ink.actualBoundingBoxDescent * textScale, tm);
    const b = symbol.getBBox(), sm = symbol.getScreenCTM();
    const symbolA = transform(b.x - .9, b.y - .9, sm), symbolB = transform(b.x + b.width + .9, b.y + b.height + .9, sm);
    const contentLeft = Math.min(textA.x, symbolA.x), contentRight = Math.max(textB.x, symbolB.x);
    const contentTop = Math.min(textA.y, symbolA.y), contentBottom = Math.max(textB.y, symbolB.y);
    const state = n.querySelector('.state-shape')?.getBoundingClientRect();
    const use = n.querySelector('.node-glyph use'), ub = use.getBBox(), um = use.getScreenCTM();
    const pad = use.getAttribute('href') === '#sst-icon-rack' ? 1.75 : 0;
    const glyphBottom = transform(ub.x, ub.y + ub.height + pad, um).y;
    const box = {x:pill.x-4, y:pill.y-4, right:pill.right+4, bottom:pill.bottom+4};
    let crossings = 0;
    for (const edge of document.querySelectorAll('.edge')) {
      const length = edge.getTotalLength(), matrix = edge.getScreenCTM();
      for (let d=0; d<=length; d+=2) {
        const p = edge.getPointAtLength(d), point = transform(p.x, p.y, matrix);
        if (point.x>box.x && point.x<box.right && point.y>box.y && point.y<box.bottom) { crossings++; break; }
      }
    }
    return {
      type:tag.dataset.deployment, compact:n.classList.contains('compact') || n.querySelector('.node-disc').getAttribute('r') === '32',
      height:Number(rect.getAttribute('height')),
      textFits:textA.x>pill.left+3*scale && textB.x<pill.right-3*scale && textA.y>pill.top+2*scale && textB.y<pill.bottom-2*scale,
      bottomInside:pill.bottom + .6*scale <= disc.bottom - 1*scale,
      lowerHalf:pill.top >= disc.top+disc.height/2,
      pillCenterError:Math.abs(pill.left+pill.width/2-disc.left-disc.width/2)/scale,
      contentCenterError:Math.abs((contentLeft+contentRight)/2-pill.left-pill.width/2)/scale,
      contentVerticalError:Math.abs((contentTop+contentBottom)/2-pill.top-pill.height/2)/scale,
      glyphGap:(pill.top-glyphBottom)/scale,
      sideOverhang:Math.max(0,(pill.width-disc.width)/(2*scale)),
      stateRatio:state?pill.height/state.height:null,
      stateClear:!state || pill.right+5<state.left || pill.left>state.right+5 || pill.bottom+5<state.top || pill.top>state.bottom+5,
      edgeCrossings:crossings, font:getComputedStyle(text).fontFamily,
      loadedFonts:[...document.fonts].every(f=>f.status==='loaded'),
      fill:getComputedStyle(rect).fill, textFill:getComputedStyle(text).fill
    };
  });
}
