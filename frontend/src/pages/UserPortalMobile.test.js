import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import UserPortal from './UserPortalNew';
import api from '../api';

jest.mock('../api', () => ({
  __esModule: true, default: { get: jest.fn(), post: jest.fn() }, API_URL: '/prudential-api',
  errorMessage: jest.requireActual('../api').errorMessage
}));

let root, container, originalImage, images, mediaDescriptor, originalCreate, originalRevoke;
const button = name => [...container.querySelectorAll('button')].find(element => element.textContent.trim() === name || element.getAttribute('aria-label') === name);
const stream = () => { const stop = jest.fn(); return { getTracks: () => [{ stop }], stop }; };

beforeEach(async () => {
  jest.useFakeTimers();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  api.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/user/check-system') ? { ready: true } : { exists: true } }));
  originalImage = global.Image;
  images = [];
  global.Image = class {
    constructor() { this.naturalWidth = 1200; this.naturalHeight = 1800; images.push(this); }
    set src(value) { this.url = value; }
  };
  originalCreate = URL.createObjectURL;
  originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(() => `blob:photo-${URL.createObjectURL.mock.calls.length}`);
  URL.revokeObjectURL = jest.fn();
  mediaDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: jest.fn() } });
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => root.render(<UserPortal />));
  act(() => Simulate.change(container.querySelector('#client-code'), { target: { value: 'TEST-AGENT' } }));
  await act(async () => jest.advanceTimersByTime(500));
  await act(async () => Simulate.click(button('下一步：上傳照片 →')));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  global.Image = originalImage;
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
  if (mediaDescriptor) Object.defineProperty(navigator, 'mediaDevices', mediaDescriptor);
  else delete navigator.mediaDevices;
  jest.restoreAllMocks(); jest.clearAllMocks(); jest.useRealTimers();
});

const choose = async name => {
  const file = new File(['test-image'], name, { type: 'image/png' });
  await act(async () => Simulate.change(container.querySelector('#file-upload'), { target: { files: [file], value: name } }));
  return file;
};
const readyCamera = video => {
  Object.defineProperties(video, { videoWidth: { configurable: true, value: 720 }, videoHeight: { configurable: true, value: 1280 }, readyState: { configurable: true, value: 2 } });
  act(() => Simulate.loadedData(video));
};

test('camera receives a facing-mode string and releases a late permission result after cancel', async () => {
  let finish;
  navigator.mediaDevices.getUserMedia.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await act(async () => Simulate.click(button('使用相機拍照')));
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } });
  expect(button('拍照').disabled).toBe(true);
  act(() => Simulate.click(button('取消')));
  const late = stream(); await act(async () => finish(late));
  expect(late.stop).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(button('使用相機拍照')).toBeDefined();
});

test('camera switching stops the old stream and a cancelled switch cannot reopen the dialog', async () => {
  const first = stream(); let finish;
  navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(first).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => Simulate.click(button('使用相機拍照')));
  readyCamera(container.querySelector('video'));
  await act(async () => Simulate.click(button('切換相機')));
  expect(first.stop).toHaveBeenCalledTimes(1);
  expect(navigator.mediaDevices.getUserMedia.mock.calls[1][0].video.facingMode).toBe('environment');
  act(() => Simulate.click(button('取消')));
  const late = stream(); await act(async () => finish(late));
  expect(late.stop).toHaveBeenCalledTimes(1);
  expect(container.querySelector('video')).toBeNull();
});

test('capture waits for a frame, handles an empty encoder result, and uses a releasable JPEG preview', async () => {
  const camera = stream(); navigator.mediaDevices.getUserMedia.mockResolvedValue(camera);
  const drawImage = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ translate: jest.fn(), scale: jest.fn(), drawImage, setTransform: jest.fn() });
  const encode = jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(null));
  await act(async () => Simulate.click(button('使用相機拍照')));
  act(() => Simulate.click(button('拍照')));
  expect(drawImage).not.toHaveBeenCalled();
  readyCamera(container.querySelector('video'));
  await act(async () => Simulate.click(button('拍照')));
  expect(container.querySelector('[role="dialog"] [role="alert"]').textContent).toBe('未能拍攝照片，請重試。');
  expect(button('拍照').disabled).toBe(false);
  encode.mockImplementation(callback => callback(new Blob(['captured-jpeg'], { type: 'image/jpeg' })));
  await act(async () => Simulate.click(button('拍照')));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(container.querySelector('img[alt="您的肖像照"]').getAttribute('src')).toBe('blob:photo-1');
  expect(URL.createObjectURL.mock.calls[0][0].type).toBe('image/jpeg');
  expect(camera.stop).toHaveBeenCalledTimes(1);
  act(() => Simulate.click(button('返回')));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
});

test('a cancelled encoder callback cannot replace a newly opened camera or clear its canvas', async () => {
  navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(stream()).mockResolvedValueOnce(stream());
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ translate: jest.fn(), scale: jest.fn(), drawImage: jest.fn(), setTransform: jest.fn() });
  const callbacks = [];
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callbacks.push(callback));
  await act(async () => Simulate.click(button('使用相機拍照')));
  readyCamera(container.querySelector('video'));
  act(() => Simulate.click(button('拍照')));
  act(() => Simulate.click(button('取消')));
  await act(async () => Simulate.click(button('使用相機拍照')));
  readyCamera(container.querySelector('video'));
  act(() => Simulate.click(button('拍照')));
  act(() => callbacks[0](new Blob(['old-capture'], { type: 'image/jpeg' })));
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  expect(container.querySelector('canvas').width).toBe(720);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  act(() => callbacks[1](new Blob(['current-capture'], { type: 'image/jpeg' })));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(container.querySelector('img[alt="您的肖像照"]')).not.toBeNull();
});

test('a replaced photo decode cannot select the old file and its object URL is released', async () => {
  await choose('first.png'); const staleLoad = images[0].onload;
  await choose('second.png');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
  act(() => staleLoad());
  expect(container.querySelector('img[alt="您的肖像照"]')).toBeNull();
  act(() => images[1].onload());
  expect(container.querySelector('img[alt="您的肖像照"]').getAttribute('src')).toBe('blob:photo-2');
  act(() => Simulate.click(button('返回')));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-2');
});

test('leaving photo selection cancels a pending decode without navigating back into the preview', async () => {
  await choose('pending.png'); const staleLoad = images[0].onload;
  act(() => Simulate.click(button('返回')));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
  act(() => staleLoad());
  expect(container.querySelector('#client-code')).not.toBeNull();
  expect(container.querySelector('img[alt="您的肖像照"]')).toBeNull();
});
