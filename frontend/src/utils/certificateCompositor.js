// Client-side mirror of backend/app_with_db.py's draw_3d_metallic_text(),
// nametag_layout.fit_nametag() and the badge/name-tag compositing steps in
// generate_certificate_for_agent(). Keeping this logic in one place lets the
// browser build the same pixels the server would, so badges + name-tag +
// name text no longer need a server round trip for every visitor.

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

// Mirrors Image.new(...).paste(content, mask=mask): keep `content` only
// where `maskDraw` painted opaque pixels.
function clippedLayer(width, height, maskDraw, contentDraw) {
  const mask = makeCanvas(width, height);
  maskDraw(mask.getContext('2d'));
  const layer = makeCanvas(width, height);
  const ctx = layer.getContext('2d');
  contentDraw(ctx);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return layer;
}

function verticalGradientFill(ctx, width, height, stops) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// Draws `text` filled + stroked (paint-order stroke-then-fill, like PIL's
// stroke_width) onto ctx at (x, y) with the glyph baseline positioned so the
// visual top-left of the text sits at (x, y).
function paintText(ctx, text, x, y, fillStyle, strokeWidth, strokeStyle) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if (strokeWidth > 0 && strokeStyle) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeWidth * 2;
    ctx.strokeStyle = strokeStyle;
    ctx.strokeText(text, x, y);
  }
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fillText(text, x, y);
  }
}

function measureText(ctx, text, font) {
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent ?? metrics.fontBoundingBoxAscent ?? 0;
  const descent = metrics.actualBoundingBoxDescent ?? metrics.fontBoundingBoxDescent ?? 0;
  return { width: metrics.width, height: ascent + descent, ascent };
}

const STYLE_STOPS = {
  top: {
    face: [[0, '#fff8e9'], [0.45, '#ffe4c9'], [1, '#fff6e9']],
    extrude: [[0, '#ff9a46'], [0.5, '#ed6b22'], [1, '#b12b08']],
    stroke: '#c34211',
  },
  name: {
    face: [[0, '#ffffff'], [0.34, '#fffdf8'], [0.62, '#fff7ef'], [1, '#ffffff']],
    extrude: [[0, '#ff8a38'], [0.45, '#f26922'], [0.72, '#d7460f'], [1, '#a82208']],
    stroke: '#f05c31',
  },
};

