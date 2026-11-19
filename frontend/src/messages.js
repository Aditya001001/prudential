// Translate API messages when displayed, preserving protocol fields and uploaded data.
const messages = {
  'Invalid username or password.': '使用者名稱或密碼不正確。',
  'Invalid credentials.': '登入資料無效。',
  'Administrator sign-in required.': '請先以管理員身分登入。',
  'Session expired. Refresh the page and try again.': '登入狀態已過期，請重新整理頁面後再試。',
  'Too many requests. Please try again later.': '操作過於頻繁，請稍後再試。',
  'An unexpected error occurred. Please try again.': '發生未預期的錯誤，請重試。',
  'Unable to complete request.': '無法完成操作，請重試。',
  'Unable to complete the request. Please try again.': '無法完成操作，請重試。',
  'Invalid pagination.': '分頁參數無效。',
  'Page must be positive; per_page must be 1-100.': '頁碼必須大於零，每頁筆數須介乎 1 至 100。',
  'Limit must be 1-100.': '筆數須介乎 1 至 100。',
  'Dates must use YYYY-MM-DD.': '請以年－月－日格式輸入日期。',
  'Provide at least one recognized asset.': '請選擇至少一項支援的素材。',
  'Background dimensions must be at least 300 pixels.': '背景圖片的寬度及高度均須至少為 300 像素。',
  'Upload a PNG or JPEG image.': '請上傳 PNG 或 JPEG 圖片。',
  'Image resolution exceeds 25 megapixels. Reduce its dimensions and try again.': '圖片解像度超過 2,500 萬像素，請縮小圖片尺寸後再上傳。檔案容量較小並不代表解像度符合限制。',
  'Image resolution exceeds the 50 megapixel processing limit.': '圖片解像度超過 5,000 萬像素的安全處理上限，請先縮小圖片尺寸後再上傳。',
  'Photo could not be compressed below the 5 MB storage limit. Please use a simpler image.': '圖片無法在保留足夠品質下壓縮至 5 MB，請選擇較小或較簡單的照片。',
  'Photo upload exceeds the 5 MB limit.': '檔案容量超過 5 MB 上限，請選擇較小的照片後再試。',
  'Image cannot be decoded. Export a new PNG or JPEG and try again.': '無法讀取圖片內容，檔案可能已損壞或編碼不受支援。請重新匯出為 PNG 或 JPEG 後再上傳。',
  'Image must be PNG/JPEG and no larger than 25 megapixels.': '圖片須為 PNG 或 JPEG 格式，且不可超過 2,500 萬像素。',
  'The uploaded image is corrupt or too large.': '上傳的圖片已損壞或過大。',
  'Image is corrupt.': '圖片已損壞。',
  'Invalid filename.': '檔案名稱無效。',
  'Upload a CSV, XLSX or XLS file.': '請上傳 CSV、XLSX 或 XLS 檔案。',
  'Excel workbook is too large when decompressed.': 'Excel 活頁簿解壓縮後過大，請減少資料量。',
  'Invalid XLSX workbook.': 'XLSX 活頁簿無效。',
  'Master data must contain between 1 and 50,000 agents.': '主資料須包含 1 至 50,000 位代理人。',
  'Duplicate Client Cd in this upload.': '此上傳檔案包含重複的客戶編號。',
  'Client Cd must contain 1-20 letters, digits, underscores or hyphens.': '客戶編號須包含 1 至 20 個英文字母、數字、底線或連字號。',
  'Agent Name must contain 1-200 characters.': '代理人姓名須包含 1 至 200 個字元。',
  'Agent Name contains control characters.': '代理人姓名包含不支援的控制字元。',
  'MDRT Title must be MDRT, COT or TOT.': '級別須為 MDRT、COT 或 TOT。',
  'Import rejected. No agents changed.': '匯入未獲接納，所有代理人資料均未變更。',
  'Agent not found': '找不到代理人資料。',
  'No photo provided.': '請先選擇照片。',
  'Client code not found.': '找不到客戶編號，請檢查後重試。',
  'Client code found.': '已找到客戶編號。',
  'Unable to validate client code.': '無法驗證客戶編號，請重試。',
  'The generator is busy. Please try again shortly.': '海報產生器正忙碌，請稍後再試。',
  'The generation queue is full. Please try again shortly.': '目前等候處理的海報較多，請稍後再試。',
  'You already have photos waiting to be processed. Please wait for them to finish.': '您已有照片正在等候處理，請等待完成後再上傳。',
  'The generation queue is temporarily unavailable. Please try again later.': '海報處理服務暫時無法使用，請稍後再試。',
  'Generation request not found.': '找不到海報處理請求，請重新上傳照片。',
  'The queued photo is no longer available. Please upload it again.': '等候處理的照片已無法使用，請重新上傳。',
  'Unable to generate the poster. Please try again with another photo.': '無法產生海報，請選擇其他照片後重試。',
  'Photo must be at least 100 pixels wide and high.': '照片的寬度及高度均須至少為 100 像素。',
  'No subject detected. Please upload a clearer portrait.': '未能偵測到人像，請上傳較清晰的肖像照。',
  'Agent name is too long for the certificate.': '代理人姓名過長，無法完整顯示於海報。',
  'Certificate not found.': '找不到海報。',
  'The portrait adjustment files are no longer available.': '肖像照調整檔案已無法使用，請重新產生海報。',
  'Photo adjustments are available for newly generated certificates. Please generate a new certificate.': '僅新產生的海報支援肖像照調整，請重新產生海報。',
  'Portrait adjustment data is unavailable.': '肖像照調整資料無法使用，請重新產生海報。',
  'Provide the current certificate revision.': '請重新開啟編輯器以載入海報的最新版本。',
  'This certificate has changed. Reopen the editor to load its latest position.': '此海報已更新，請重新開啟編輯器以載入最新位置。',
  'Provide portrait size and horizontal/vertical position.': '請提供肖像照大小及水平、垂直位置。',
  'Portrait size must be 25–250%; position must remain within the adjustment range.': '肖像照大小須介乎 25% 至 250%，位置須在可調整範圍內。',
  'Keep part of your portrait inside the certificate.': '請將肖像照的部分範圍保留在海報內。',
  'The data value transmitted exceeds the capacity limit.': '檔案過大，使用者照片不得超過 5 MB。',
  'The browser (or proxy) sent a request that this server could not understand.': '請求內容無效，請檢查後重試。',
  'The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again.': '找不到所需的內容，請重新整理頁面後再試。',
};

