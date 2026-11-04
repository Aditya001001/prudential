import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import PosterPreview from './PosterPreview';

let root, container, ready, view;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container); ready = jest.fn(); view = jest.fn();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = async file => { await act(async () => root.render(<PosterPreview key={file} src={`/preview/${file}?t=1`} updated onReady={ready} onView={view} />)); };
const load = async () => { await act(async () => Simulate.load(container.querySelector('img'))); };

test('a newly saved poster hides the original until the new image loads', async () => {
  await render('original.png'); await load();
  const original = container.querySelector('img');
  expect(original.style.display).toBe('');
  await render('edited.png');
  expect(original.isConnected).toBe(false);
  expect(container.querySelector('img').style.display).toBe('none');
  expect(container.textContent).toContain('正在載入更新後的海報');
  expect(container.querySelector('[aria-label="查看海報原圖"]')).toBeNull();
  await load();
  expect(container.querySelector('img').style.display).toBe('');
  expect(container.querySelector('[role="status"]')).toBeNull();
  expect(ready).toHaveBeenLastCalledWith(true);
});

test('preview is not marked ready until decoding the PNG finishes', async () => {
  await render('edited.png');
  let decode;
  container.querySelector('img').decode = () => new Promise(resolve => { decode = resolve; });
  await load();
  expect(ready).not.toHaveBeenCalled();
  expect(container.querySelector('img').style.display).toBe('none');
  await act(async () => decode());
  expect(ready).toHaveBeenCalledWith(true);
  expect(container.querySelector('img').style.display).toBe('');
});

test('a late image decode from a previous revision cannot mark the new preview ready', async () => {
  await render('original.png');
  let decode;
  container.querySelector('img').decode = () => new Promise(resolve => { decode = resolve; });
  await load(); await render('edited.png');
  await act(async () => decode());
  expect(ready).not.toHaveBeenCalled();
  expect(container.querySelector('img').style.display).toBe('none');
  await load(); expect(ready).toHaveBeenCalledWith(true);
});

test('failed preview can retry without saving the poster again', async () => {
  await render('edited.png'); const previous = container.querySelector('img').src;
  act(() => Simulate.error(container.querySelector('img')));
  expect(container.querySelector('[role="alert"]').textContent).toContain('變更已儲存');
  expect(ready).toHaveBeenLastCalledWith(false);
  act(() => Simulate.click(container.querySelector('button')));
  expect(container.querySelector('img').src).not.toBe(previous);
  expect(container.textContent).toContain('正在載入更新後的海報');
  await load(); expect(ready).toHaveBeenLastCalledWith(true);
});
