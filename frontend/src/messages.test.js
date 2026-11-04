import { localizeMessage } from './messages';
import { errorMessage } from './api';

test('localizes rejected imports while preserving row numbers and useful validation details', () => {
  const error = { response: { data: {
    error: 'Import rejected. No agents changed.',
    errors: ['Row 12: Duplicate Client Cd in this upload.', 'Row 14: MDRT Title must be MDRT, COT or TOT.']
  } } };
  expect(errorMessage(error)).toBe('匯入未獲接納，所有代理人資料均未變更。 第 12 列：此上傳檔案包含重複的客戶編號。 第 14 列：級別須為 MDRT、COT 或 TOT。');
});

test('unknown server and connection errors use a Chinese fallback without showing raw English', () => {
  expect(errorMessage({ response: { data: { error: 'An upstream dependency failed unexpectedly' } } })).toBe('無法完成操作，請重試。');
  expect(errorMessage(new Error('Network Error'), '無法登入，請重試。')).toBe('無法登入，請重試。');
  expect(localizeMessage('constructor')).toBe('無法完成操作，請重試。');
});

test('missing import columns use their display labels and Chinese server messages remain readable', () => {
  expect(localizeMessage('Missing required columns: Agent Name, Client Cd')).toBe('缺少必要欄位：代理人姓名、客戶編號。');
  expect(localizeMessage('請稍後重試。')).toBe('請稍後重試。');
});
