/**
 * Be Color 生徒・保護者ページ　データ配信用 GAS
 *
 * - サイト（GitHub Pages）からパスワード付きで呼ばれ、正しければシートの内容を JSON で返す
 * - シートを編集するとキャッシュが消え、次にページを開いたときに最新の内容が表示される
 */

const SHEET_SETTINGS = '設定';
const SHEET_TOP = 'TOP';
const PAGE_HEADERS = ['表示', '種類', '開閉の中', 'タイトル', 'サブタイトル', 'リンクURL', '画像URL', '画像比率', '色', 'メモ'];
const TYPES = ['見出し', 'ボタン', '開閉', '画像カード', 'LINEボタン', '枠ボタン', '文章'];
const COLORS = ['赤', 'オレンジ', '黄', '緑', '青', '紫', '青紫'];
const RATIOS = ['16:9', '3:2', '4:3', '1:1', '4:5', '3:4', '9:16'];
const TOP_COLORS = ['ピンク', 'ブルー', '赤', 'オレンジ', '黄', '緑', '青', '紫', '青紫'];
const CACHE_KEY = 'site-data-v1';
const IMAGE_FOLDER_NAME = 'BeColor生徒ページ_画像';

/* ---------- メニュー・トリガー ---------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('サイト管理')
    .addItem('サイトに今すぐ反映', 'clearCache')
    .addSeparator()
    .addItem('初期シートを作成（初回のみ）', 'setupSheets')
    .addItem('STUDIOの画像をドライブに移す', 'migrateImagesToDrive')
    .addToUi();
}

// シート編集のたびにキャッシュを消す（シンプルトリガー）
function onEdit() {
  CacheService.getScriptCache().remove(CACHE_KEY);
}

function clearCache() {
  CacheService.getScriptCache().remove(CACHE_KEY);
  SpreadsheetApp.getActive().toast('次にページを開いたときから最新の内容が表示されます', 'サイトに反映しました');
}

/* ---------- Web アプリ ---------- */

// ログイン画面用：パスワードなしで返してよい項目だけ
const PUBLIC_KEYS = ['サイト名', 'ヘッダー見出し', 'ロゴ画像', 'ヘッダー色', 'ログイン案内文'];

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'public') {
    const all = getSiteData_().settings;
    const settings = {};
    PUBLIC_KEYS.forEach(function (k) { if (all[k] !== undefined) settings[k] = all[k]; });
    return json_({ ok: true, settings: settings });
  }
  return ContentService.createTextOutput('OK');
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {}

  const site = getSiteData_();
  const password = String(site.settings['パスワード'] || '');
  if (!password || String(body.password || '') !== password) {
    Utilities.sleep(800); // 総当たり対策の待ち時間
    return json_({ ok: false, error: 'password' });
  }

  const settings = Object.assign({}, site.settings);
  delete settings['パスワード'];
  return json_({ ok: true, data: Object.assign({}, site, { settings: settings }) });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- シート読み込み ---------- */

function getSiteData_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const ss = SpreadsheetApp.getActive();
  const settings = {};
  readTable_(ss.getSheetByName(SHEET_SETTINGS)).forEach(function (r) {
    if (r['項目']) settings[r['項目']] = r['値'];
  });

  const top = readTable_(ss.getSheetByName(SHEET_TOP));
  const pages = {};
  top.forEach(function (area) {
    const name = area['シート名'];
    if (name && !pages[name]) pages[name] = readTable_(ss.getSheetByName(name));
  });
  // エリア分けがないサイトは、設定の「トップページ」に書いたシートを TOP に直接表示する
  const home = String(settings['トップページ'] || '').trim();
  if (home && !pages[home]) pages[home] = readTable_(ss.getSheetByName(home));

  const data = { settings: settings, top: top, pages: pages, updatedAt: new Date().toISOString() };
  try {
    cache.put(CACHE_KEY, JSON.stringify(data), 21600); // 最大6時間（編集時は即削除）
  } catch (_) {} // 100KB を超えるとキャッシュできないが、動作には影響しない
  return data;
}

function readTable_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values
    .filter(function (row) { return row.some(function (v) { return v !== '' && v !== false; }); })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (h, i) { if (h) obj[h] = row[i]; });
      return obj;
    });
}

/* ---------- 初期セットアップ ---------- */

