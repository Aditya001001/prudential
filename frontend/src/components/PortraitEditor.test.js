import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import PortraitEditor from './PortraitEditor';
import api from '../api';
import { DEFAULT_PLACEMENT, constrainPlacement, pinchPlacement, portraitRectangle } from './portraitPlacement';

jest.mock('../api', () => ({
  __esModule: true, default: { get: jest.fn(), post: jest.fn() }, API_URL: '/prudential-api',
  errorMessage: jest.requireActual('../api').errorMessage
}));
const manifest = {
  width: 1800, height: 3184, portrait_rect: { x: 100, y: 784, width: 1600, height: 2400 },
  revision: 0, transform: DEFAULT_PLACEMENT,
  layers: { background: '/background', portrait: '/portrait', foreground: '/foreground' }
};
let container, root, originalImage, onClose, onSaved;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  originalImage = global.Image;
  global.Image = class { set src(value) { this.url = value; Promise.resolve().then(() => this.onload?.()); } };
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: jest.fn(), save: jest.fn(), scale: jest.fn(), drawImage: jest.fn(), restore: jest.fn()
  });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  onClose = jest.fn(); onSaved = jest.fn();
  api.get.mockResolvedValue({ data: manifest });
  api.post.mockResolvedValue({ data: { certificate_file: 'adjusted.png', revision: 1 } });
});
afterEach(() => { act(() => root.unmount()); container.remove(); global.Image = originalImage; jest.restoreAllMocks(); });
const render = async () => { await act(async () => root.render(<PortraitEditor certificateId={42} onClose={onClose} onSaved={onSaved} />)); };
const button = name => [...container.querySelectorAll('button')].find(item => item.textContent === name || item.getAttribute('aria-label') === name);
const changeSize = async value => { await act(async () => Simulate.change(container.querySelector('[aria-label="肖像照大小"]'), { target: { value } })); };

test('geometry preserves proportions and constrains drag before the portrait disappears', () => {
  expect(portraitRectangle(manifest, DEFAULT_PLACEMENT)).toEqual(manifest.portrait_rect);
  const placement = constrainPlacement(manifest, { scale: .5, offset_x: 10, offset_y: -10 });
  const rect = portraitRectangle(manifest, placement);
  expect(rect.width).toBe(800); expect(rect.height).toBe(1200);
  expect(rect.x).toBeLessThanOrEqual(1784); expect(rect.y + rect.height).toBeGreaterThanOrEqual(16);
});

test('resize and move save portrait-only adjustments with the current revision', async () => {
  await render(); expect(button("儲存變更").disabled).toBe(true);
  await changeSize('150'); act(() => Simulate.click(button("向左移動肖像照")));
  await act(async () => Simulate.click(button("儲存變更")));
  expect(api.post).toHaveBeenCalledWith('/prudential-api/user/certificates/42/adjust', {
    revision: 0, transform: { scale: 1.5, offset_x: -20/1800, offset_y: 0 }
  });
  expect(onSaved).toHaveBeenCalledWith({ certificate_file: 'adjusted.png', revision: 1 });
});

test('reset returns to automatic placement and cancel does not save', async () => {
  api.get.mockResolvedValue({ data: { ...manifest, transform: { scale: 1.3, offset_x: .1, offset_y: -.1 } } });
  await render(); act(() => Simulate.click(button("重設位置")));
  expect(container.querySelector('output').textContent).toBe('100%');
  act(() => Simulate.click(button("取消")));
  expect(onClose).toHaveBeenCalledTimes(1); expect(api.post).not.toHaveBeenCalled();
});

test('failed save shows an error and keeps the adjusted preview available', async () => {
  api.post.mockRejectedValue({ response: { data: { error: 'The generator is busy. Please try again shortly.' } } });
  await render(); await changeSize('125'); await act(async () => Simulate.click(button("儲存變更")));
  expect(container.querySelector('[role="alert"]').textContent).toContain('海報產生器正忙碌');
  expect(container.querySelector('output').textContent).toBe('125%'); expect(button("儲存變更").disabled).toBe(false);
  expect(onSaved).not.toHaveBeenCalled();
});