const fieldNames = {
  'Client Cd': '客戶編號', 'Agent Name': '代理人姓名', 'MDRT Title': '級別',
  life_member: '終身會員', honor_roll: '榮譽榜', quarter_century: '四分之一世紀會員',
};

export function localizeMessage(message, fallback = '無法完成操作，請重試。') {
  if (typeof message !== 'string' || !message.trim()) return fallback;
  if (Object.prototype.hasOwnProperty.call(messages, message)) return messages[message];
  const fileSize = message.match(/^Photo file size (\d+(?:\.\d+)?) MB exceeds the 5 MB limit\.$/);
  if (fileSize) return `檔案容量為 ${fileSize[1]} MB，超過 5 MB 上限。請選擇較小的照片後再試。`;
  const resolution = message.match(/^Image resolution (\d+)x(\d+) exceeds(?: the)? (\d+) megapixel(?: processing)? limit\.$/);
  if (resolution) {
    const width = Number(resolution[1]), height = Number(resolution[2]), limit = Number(resolution[3]);
    return `圖片尺寸為 ${width.toLocaleString('zh-HK')} × ${height.toLocaleString('zh-HK')} 像素（約 ${(width * height / 1000000).toFixed(1)} 百萬像素），超過 ${(limit * 100).toLocaleString('zh-HK')} 萬像素的安全處理上限。請縮小圖片尺寸後再上傳。`;
  }
  const row = message.match(/^Row (\d+): (.*)$/s);
  if (row) return `第 ${row[1]} 列：${localizeMessage(row[2], '資料格式無效，請檢查後重試。')}`;
  if (message.startsWith('Missing required columns: ')) {
    const fields = message.slice('Missing required columns: '.length).split(',').map(value => fieldNames[value.trim()] || '必要欄位');
    return `缺少必要欄位：${fields.join('、')}。`;
  }
  const boolean = message.match(/^(\w+) must be a boolean\.$/);
  if (boolean) return `${fieldNames[boolean[1]] || '此欄位'}須為是或否。`;
  const badge = message.match(/^Invalid (LM|HR|QC) value:/);
  if (badge) return `${badge[1]} 徽章值無效，請使用徽章代碼、Yes／No、True／False、1／0 或留空。`;
  if (/^[\u3400-\u9fff]/.test(message.trim())) return message;
  return fallback;
}