function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  const names = [SHEET_SETTINGS].concat(SEED.top ? [SHEET_TOP] : [], Object.keys(SEED.pages));
  const existing = names.filter(function (n) { return ss.getSheetByName(n); });
  if (existing.length) {
    const res = ui.alert('すでにあるシートは作り直さずにスキップします：\n' + existing.join('、') + '\n\n続けますか？', ui.ButtonSet.OK_CANCEL);
    if (res !== ui.Button.OK) return;
  }

  if (!ss.getSheetByName(SHEET_SETTINGS)) {
    const sh = ss.insertSheet(SHEET_SETTINGS);
    writeRows_(sh, SEED.settings);
    sh.setColumnWidth(1, 140).setColumnWidth(2, 520).setColumnWidth(3, 320);
    sh.getRange(2, 2, SEED.settings.length - 1, 1).setWrap(true);
  }

  if (SEED.top && !ss.getSheetByName(SHEET_TOP)) {
    const sh = ss.insertSheet(SHEET_TOP);
    writeRows_(sh, SEED.top);
    const n = 50;
    sh.getRange(2, 1, n, 1).insertCheckboxes();
    SEED.top.slice(1).forEach(function (r, i) { sh.getRange(i + 2, 1).setValue(r[0]); });
    setList_(sh.getRange(2, 7, n, 1), RATIOS);
    setList_(sh.getRange(2, 8, n, 1), TOP_COLORS);
    sh.setColumnWidth(6, 360);
  }

  Object.keys(SEED.pages).forEach(function (name) {
    if (ss.getSheetByName(name)) return;
    const sh = ss.insertSheet(name);
    const rows = [PAGE_HEADERS].concat(SEED.pages[name]);
    writeRows_(sh, rows);
    formatPageSheet_(sh, rows.length);
  });

  const first = ss.getSheets()[0];
  if (first.getName() === 'シート1' && first.getLastRow() === 0) ss.deleteSheet(first);
  clearCache();
}

function writeRows_(sh, rows) {
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows).setVerticalAlignment('middle');
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#304FFE').setFontColor('#ffffff');
  sh.setFrozenRows(1);
}

function setList_(range, list) {
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build());
}

function formatPageSheet_(sh, dataRows) {
  const n = Math.max(dataRows + 100, 200);
  if (sh.getMaxRows() < n) sh.insertRowsAfter(sh.getMaxRows(), n - sh.getMaxRows());

  // チェックボックスは値を保ったまま付ける
  [1, 3].forEach(function (col) {
    const range = sh.getRange(2, col, n - 1, 1);
    const vals = range.getValues();
    range.insertCheckboxes();
    range.setValues(vals.map(function (v) { return [v[0] === true]; }));
  });
  setList_(sh.getRange(2, 2, n - 1, 1), TYPES);
  setList_(sh.getRange(2, 8, n - 1, 1), RATIOS);
  setList_(sh.getRange(2, 9, n - 1, 1), COLORS);

  [60, 100, 70, 220, 200, 320, 320, 80, 80, 220].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(2, 4, n - 1, 2).setWrap(true);

  const all = sh.getRange(2, 1, n - 1, PAGE_HEADERS.length);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$A2=FALSE').setFontColor('#aaaaaa').setBackground('#f3f3f3').setRanges([all]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$B2="見出し"').setBackground('#FFE0E6').setBold(true).setRanges([all]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$B2="開閉"').setBackground('#FFF4D6').setRanges([all]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$C2=TRUE').setBackground('#F7F9FF').setRanges([sh.getRange(2, 4, n - 1, 7)]).build(),
  ]);
}

/* ---------- STUDIO の画像をドライブへ移す ---------- */

function migrateImagesToDrive() {
  const ss = SpreadsheetApp.getActive();
  const folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(IMAGE_FOLDER_NAME);
  const done = {}; // 同じ画像は1回だけ保存
  let count = 0;

  function move(url, label) {
    if (typeof url !== 'string' || url.indexOf('studio-design-asset-files') < 0) return null;
    if (done[url]) return done[url];
    const blob = UrlFetchApp.fetch(url).getBlob();
    const ext = (url.match(/\.(\w+)(\?|$)/) || [])[1] || 'jpg';
    const file = folder.createFile(blob).setName(String(label).replace(/\n/g, ' ').slice(0, 60) + '.' + ext);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    done[url] = 'https://drive.google.com/file/d/' + file.getId() + '/view';
    count++;
    return done[url];
  }

  // 設定シートのロゴ
  const st = ss.getSheetByName(SHEET_SETTINGS);
  let home = '';
  if (st) {
    const v = st.getDataRange().getValues();
    v.forEach(function (row, i) {
      if (row[0] === 'トップページ') home = String(row[1]).trim();
      if (row[0] === 'ロゴ画像') {
        const u = move(row[1], 'ロゴ');
        if (u) st.getRange(i + 1, 2).setValue(u);
      }
    });
  }

  // TOP とエリアの各シート
  const targets = [[SHEET_TOP, 'エリア名']];
  readTable_(ss.getSheetByName(SHEET_TOP)).forEach(function (a) { if (a['シート名']) targets.push([a['シート名'], 'タイトル']); });
  if (home) targets.push([home, 'タイトル']);
  targets.forEach(function (t) {
    const sh = ss.getSheetByName(t[0]);
    if (!sh) return;
    const values = sh.getDataRange().getValues();
    const head = values[0];
    const imgCol = head.indexOf('画像URL');
    const labelCol = head.indexOf(t[1]);
    if (imgCol < 0) return;
    for (let r = 1; r < values.length; r++) {
      const u = move(values[r][imgCol], t[0] + '_' + values[r][labelCol]);
      if (u) sh.getRange(r + 1, imgCol + 1).setValue(u);
    }
  });

  clearCache();
  SpreadsheetApp.getUi().alert(count + ' 枚の画像をドライブの「' + IMAGE_FOLDER_NAME + '」フォルダに保存し、URLを置き換えました。');
}