test('save disables close and editing until the final certificate is written', async () => {
  let complete; api.post.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  await render(); await changeSize('110'); await act(async () => Simulate.click(button("儲存變更")));
  expect(button("取消").disabled).toBe(true); expect(container.querySelector('[aria-label="肖像照大小"]').disabled).toBe(true);
  act(() => Simulate.keyDown(container.querySelector('[role="dialog"]'), { key: 'Escape' })); expect(onClose).not.toHaveBeenCalled();
  await act(async () => complete({ data: { certificate_file: 'finished.png' } }));
  expect(onSaved).toHaveBeenCalledWith({ certificate_file: 'finished.png' });
});

test('unavailable editing data shows a recovery message and never enables save', async () => {
  api.get.mockRejectedValue({ response: { data: { error: 'Certificate not found.' } } }); await render();
  expect(container.querySelector('[role="alert"]').textContent).toContain('找不到海報。');
  expect(button("儲存變更").disabled).toBe(true); expect(api.post).not.toHaveBeenCalled();
});


test('pinch scales around the fingers and includes two-finger panning', () => {
  const bounds = { left: 0, top: 0, width: 180, height: 318.4 };
  const initial = [{ x: 70, y: 198.4 }, { x: 110, y: 198.4 }];
  const centered = pinchPlacement(manifest, DEFAULT_PLACEMENT, initial, [{ x: 60, y: 198.4 }, { x: 120, y: 198.4 }], bounds);
  expect(centered.scale).toBeCloseTo(1.5);
  expect(centered.offset_x).toBeCloseTo(0); expect(centered.offset_y).toBeCloseTo(0);
  const moved = pinchPlacement(manifest, DEFAULT_PLACEMENT, initial, [{ x: 70, y: 188.4 }, { x: 130, y: 188.4 }], bounds);
  expect(moved.scale).toBeCloseTo(1.5);
  expect(moved.offset_x).toBeCloseTo(10/180); expect(moved.offset_y).toBeCloseTo(-10/318.4);
  const maximum = pinchPlacement(manifest, DEFAULT_PLACEMENT, initial, [{ x: -900, y: 198.4 }, { x: 1100, y: 198.4 }], bounds);
  expect(maximum.scale).toBe(2.5);
});

test('lifting one finger after pinching continues the drag without jumping', async () => {
  await render();
  const canvas = container.querySelector('canvas');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 180, height: 318.4 });
  canvas.setPointerCapture = jest.fn(); canvas.hasPointerCapture = () => true; canvas.releasePointerCapture = jest.fn();
  const point = (pointerId, clientX, clientY) => ({ pointerId, pointerType: 'touch', button: 0, clientX, clientY });
  act(() => {
    Simulate.pointerDown(canvas, point(1, 70, 198.4)); Simulate.pointerDown(canvas, point(2, 110, 198.4));
    Simulate.pointerMove(canvas, point(1, 60, 198.4)); Simulate.pointerMove(canvas, point(2, 120, 198.4));
    Simulate.pointerUp(canvas, point(2, 120, 198.4));
    Simulate.pointerMove(canvas, point(1, 70, 208.4)); Simulate.pointerUp(canvas, point(1, 70, 208.4));
  });
  expect(container.querySelector('output').textContent).toBe('150%');
  await act(async () => Simulate.click(button("儲存變更")));
  const saved = api.post.mock.calls[0][1].transform;
  expect(saved.scale).toBeCloseTo(1.5);
  expect(saved.offset_x).toBeCloseTo(10/180); expect(saved.offset_y).toBeCloseTo(10/318.4);
});

test('quick size controls use the latest touch state and respect zoom limits', async () => {
  await render();
  act(() => { for (let index=0; index<35; index++) Simulate.click(button("放大肖像照")); });
  expect(container.querySelector('output').textContent).toBe('250%');
  expect(button("放大肖像照").disabled).toBe(true);
  act(() => { for (let index=0; index<50; index++) Simulate.click(button("縮小肖像照")); });
  expect(container.querySelector('output').textContent).toBe('25%');
  expect(button("縮小肖像照").disabled).toBe(true);
});

test('mobile fine controls start collapsed and save stays outside the scrolling body', async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = () => ({ matches: true });
  try {
    await render();
    expect(container.querySelector('details').open).toBe(false);
    expect(button("儲存變更").closest('footer')).not.toBeNull();
    expect(button("取消").closest('.portrait-editor-body')).toBeNull();
  } finally { window.matchMedia = originalMatchMedia; }
});
