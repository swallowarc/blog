// キーボード操作。tmux と vim の作法に合わせる。
//   j / k   いまいるペインの中で選択を移す（記事の本文では画面を送る）
//   h / l   左右のペインを移る
//   0-9     上のバーの番号のページへ
//   g g / G 先頭 / 末尾へ
//   ?       キー操作の一覧
// 選択は実際のフォーカスで表すので、Enter で開く動作はブラウザに任せる。
(() => {
  const main = document.querySelector("main");
  const side = document.querySelector(".side");
  const help = document.getElementById("keys");
  const nav = document.querySelectorAll(".bar nav a");
  if (!main || !side) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const smooth = (repeat) => (reduced.matches || repeat ? "auto" : "smooth");
  const barHeight = () => document.querySelector(".bar").getBoundingClientRect().bottom;
  const rows = () => [...main.querySelectorAll(".post-title, .term-list a")];
  const sideLinks = () => [...side.querySelectorAll("a")];
  const inView = (el) => {
    const r = (el.closest("li") || el).getBoundingClientRect();
    return r.top >= barHeight() && r.bottom <= innerHeight;
  };
  // ペインごとに、最後に選んだ行を覚えておく（ペインを移って戻ったときに、そこから続ける）
  const last = new Map();
  const select = (el, repeat) => {
    last.set(side.contains(el) ? side : main, el);
    el.focus({ preventScroll: true });
    (el.closest("li") || el).scrollIntoView({ block: "nearest", behavior: smooth(repeat) });
  };

  // いまいるペインの中で、選択を d 行ぶん動かす
  const move = (d, repeat) => {
    const here = document.activeElement;
    const list = side.contains(here) ? sideLinks() : rows();
    if (!list.length) return scrollBy({ top: d * 110, behavior: smooth(repeat) });
    const i = list.indexOf(here);
    if (i >= 0) return select(list[Math.min(list.length - 1, Math.max(0, i + d))], repeat);
    // まだ何も選んでいないときは、画面に見えている端の行から始める
    const visible = list.filter(inView);
    select(visible.length ? (d > 0 ? visible[0] : visible[visible.length - 1]) : list[0], repeat);
  };

  const toPane = (target) => {
    const here = document.activeElement;
    if (side.contains(here) === (target === side)) return;
    const list = target === side ? sideLinks() : rows();
    const back = last.get(target);
    if (list.length) select(list.includes(back) ? back : list.find(inView) || list[0]);
    else here.blur();
  };

  let lastG = 0;
  addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    // 図を拡大している間は、キーを dialog に任せる
    if (document.querySelector("dialog[open]")) return;
    const k = e.key;
    if (k === "?") { if (help && help.togglePopover) help.togglePopover(); }
    else if (help && help.matches(":popover-open")) return;
    else if (k === "j") move(1, e.repeat);
    else if (k === "k") move(-1, e.repeat);
    else if (k === "l") toPane(side);
    else if (k === "h") toPane(main);
    else if (k === "G") scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth() });
    else if (k === "g") {
      if (e.timeStamp - lastG < 600) { scrollTo({ top: 0, behavior: smooth() }); lastG = 0; }
      else lastG = e.timeStamp;
      return;
    }
    else if (/^[0-9]$/.test(k) && nav[+k]) nav[+k].click();
    else return;
    e.preventDefault();
  });
})();
