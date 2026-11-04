import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import UserPortal from './UserPortalNew';
import api from '../api';

jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  API_URL: '/prudential-api',
  errorMessage: jest.requireActual('../api').errorMessage
}));

let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
  jest.clearAllMocks();
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.useRealTimers(); });
const render = async component => { await act(async () => root.render(<MemoryRouter>{component}</MemoryRouter>)); };

test('administrator login uses server authentication and displays a rejected login', async () => {
  api.post.mockRejectedValue({ response: { data: { error: 'Invalid username or password.' } } });
  await render(<AdminLogin />);
  const [username, password] = container.querySelectorAll('input');
  act(() => { Simulate.change(username, { target: { value: 'admin' } }); Simulate.change(password, { target: { value: 'wrong' } }); });
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(api.post).toHaveBeenCalledWith('/prudential-api/auth/login', { username: 'admin', password: 'wrong' });
  expect(container.textContent).toContain('使用者名稱或密碼不正確。');
  expect(container.textContent).not.toContain('Default Credentials');
  expect(localStorage.getItem('adminAuth')).toBeNull();
});

test('system availability has a loading state and a retry after failure', async () => {
  let reject;
  api.get.mockReturnValue(new Promise((resolve, rejectPromise) => { reject = rejectPromise; }));
  await render(<UserPortal />);
  expect(container.textContent).toContain('正在檢查系統狀態');
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => reject(new Error('offline')));
  log.mockRestore();
  expect(container.textContent).toContain("系統尚未準備就緒");
  api.get.mockResolvedValue({ data: { ready: true } });
  await act(async () => Simulate.click(container.querySelector('button')));
  expect(container.textContent).toContain("輸入客戶編號");
});

test('an old client-code response cannot validate a newly changed code', async () => {
  jest.useFakeTimers();
  let resolveLookup;
  api.get.mockImplementation(url => url.endsWith('/user/check-system')
    ? Promise.resolve({ data: { ready: true } })
    : new Promise(resolve => { resolveLookup = resolve; }));
  await render(<UserPortal />);
  const input = container.querySelector('input');
  act(() => Simulate.change(input, { target: { value: '00001' } }));
  await act(async () => jest.advanceTimersByTime(500));
  act(() => Simulate.change(input, { target: { value: '00002' } }));
  await act(async () => resolveLookup({ data: { exists: true, message: 'Old agent' } }));
  expect(container.textContent).not.toContain('Old agent');
  const next = [...container.querySelectorAll('button')].find(button => button.textContent.includes("下一步"));
  expect(next.disabled).toBe(true);
});

test('administrator upload errors remain visible after uploading finishes', async () => {
  api.get.mockResolvedValue({ data: { backgrounds: {}, badges: {}, nametags: {}, layers: {}, csv: false } });
  api.post.mockRejectedValue({ response: { data: { error: 'Image is corrupt.' } } });
  await render(<AdminDashboard />);
  const upload = container.querySelector('input[type="file"][accept="image/png,image/jpeg"]');
  await act(async () => Simulate.change(upload, { target: { files: [new File(['bad'], 'image.png', { type: 'image/png' })] } }));
  expect(container.querySelector('[role="alert"]').textContent).toContain('圖片已損壞。');
});

test('photo guidance and requirements are visible in Chinese before choosing a file', async () => {
  jest.useFakeTimers();
  api.get.mockImplementation(url => Promise.resolve({ data: url.endsWith('/user/check-system')
    ? { ready: true } : { exists: true, message: 'Client code found.' } }));
  await render(<UserPortal />);
  act(() => Simulate.change(container.querySelector('input'), { target: { value: '12345678' } }));
  await act(async () => jest.advanceTimersByTime(500));
  expect(container.textContent).toContain('已找到客戶編號。');
  expect(container.textContent).not.toContain('Client code found.');
  await act(async () => Simulate.click(container.querySelector('button')));
  expect(container.querySelector('#photo-upload-guidance').textContent).toBe('請上載清晰半身職業照，面部清楚可見。');
  expect(container.querySelector('#photo-upload-requirements').textContent).toContain('少於 50 MB');
  expect(container.querySelector('#photo-upload-requirements').textContent).toContain('1,000 × 1,500 像素');
  expect(container.querySelector('#file-upload').files).toHaveLength(0);
  expect(container.querySelector('#file-upload').accept).toBe('image/png,image/jpeg');
});
