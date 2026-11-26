// 図の拡大。図をクリックする（または「拡大」を押す）と、画面いっぱいの dialog に図の写しを開く。
//   開いた図をクリック  さらに 2 倍にする / 戻す
//   Esc・図の外・閉じる  閉じる
// 開いたときの大きさは、画面に収まる倍率と原寸の大きいほう（本文の幅に縮められた図を、読める大きさで見せる）。
(() => {
  const MAX_FIT = 2.5;
  let dialog, stage, base = 1, zoomed = false;

  const build = () => {
    dialog = document.createElement("dialog");
    dialog.className = "zoom";
    dialog.setAttribute("aria-label", "拡大した図");
    dialog.innerHTML = '<button class="zoom-close" type="button">閉じる</button><div class="zoom-stage" tabindex="0" autofocus></div>';
    stage = dialog.lastElementChild;
    document.body.append(dialog);
    dialog.addEventListener("click", (e) => {
      const svg = e.target.closest(".zoom-stage svg");
      if (svg) toggle(svg, e);
      else dialog.close();
    });
    dialog.addEventListener("close", () => stage.replaceChildren());
  };

  const size = (svg) => {
    const box = svg.viewBox.baseVal;
    return box && box.width ? [box.width, box.height] : [svg.clientWidth, svg.clientHeight];
  };
  const apply = (svg, scale) => {
    svg.style.width = `${svg._w * scale}px`;
    svg.style.height = `${svg._h * scale}px`;
  };

  // クリックした点が画面の中央に来るように倍率を切り替える
  const toggle = (svg, e) => {
    const r = svg.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    zoomed = !zoomed;
    apply(svg, zoomed ? base * 2 : base);
    stage.classList.toggle("zoomed", zoomed);
    const n = svg.getBoundingClientRect();
    stage.scrollLeft += n.left + fx * n.width - innerWidth / 2;
    stage.scrollTop += n.top + fy * n.height - innerHeight / 2;
  };

  const open = (source) => {
    if (!dialog) build();
    const svg = source.cloneNode(true);
    [svg._w, svg._h] = size(source);
    if (!svg._w || !svg._h) return;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.maxWidth = "none";
    stage.replaceChildren(svg);
    stage.classList.remove("zoomed");
    zoomed = false;
    dialog.showModal();
    const cs = getComputedStyle(stage);
    const w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const fit = Math.min(w / svg._w, h / svg._h);
    base = Math.min(Math.max(fit, 1), MAX_FIT);
    apply(svg, base);
    stage.scrollTo(0, 0);
  };

  document.addEventListener("click", (e) => {
    const figure = e.target.closest(".figure");
    if (!figure || getSelection().toString()) return;
    const svg = figure.querySelector("svg");
    if (svg) open(svg);
  });
})();
