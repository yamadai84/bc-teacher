(function () {
  'use strict';

  const GAS_URL = (window.BC_CONFIG && window.BC_CONFIG.GAS_URL || '').trim();
  const DEMO = !GAS_URL && !!window.BC_SEED; // プレビュー用。公開サイトには BC_SEED を置かない
  // 生徒用・講師用は同じドメインなので、保存キーはサイトのパスごとに分ける
  const KEY = 'bc:' + location.pathname.replace(/index\.html$/, '') + ':';
  const PW_KEY = KEY + 'pw';
  const DATA_KEY = KEY + 'data';
  const PUBLIC_KEY = KEY + 'public';
  const LOGO = 'logo.png';
  const app = document.getElementById('app');

  /* ---------- ストレージ（使えない環境でも動くように） ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };

  /* ---------- ユーティリティ ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function on(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1; }

  // ドライブの共有リンク → 画像として表示できる URL
  function imgUrl(u) {
    u = str(u);
    const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?id=)([\w-]{20,})/) ||
              u.match(/docs\.google\.com\/[^?]*\?(?:[^#]*&)?id=([\w-]{20,})/);
    return m ? 'https://lh3.googleusercontent.com/d/' + m[1] + '=w1200' : u;
  }
  function ratio(v, fallback) {
    const m = str(v).replace('：', ':').match(/^(\d+(?:\.\d+)?)\s*[:/×x]\s*(\d+(?:\.\d+)?)$/);
    return m ? m[1] + ' / ' + m[2] : fallback;
  }
  function safeHref(u) {
    u = str(u);
    return /^(https?:|mailto:|tel:|#)/i.test(u) ? u : 'https://' + u;
  }
  // 「生徒・保護者 専用ページ」→ 末尾の「専用ページ」だけアクセント色に
  function titleHtml(t) {
    const m = t.match(/^(.*?)(専用ページ|ページ)$/);
    return m && m[1] ? esc(m[1]) + '<span>' + esc(m[2]) + '</span>' : esc(t);
  }
  function siteTitle(s) { return str(s['ヘッダー見出し']) || '専用ページ'; }

  /* ---------- データ取得 ---------- */
  function demoData() {
    const S = window.BC_SEED;
    const toObjs = (rows, head) => rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
    const settings = {};
    S.settings.slice(1).forEach(r => { if (r[0] !== 'パスワード') settings[r[0]] = r[1]; });
    const pageHead = ['表示', '種類', '開閉の中', 'タイトル', 'サブタイトル', 'リンクURL', '画像URL', '画像比率', '色', 'メモ'];
    const pages = {};
    Object.keys(S.pages).forEach(k => { pages[k] = toObjs(S.pages[k], pageHead); });
    return { settings, top: S.top ? toObjs(S.top.slice(1), S.top[0]) : [], pages };
  }

  // ログイン画面用のサイト名・見出し（パスワード不要）
  function cachedPublic() {
    try { return JSON.parse(store.get(PUBLIC_KEY) || 'null') || {}; } catch (_) { return {}; }
  }
  async function fetchPublic() {
    try {
      const res = await fetch(GAS_URL + '?action=public');
      const json = await res.json();
      if (json.ok) {
        store.set(PUBLIC_KEY, JSON.stringify(json.settings));
        return json.settings;
      }
    } catch (_) {}
    return null;
  }

  async function fetchData(password) {
    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ password }) });
    if (!res.ok) throw new Error('network');
    return res.json();
  }

  /* ---------- 描画 ---------- */
  function header(settings) {
    return `<div class="top"><div class="rainbow"></div><header>
      <a class="logo-link" href="#"><img class="logo" src="${LOGO}" alt="Be Color"></a>
      <h1>${titleHtml(siteTitle(settings))}</h1>
      ${DEMO ? '' : '<button class="ghost" type="button" data-logout>ログアウト</button>'}
    </header></div>`;
  }
  function note(settings) {
    const t = str(settings['説明文']);
    return t ? `<p class="view-note">${esc(t)}</p>` : '';
  }
  function label(r) {
    const sub = str(r['サブタイトル']);
    return `<span class="item-label"><span class="item-title">${esc(str(r['タイトル']))}</span>${sub ? `<span class="item-sub">${esc(sub)}</span>` : ''}</span>`;
  }
  function wrap(r, cls, inner) {
    if (!str(r['リンクURL'])) return `<div class="item ${cls}">${inner}<span class="tag">準備中</span></div>`;
    return `<a class="item ${cls}" href="${esc(safeHref(r['リンクURL']))}" target="_blank" rel="noopener">${inner}<span class="arrow">→</span></a>`;
  }

  function renderItem(r) {
    switch (str(r['種類'])) {
      case 'ボタン':
      case '枠ボタン':
        return wrap(r, '', label(r));
      case 'LINEボタン':
        return wrap(r, 'line', `<span class="tag">LINE</span>` + label(r));
      case '画像カード': {
        const src = imgUrl(r['画像URL']);
        const img = src ? `<img class="card-img" src="${esc(src)}" alt="" loading="lazy" style="--ratio:${ratio(r['画像比率'], '16 / 9')}">` : '';
        const href = str(r['リンクURL']);
        const foot = `<span class="card-foot">${label(r)}${href ? '<span class="arrow">→</span>' : '<span class="tag">準備中</span>'}</span>`;
        return href
          ? `<a class="item card" href="${esc(safeHref(href))}" target="_blank" rel="noopener">${img}${foot}</a>`
          : `<div class="item card">${img}${foot}</div>`;
      }
      case '文章':
        return `<p class="text">${esc(str(r['タイトル']))}</p>`;
      default:
        return '';
    }
  }

  // シートの行 → HTML。見出しごとにカードのグリッドを作り、「開閉の中」の行は直前の開閉にまとめる
  function renderRows(rows) {
    let html = '';
    let grid = '';
    let gridKind = '';
    let fold = null;
    const flushFold = () => {
      if (!fold) return;
      grid += `<details class="fold"><summary>${label(fold.row)}</summary><div class="fold-body grid">${fold.body}</div></details>`;
      fold = null;
    };
    const flushGrid = () => {
      flushFold();
      if (grid) html += `<div class="grid">${grid}</div>`;
      grid = '';
    };

    rows.filter(r => on(r['表示'])).forEach(r => {
      const type = str(r['種類']);
      if (fold && on(r['開閉の中']) && type !== '開閉' && type !== '見出し') {
        fold.body += renderItem(r);
        return;
      }
      flushFold();
      if (type === '見出し') {
        flushGrid();
        html += `<h2 class="section-title">${esc(str(r['タイトル']))}</h2>`;
      } else if (type === '開閉') {
        fold = { row: r, body: '' };
      } else {
        // 画像カードとボタンは高さが違うので、種類が変わったら行を分ける
        const kind = type === '画像カード' ? 'card' : 'link';
        if (grid && kind !== gridKind && !/<\/details>$/.test(grid)) flushGrid();
        gridKind = kind;
        grid += renderItem(r);
      }
    });
    flushGrid();
    return html;
  }

  function areas(data) {
    return (data.top || []).filter(a => on(a['表示']));
  }
  function areaSlug(a) {
    return str(a['URL名']) || str(a['シート名']);
  }
  function tabs(data, current) {
    const list = areas(data);
    if (list.length < 2) return '';
    return `<nav class="tabs"><a href="#"${current ? '' : ' class="active"'}>TOP</a>` +
      list.map(a => `<a href="#${esc(encodeURIComponent(areaSlug(a)))}"${a === current ? ' class="active"' : ''}>${esc(str(a['エリア名']))}</a>`).join('') +
      '</nav>';
  }

  function renderTop(data) {
    const cards = areas(data).map(a => {
      const src = imgUrl(a['画像URL']);
      return `<a class="area" href="#${esc(encodeURIComponent(areaSlug(a)))}">
        ${src ? `<img class="area-img" src="${esc(src)}" alt="" style="--ratio:${ratio(a['画像比率'], '3 / 2')}">` : ''}
        <span class="area-foot"><span class="area-name">${esc(str(a['エリア名']))}</span><span class="area-sub">${esc(str(a['サブ']))}</span><span class="arrow">→</span></span>
      </a>`;
    }).join('');
    return header(data.settings) + `<main>${tabs(data, null)}${note(data.settings)}<div class="areas">${cards}</div></main>`;
  }

  function renderArea(data, area) {
    const rows = (data.pages || {})[str(area['シート名'])] || [];
    return header(data.settings) + `<main>${tabs(data, area)}${note(data.settings)}${renderRows(rows)}</main>`;
  }

  // エリア分けがないサイト：トップページのシートをそのまま表示
  function renderHome(data, sheet) {
    return header(data.settings) + `<main>${note(data.settings)}${renderRows((data.pages || {})[sheet] || [])}</main>`;
  }

  function renderLogin(settings, error) {
    settings = Object.assign(cachedPublic(), settings || {});
    document.title = str(settings['サイト名']) || document.title;
    app.innerHTML = `<div class="login">
        <img class="logo" src="${LOGO}" alt="Be Color DOUBLE DUTCH SCHOOL">
        <h1>${titleHtml(siteTitle(settings))}</h1>
        <p>${esc(str(settings['ログイン案内文']) || 'パスワードを入力してください')}</p>
        <form>
          <input type="password" name="password" autocomplete="current-password" placeholder="パスワード" required>
          <button type="submit">ログイン</button>
          <div class="error" role="alert">${esc(error || '')}</div>
        </form>
      </div>`;
    const box = app.querySelector('.login');
    const form = box.querySelector('form');
    form.password.focus();
    if (!DEMO && !error) {
      // 最新の見出し・案内文を取得して、入力中の内容はそのままに差し替える
      fetchPublic().then(s => {
        if (!s || !form.isConnected) return;
        box.querySelector('h1').innerHTML = titleHtml(siteTitle(s));
        box.querySelector('p').textContent = str(s['ログイン案内文']) || 'パスワードを入力してください';
        document.title = str(s['サイト名']) || document.title;
      });
    }
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const pw = form.password.value;
      const btn = form.querySelector('button');
      btn.disabled = true;
      btn.textContent = '確認中…';
      try {
        const res = await fetchData(pw);
        if (res.ok) {
          store.set(PW_KEY, pw);
          store.set(DATA_KEY, JSON.stringify(res.data));
          state.data = res.data;
          route();
        } else {
          renderLogin(settings, 'パスワードが違います');
        }
      } catch (_) {
        renderLogin(settings, '通信に失敗しました。時間をおいて再度お試しください');
      }
    });
  }

  /* ---------- ルーティング ---------- */
  const state = { data: null };

  function route() {
    const data = state.data;
    if (!data) return;
    const slug = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const area = slug && areas(data).find(a => areaSlug(a) === slug);
    const home = str(data.settings['トップページ']);
    const site = str(data.settings['サイト名']) || document.title;
    document.title = area ? site + '｜' + str(area['エリア名']) : site;
    app.innerHTML = area ? renderArea(data, area) : home ? renderHome(data, home) : renderTop(data);
    window.scrollTo(0, 0);
  }

  app.addEventListener('click', e => {
    if (e.target.closest('[data-logout]')) {
      store.del(PW_KEY);
      store.del(DATA_KEY);
      state.data = null;
      history.replaceState(null, '', location.pathname);
      renderLogin(cachedPublic());
    }
  });
  window.addEventListener('hashchange', route);

  async function init() {
    if (DEMO) {
      state.data = demoData();
      route();
      return;
    }
    if (!GAS_URL) {
      app.innerHTML = '<p class="loading">config.js に GAS の URL が設定されていません</p>';
      return;
    }
    const pw = store.get(PW_KEY);
    let cached = null;
    try { cached = JSON.parse(store.get(DATA_KEY) || 'null'); } catch (_) {}

    if (!pw) {
      renderLogin(cached ? cached.settings : cachedPublic());
      return;
    }
    // 前回のデータですぐ表示 → 裏で最新を取得して差し替え
    if (cached) {
      state.data = cached;
      route();
    }
    try {
      const res = await fetchData(pw);
      if (res.ok) {
        const fresh = JSON.stringify(res.data);
        store.set(DATA_KEY, fresh);
        const changed = !cached || JSON.stringify(cached) !== fresh;
        state.data = res.data;
        if (changed) {
          const openIdx = [...app.querySelectorAll('details.fold')].map((d, i) => d.open ? i : -1).filter(i => i >= 0);
          const y = window.scrollY;
          route();
          app.querySelectorAll('details.fold').forEach((d, i) => { if (openIdx.includes(i)) d.open = true; });
          window.scrollTo(0, y);
        }
      } else {
        // パスワードが変更された
        store.del(PW_KEY);
        store.del(DATA_KEY);
        renderLogin(cached ? cached.settings : {}, 'パスワードが変更されました。新しいパスワードを入力してください');
      }
    } catch (_) {
      if (!cached) renderLogin({}, '通信に失敗しました。時間をおいて再度お試しください');
    }
  }

  init();
})();