// Equivalent to backend draw_3d_metallic_text(): draws the gradient-filled,
// extruded, drop-shadowed "poster" text centered at (centerX, centerY) onto
// `targetCtx`.
export function draw3DMetallicText(targetCtx, text, font, centerX, centerY, style = 'name') {
  const { face, extrude, stroke } = STYLE_STOPS[style] || STYLE_STOPS.name;
  const { width: textW, height: textH, ascent } = measureText(targetCtx, text, font);

  const depth = Math.max(6, Math.round(textH * 0.09));
  const strokeW = Math.max(2, Math.round(textH * 0.03));
  const pad = Math.max(30, Math.round(textH / 3)) + depth;
  const layerW = textW + pad * 2;
  const layerH = textH + pad * 2;
  const originX = pad;
  const originY = pad + ascent;

  // 1. Soft warm drop shadow.
  const shadowDx = Math.round(depth * 0.9);
  const shadowDy = Math.round(depth * 1.3);
  const shadow = makeCanvas(layerW, layerH);
  const shadowCtx = shadow.getContext('2d');
  shadowCtx.font = font;
  shadowCtx.filter = `blur(${Math.max(4, Math.round(depth / 2))}px)`;
  paintText(shadowCtx, text, originX + shadowDx, originY + shadowDy, 'rgba(93,10,0,0.51)', strokeW, 'rgba(93,10,0,0.51)');
  shadowCtx.filter = 'none';

  // 2. Extrusion: gradient clipped to a union of diagonally stacked copies.
  const steps = 6;
  const extrusion = clippedLayer(layerW, layerH,
    maskCtx => {
      maskCtx.font = font;
      for (let i = steps; i >= 1; i -= 1) {
        const offset = Math.round((depth * i) / steps);
        paintText(maskCtx, text, originX + offset, originY + offset, '#fff', strokeW, '#fff');
      }
    },
    ctx => verticalGradientFill(ctx, layerW, layerH, extrude));

  // 2b. Metallic diagonal sheen over the extrusion silhouette.
  const bandW = Math.max(20, Math.round(layerH * 0.35));
  const sheenMask = makeCanvas(layerW, layerH);
  const sheenCtx = sheenMask.getContext('2d');
  sheenCtx.filter = `blur(${Math.max(6, Math.round(bandW / 3))}px)`;
  sheenCtx.strokeStyle = 'rgba(255,255,255,0.55)';
  sheenCtx.lineWidth = bandW;
  for (const bandOffset of [-layerW * 0.15, layerW * 0.55]) {
    sheenCtx.beginPath();
    sheenCtx.moveTo(bandOffset, layerH);
    sheenCtx.lineTo(bandOffset + layerH, 0);
    sheenCtx.stroke();
  }
  sheenCtx.filter = 'none';
  sheenCtx.globalCompositeOperation = 'destination-in';
  sheenCtx.drawImage(extrusion, 0, 0);
  extrusion.getContext('2d').drawImage(sheenMask, 0, 0);

  // 3. Face: stroke-colored silhouette, then gradient fill on top.
  const strokeColorLayer = clippedLayer(layerW, layerH,
    maskCtx => { maskCtx.font = font; paintText(maskCtx, text, originX, originY, '#fff', strokeW, '#fff'); },
    ctx => { ctx.fillStyle = stroke; ctx.fillRect(0, 0, layerW, layerH); });
  const faceFill = clippedLayer(layerW, layerH,
    maskCtx => { maskCtx.font = font; paintText(maskCtx, text, originX, originY, '#fff', 0, null); },
    ctx => verticalGradientFill(ctx, layerW, layerH, face));

  // 4. Glossy highlight over the upper portion of the face.
  const highlight = clippedLayer(layerW, layerH,
    maskCtx => { maskCtx.font = font; paintText(maskCtx, text, originX, originY, '#fff', 0, null); },
    ctx => {
      const gradient = ctx.createLinearGradient(0, 0, 0, layerH);
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
      gradient.addColorStop(0.3, 'rgba(255,255,255,0.55)');
      gradient.addColorStop(0.55, 'rgba(255,255,255,0)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, layerW, layerH);
    });

  const pasteX = Math.round(centerX - layerW / 2);
  const pasteY = Math.round(centerY - layerH / 2);
  targetCtx.drawImage(shadow, pasteX, pasteY);
  targetCtx.drawImage(extrusion, pasteX, pasteY);
  targetCtx.drawImage(strokeColorLayer, pasteX, pasteY);
  targetCtx.drawImage(faceFill, pasteX, pasteY);
  targetCtx.drawImage(highlight, pasteX, pasteY);

  return { width: textW, height: textH };
}

// Equivalent to backend nametag_layout.fit_nametag(): crops `image`
// (an <img>/<canvas>-like drawable with naturalWidth/naturalHeight or
// width/height) to its visible (non-transparent) bounds, then scales it to
// fit inside the width/height ratios, returning a canvas plus its paste
// position so callers can drawImage() it directly onto the certificate.
export function fitNametag(image, canvasWidth, canvasHeight, widthRatio, yRatio) {
  const sourceW = image.naturalWidth || image.width;
  const sourceH = image.naturalHeight || image.height;
  const probe = makeCanvas(sourceW, sourceH);
  const probeCtx = probe.getContext('2d');
  probeCtx.drawImage(image, 0, 0, sourceW, sourceH);
  const { data } = probeCtx.getImageData(0, 0, sourceW, sourceH);

  let minX = sourceW, minY = sourceH, maxX = -1, maxY = -1;
  for (let y = 0; y < sourceH; y += 1) {
    for (let x = 0; x < sourceW; x += 1) {
      if (data[(y * sourceW + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  const artworkW = maxX - minX + 1;
  const artworkH = maxY - minY + 1;
  const targetWidth = Math.max(1, Math.min(canvasWidth, Math.round(canvasWidth * widthRatio)));
  const margin = Math.floor((canvasWidth - targetWidth) / 2);
  const centerY = Math.round(canvasHeight * yRatio);
  const maxHeight = Math.max(1, 2 * Math.min(centerY - margin, canvasHeight - margin - centerY));
  const scale = Math.min(targetWidth / artworkW, maxHeight / artworkH);
  const width = Math.max(1, Math.round(artworkW * scale));
  const height = Math.max(1, Math.round(artworkH * scale));

  const artwork = makeCanvas(width, height);
  artwork.getContext('2d').drawImage(image, minX, minY, artworkW, artworkH, 0, 0, width, height);

  const x = Math.round((canvasWidth - width) / 2);
  const y = Math.max(0, Math.min(canvasHeight - height, Math.round(centerY - height / 2)));
  return { canvas: artwork, x, y, width, height };
}

// Mirrors the backend's subject_bbox trim: crops `image` to its visible
// (non-transparent) bounds plus a small 2% padding, matching the margin kept
// around the segmented portrait before it is scaled onto the certificate.
function trimAlphaBBox(image) {
  const sourceW = image.naturalWidth || image.width;
  const sourceH = image.naturalHeight || image.height;
  const probe = makeCanvas(sourceW, sourceH);
  const probeCtx = probe.getContext('2d');
  probeCtx.drawImage(image, 0, 0, sourceW, sourceH);
  const { data } = probeCtx.getImageData(0, 0, sourceW, sourceH);

  let minX = sourceW, minY = sourceH, maxX = -1, maxY = -1;
  for (let y = 0; y < sourceH; y += 1) {
    for (let x = 0; x < sourceW; x += 1) {
      if (data[(y * sourceW + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  const padX = Math.max(4, Math.round((maxX - minX + 1) * 0.02));
  const padY = Math.max(4, Math.round((maxY - minY + 1) * 0.02));
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(sourceW - 1, maxX + padX);
  maxY = Math.min(sourceH - 1, maxY + padY);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  const cropped = makeCanvas(width, height);
  cropped.getContext('2d').drawImage(image, minX, minY, width, height, 0, 0, width, height);
  return { canvas: cropped, width, height };
}

// Loads a font file and registers it under `family` so canvas text rendering
// (which, unlike CSS, does not wait for @font-face) can use it immediately.
export async function loadFont(url, family) {
  const face = new FontFace(family, `url(${url})`);
  await face.load();
  document.fonts.add(face);
  return face;
}

// Full client-side certificate composite: background + portrait placement
// (mirroring generate_certificate_for_agent's bottom-centered scale-to-fit)
// followed by compositeOverlays() for badges/name-tag/name text. Returns a
// canvas sized to config.output_size, ready to encode and upload.
export async function composeFullCertificate(config, backgroundImage, portraitImage, imageUrlBase) {
  const [canvasWidth, canvasHeight] = config.output_size;
  const canvas = makeCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);

  const trimmed = trimAlphaBBox(portraitImage);
  if (!trimmed) throw new Error('No subject detected in the photo.');
  const photoRatios = config.layout.agent_photo;
  const maxWidth = Math.round(canvasWidth * photoRatios.width_ratio);
  const maxHeight = Math.round(canvasHeight * photoRatios.height_ratio);
  const scale = Math.min(maxWidth / trimmed.width, maxHeight / trimmed.height);
  const newWidth = Math.max(1, Math.round(trimmed.width * scale));
  const newHeight = Math.max(1, Math.round(trimmed.height * scale));
  const pasteX = Math.round((canvasWidth - newWidth) / 2);
  const pasteY = canvasHeight - newHeight;
  ctx.drawImage(trimmed.canvas, 0, 0, trimmed.width, trimmed.height, pasteX, pasteY, newWidth, newHeight);

  await compositeOverlays(ctx, canvasWidth, canvasHeight, config, imageUrlBase);
  return canvas;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${url}`));
    image.src = url;
  });
}

// Fits `fontFamily` to `displayName` inside `maxTextWidth`, mirroring the
// backend's dynamic font-size shrink loop, then returns the chosen CSS font
// string plus the measured text width.
function fitNameFont(ctx, displayName, fontFamily, maxFontSize, minFontSize, maxTextWidth) {
  let fontSize = maxFontSize;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const font = `${fontSize}px "${fontFamily}"`;
    const { width } = measureText(ctx, displayName, font);
    if (width + Math.max(32, Math.floor(fontSize / 2)) <= maxTextWidth || fontSize <= minFontSize) {
      return { font, fontSize, width };
    }
    fontSize = Math.max(minFontSize, fontSize - Math.max(1, Math.floor(maxFontSize * 0.01)));
  }
  const font = `${fontSize}px "${fontFamily}"`;
  return { font, fontSize, width: measureText(ctx, displayName, font).width };
}

// Draws the tier overlay layer, badges, name-tag banner and 3D metallic name
// text onto `ctx` (which already has the background + portrait painted),
// using the `/api/user/render-config/<code>` payload. Mirrors the layer
// order and ratios used by generate_certificate_for_agent() server-side.
export async function compositeOverlays(ctx, canvasWidth, canvasHeight, config, imageUrlBase) {
  const { layout, assets, agent, font } = config;
  const resolve = path => (path ? `${imageUrlBase}${path}` : null);

  const layerUrl = resolve(assets.layer);
  if (layerUrl) {
    const layerImage = await loadImage(layerUrl);
    ctx.drawImage(layerImage, 0, 0, canvasWidth, canvasHeight);
  }

  const badgeRatios = layout.badges;
  const badgeX = Math.round(canvasWidth * badgeRatios.x_ratio);
  const badgeYStart = Math.round(canvasHeight * badgeRatios.y_ratio);
  const badgeSpacing = Math.round(canvasHeight * badgeRatios.spacing_ratio);
  const badgeSize = Math.round(canvasWidth * badgeRatios.size_ratio);
  for (let i = 0; i < agent.badges.length; i += 1) {
    const badgeUrl = resolve(assets.badges[agent.badges[i]]);
    if (!badgeUrl) continue;
    const badgeImage = await loadImage(badgeUrl);
    ctx.drawImage(badgeImage, badgeX, badgeYStart + i * badgeSpacing, badgeSize, badgeSize);
  }

  const nametagRatios = layout.name_tag;
  let nametagWidth = Math.round(canvasWidth * nametagRatios.width_ratio);
  const nametagUrl = resolve(assets.nametag);
  if (nametagUrl) {
    const nametagImage = await loadImage(nametagUrl);
    const fitted = fitNametag(nametagImage, canvasWidth, canvasHeight, nametagRatios.width_ratio, nametagRatios.y_ratio);
    if (fitted) {
      nametagWidth = fitted.width;
      ctx.drawImage(fitted.canvas, fitted.x, fitted.y);
    }
  }

  const nameRatios = layout.name_text;
  const maxFontSize = Math.round(canvasHeight * nameRatios.font_size_ratio);
  const minFontSize = Math.round(canvasHeight * nameRatios.min_font_size_ratio);
  const textX = Math.round(canvasWidth * nameRatios.x_ratio);
  const textY = Math.round(canvasHeight * nameRatios.y_ratio);
  const maxTextWidth = Math.round(nametagWidth * (nameRatios.max_width_ratio ?? 0.85));
  const displayName = agent.name.toUpperCase();
  const { font: fittedFont, width: textWidth } = fitNameFont(ctx, displayName, font.family, maxFontSize, minFontSize, maxTextWidth);
  if (textWidth + Math.max(32, Math.floor(maxFontSize / 2)) > maxTextWidth && textWidth > maxTextWidth) {
    throw new Error('Agent name is too long for the certificate.');
  }
  draw3DMetallicText(ctx, displayName, fittedFont, textX, textY, 'name');
}
