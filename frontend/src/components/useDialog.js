import { useEffect, useRef } from 'react';

// Keep keyboard focus and scrolling inside an open overlay, including on phones.
export default function useDialog(onClose, active = true, initialFocusSelector) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active || !ref.current) return;
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    (dialog.querySelector(initialFocusSelector || 'button:not(:disabled)') || dialog).focus({ preventScroll: true });

    const handleKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current?.();
      }
      if (event.key !== 'Tab') return;
      const elements = [...dialog.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])')]
        .filter(element => element.getClientRects().length && !element.hidden);
      const first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [active, initialFocusSelector]);

  return ref;
}
