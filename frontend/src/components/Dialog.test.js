import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ConfirmModal from './ConfirmModal';
import ImagePreviewModal from './ImagePreviewModal';

let container, root, trigger;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  trigger = document.createElement('button'); trigger.textContent = '開啟'; document.body.appendChild(trigger); trigger.focus();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); trigger.remove(); });

test('confirmation focuses cancel, locks background scrolling and returns focus after Escape', async () => {
  function Example() {
    const [open, setOpen] = useState(true);
    return <ConfirmModal isOpen={open} onClose={() => setOpen(false)} title="刪除紀錄" message={'很長的檔案名稱'.repeat(40)} />;
  }
  await act(async () => root.render(<Example />));
  const dialog = container.querySelector('[role="dialog"]');
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(document.activeElement.textContent).toBe('取消');
  expect(document.body.style.overflow).toBe('hidden');
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.style.overflow).toBe('');
  expect(document.activeElement).toBe(trigger);
});

test('image preview keeps keyboard focus inside its controls and restores scrolling on close', async () => {
  function Example() {
    const [image, setImage] = useState({ name: '海報.png', url: '/poster.png' });
    return <ImagePreviewModal image={image} onClose={() => setImage(null)} onDownload={() => {}} />;
  }
  await act(async () => root.render(<Example />));
  const controls = [...container.querySelectorAll('button')];
  controls.forEach(button => { button.getClientRects = () => [{ width: 44, height: 44 }]; });
  controls[1].focus();
  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  act(() => document.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(controls[0]);
  act(() => controls[0].click());
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.style.overflow).toBe('');
  expect(document.activeElement).toBe(trigger);
});
