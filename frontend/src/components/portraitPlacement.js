export const DEFAULT_PLACEMENT = { scale: 1, offset_x: 0, offset_y: 0 };
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function portraitRectangle(editor, placement) {
  const original = editor.portrait_rect;
  const width = Math.max(1, Math.round(original.width * placement.scale));
  const height = Math.max(1, Math.round(original.height * placement.scale));
  return {
    width, height,
    x: Math.round(original.x + original.width/2 - width/2 + placement.offset_x * editor.width),
    y: Math.round(original.y + original.height/2 - height/2 + placement.offset_y * editor.height)
  };
}

export function constrainPlacement(editor, candidate) {
  const scale = clamp(candidate.scale, .25, 2.5);
  const original = editor.portrait_rect;
  const width = Math.max(1, Math.round(original.width * scale));
  const height = Math.max(1, Math.round(original.height * scale));
  const centerX = original.x + original.width/2;
  const centerY = original.y + original.height/2;
  // Keep at least 16 certificate pixels visible, matching server validation.
  return {
    scale,
    offset_x: clamp(candidate.offset_x, Math.max(-1, (16 - width/2 - centerX)/editor.width), Math.min(1, (editor.width - 16 + width/2 - centerX)/editor.width)),
    offset_y: clamp(candidate.offset_y, Math.max(-1, (16 - height/2 - centerY)/editor.height), Math.min(1, (editor.height - 16 + height/2 - centerY)/editor.height))
  };
}

// Scale around the fingers' midpoint, including two-finger panning.
export function pinchPlacement(editor, start, initialPoints, points, bounds) {
  const midpoint = pair => ({
    x: ((pair[0].x + pair[1].x)/2 - bounds.left)/bounds.width,
    y: ((pair[0].y + pair[1].y)/2 - bounds.top)/bounds.height
  });
  const distance = pair => Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
  const initial = midpoint(initialPoints), current = midpoint(points);
  const scale = clamp(start.scale * distance(points)/Math.max(1, distance(initialPoints)), .25, 2.5);
  const ratio = scale/start.scale;
  const original = editor.portrait_rect;
  const baseX = (original.x + original.width/2)/editor.width;
  const baseY = (original.y + original.height/2)/editor.height;
  return constrainPlacement(editor, {
    scale,
    offset_x: current.x + (baseX + start.offset_x - initial.x)*ratio - baseX,
    offset_y: current.y + (baseY + start.offset_y - initial.y)*ratio - baseY
  });
}
