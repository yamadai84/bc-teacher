(function () {
  'use strict';

  const GAS_URL = (window.BC_CONFIG && window.BC_CONFIG.GAS_URL || '').trim();
  const DEMO = !GAS_URL && !!window.BC_SEED; // プレビュー用。公開サイトには BC_SEED を置かない
  const PW_KEY = 'bc-teachers-pw';
  const DATA_KEY = 'bc-teachers-data';
  const PUBLIC_KEY = 'bc-teachers-public';
  const app = document.getElementById('app');

  const THEMES = {
    '赤':     { head: '#FF1744', grad: 'linear-gradient(90deg,#FF0844 0%,#FF6E69 100%)', accent: '#FF0000' },
    'オレンジ': { head: '#FFAB00', grad: 'linear-gradient(90deg,#F99023 0%,#FFC257 100%)', accent: '#F99023' },
    '緑':     { head: '#43A047', grad: 'linear-gradient(90deg,#0BA315 0%,#71D47B 100%)', accent: '#0BA315' },
    '青':     { head: '#0091EA', grad: 'linear-gradient(90deg,#1D8FE1 0%,#67C0F9 100%)', accent: '#1D8FE1' },
    '紫':     { head: '#7149B7', grad: 'linear-gradient(-225deg,#65379B 0%,#886AEA 53%,#6457C6 100%)', accent: '#65379B' },
    '黄':     { head: '#FFAB00', grad: 'linear-gradient(90deg,#FFAB00 0%,#FFC44C 100%)', accent: '#FFAB00' },
    '青紫':   { head: '#6A1B9A', grad: 'linear-gradient(135deg,#667EEA 0%,#764BA2 100%)', accent: '#764BA2' },
  };
  const AREA_BG = {
    'ピンク': 'linear-gradient(90deg,#F78CA0 0%,#F9748F 19%,#FD868C 60%,#FE9A8B 100%)',
    'ブルー': 'linear-gradient(0deg,#A3BDED 0%,#6991C7 100%)',
  };

  const ICON = {
    play: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    drop: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>',
    lock: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>',
  };

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
    return /^(https?:|mailto:|tel:|#)/i.test(u) ? u : (u ? 'https://' + u : '#');
  }
  function themeVars(color) {
    const t = THEMES[str(color)] || THEMES['赤'];
    return `--c-head:${t.head};--c-grad:${t.grad};--c-accent:${t.accent};`;
  }

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

  // ログイン画面用のロゴ・タイトル（パスワード不要）
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
  function hero(settings, sub) {
    const title = str(settings['ヘッダー見出し']) || '生徒・保護者 専用ページ';
    const logo = imgUrl(settings['ロゴ画像']);
    const color = str(settings['ヘッダー色']);
    return `<header class="hero"${color ? ` style="background:${esc(color)}"` : ''}>
      ${logo ? `<a href="#"><img class="hero-logo" src="${esc(logo)}" alt="Be Color"></a>` : ''}
      <h1 class="hero-title">${esc(title)}${sub ? '\n《 ' + esc(sub) + ' 》' : ''}</h1>
    </header>`;
  }
  function intro(settings) {
    const t = str(settings['説明文']);
    return t ? `<p class="intro">${esc(t)}</p>` : '';
  }
  function label(r) {
    const sub = str(r['サブタイトル']);
    return `<span class="item-label"><span class="item-title">${esc(str(r['タイトル']))}</span>${sub ? `<span class="item-sub">${esc(sub)}</span>` : ''}</span>`;
  }
  function link(r, cls, inner, color) {
    if (!str(r['リンクURL'])) return `<div class="item ${cls}" style="${themeVars(color)}">${inner}</div>`;
    return `<a class="item ${cls}" style="${themeVars(color)}" href="${esc(safeHref(r['リンクURL']))}" target="_blank" rel="noopener">${inner}</a>`;
  }

  function renderItem(r, color) {
    const c = str(r['色']) || color;
    switch (str(r['種類'])) {
      case 'ボタン':
        return link(r, 'btn', label(r) + ICON.play, c);
      case '画像カード': {
        const src = imgUrl(r['画像URL']);
        const img = src ? `<img class="card-img" src="${esc(src)}" alt="" loading="lazy" style="--ratio:${ratio(r['画像比率'], '16 / 9')}">` : '';
        return link(r, 'card', img + `<span class="card-foot">${label(r)}${ICON.play}</span>`, c);
      }
      case 'LINEボタン':
        return link(r, 'line', label(r) + ICON.play, c);
      case '枠ボタン':
        return link(r, 'outline', label(r) + ICON.play, c);
      case '文章':
        return `<p class="text">${esc(str(r['タイトル']))}</p>`;
      default:
        return '';
    }
  }

  // シートの行 → HTML。見出しの色は次の見出しまで引き継ぎ、「開閉の中」の行は直前の開閉にまとめる
  function renderRows(rows) {
    let html = '';
    let color = '赤';
    let toggle = null;
    const closeToggle = () => {
      if (!toggle) return;
      html += `<div class="toggle"><button class="item btn toggle-btn" type="button" style="${themeVars(toggle.color)}" aria-expanded="false">${label(toggle.row)}${ICON.drop}</button><div class="toggle-body">${toggle.body}</div></div>`;
      toggle = null;
    };

    rows.filter(r => on(r['表示'])).forEach(r => {
      const type = str(r['種類']);
      if (toggle && on(r['開閉の中']) && type !== '開閉' && type !== '見出し') {
        toggle.body += renderItem(r, toggle.color);
        return;
      }
      closeToggle();
      if (type === '見出し') {
        color = str(r['色']) || color;
        html += `<h2 class="heading" style="${themeVars(color)}">${esc(str(r['タイトル']))}</h2>`;
      } else if (type === '開閉') {
        toggle = { row: r, color: str(r['色']) || color, body: '' };
      } else {
        html += renderItem(r, color);
      }
    });
    closeToggle();
    return html;
  }

  function areas(data) {
    return (data.top || []).filter(a => on(a['表示']));
  }
  function areaSlug(a) {
    return str(a['URL名']) || str(a['シート名']);
  }

  function renderTop(data) {
    const cards = areas(data).map(a => {
      const src = imgUrl(a['画像URL']);
      const bg = AREA_BG[str(a['色'])] || (THEMES[str(a['色'])] || {}).grad || AREA_BG['ピンク'];
      return `<a class="area" href="#${esc(encodeURIComponent(areaSlug(a)))}" style="--c-area:${bg}">
        ${src ? `<img class="area-img" src="${esc(src)}" alt="" style="--ratio:${ratio(a['画像比率'], '3 / 2')}">` : ''}
        <span class="area-foot"><span><span class="area-name">${esc(str(a['エリア名']))}</span><span class="area-sub">${esc(str(a['サブ']))}</span></span>${ICON.play}</span>
      </a>`;
    }).join('');
    return hero(data.settings) + intro(data.settings) + cards + logoutBtn();
  }

  function renderArea(data, area) {
    const rows = (data.pages || {})[str(area['シート名'])] || [];
    return hero(data.settings, str(area['エリア名'])) + intro(data.settings) + renderRows(rows) +
      `<a class="back" href="#">← TOPへ戻る</a>` + logoutBtn();
  }

  // エリア分けがないサイト：トップページのシートをそのまま表示
  function renderHome(data, sheet) {
    return hero(data.settings) + intro(data.settings) + renderRows((data.pages || {})[sheet] || []) + logoutBtn();
  }

  function logoutBtn() {
    return DEMO ? '' : `<button class="logout" type="button" data-logout>ログアウト</button>`;
  }

  function renderLogin(settings, error) {
    settings = Object.assign(cachedPublic(), settings || {});
    document.title = str(settings['サイト名']) || 'Be Color 生徒専用ページ';
    app.innerHTML = hero(settings) + `
      <form class="login" autocomplete="on">
        ${ICON.lock}
        <h2>LOG IN</h2>
        <p>${esc(str(settings['ログイン案内文']) || '講師より共有された ログインパスワードを入力してください')}</p>
        <input type="password" name="password" autocomplete="current-password" placeholder="パスワード" required>
        <button type="submit">LOG IN</button>
        <p class="error" role="alert">${esc(error || '')}</p>
      </form>`;
    const form = app.querySelector('form');
    form.password.focus();
    if (!DEMO && !error) {
      // 最新のロゴ・タイトルを取得して、入力中の内容はそのままにヘッダーだけ差し替える
      fetchPublic().then(s => {
        if (!s || !form.isConnected) return;
        app.querySelector('.hero').outerHTML = hero(s);
        form.querySelector('p').textContent = str(s['ログイン案内文']) || '講師より共有された ログインパスワードを入力してください';
        document.title = str(s['サイト名']) || 'Be Color 生徒専用ページ';
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
    const site = str(data.settings['サイト名']) || 'Be Color 生徒専用ページ';
    document.title = area ? site + '｜' + str(area['エリア名']) : site;
    app.innerHTML = area ? renderArea(data, area) : home ? renderHome(data, home) : renderTop(data);
    window.scrollTo(0, 0);
  }

  app.addEventListener('click', e => {
    const t = e.target.closest('.toggle-btn');
    if (t) {
      const box = t.parentElement;
      box.classList.toggle('open');
      t.setAttribute('aria-expanded', box.classList.contains('open'));
      return;
    }
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
      app.innerHTML = hero({}) + '<p class="loading">config.js に GAS の URL が設定されていません</p>';
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
          const openIdx = [...app.querySelectorAll('.toggle')].map((t, i) => t.classList.contains('open') ? i : -1).filter(i => i >= 0);
          const y = window.scrollY;
          route();
          app.querySelectorAll('.toggle').forEach((t, i) => { if (openIdx.includes(i)) t.classList.add('open'); });
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
