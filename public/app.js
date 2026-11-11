import { analyze, selectGames, dateKey, shiftDay } from "./metrics.js";
import { mountDownloadChart } from "./download-chart.js";

const $ = (selector) => document.querySelector(selector);
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  chart: '<path d="M4 4v16h17M8 15l4-5 4 2 5-7"/>',
  bookmark: '<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5c0-3 5-3 5 0 0 2-2.5 2-2.5 4M12 16v.2"/>',
  refresh:
    '<path d="M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5M4 14a8 8 0 0 0 14 5l3-3m0 5v-5h-5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.2"/>',
  android:
    '<path d="M5 10h14v8H5ZM8 6 6 3m10 3 2-3M5 10a7 7 0 0 1 14 0M3 11v6m18-6v6M8 18v3m8-3v3"/><path d="M9 8v.1m6-.1v.1"/>',
  ios: '<path d="M15 3c-2 0-3 1-3 3 2 0 3-1 3-3ZM17 7c-2-1-3 0-5 0s-3-1-5 0c-4 2-2 9 0 12 2 3 3 1 5 1s3 2 5-1c1-1 2-3 2-4-4-2-3-5-1-7Z"/>',
  trend: '<path d="m3 17 6-6 4 4 8-10m-6 0h6v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] ?? icons.grid}</svg>`;
document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = icon(el.dataset.icon);
});
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? esc(u.href) : "";
  } catch {
    return "";
  }
}
const fmt = (value) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
        value,
      );
const compact = (value) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
const time = (value) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Chưa có";
const countryName = (code) =>
  ({ vn: "Việt Nam", us: "Hoa Kỳ", global: "Toàn cầu" })[code] ??
  code.toUpperCase();
const platform = (game) =>
  `<span class="platform">${icon(game.platform)}${game.platform === "ios" ? "App Store" : "Google Play"}</span>`;
const image = (game, cls = "game-icon") =>
  `<img class="${cls}" src="${safeUrl(game.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
const badge = (value, unit = "%") =>
  value == null
    ? '<span class="empty-value">—</span>'
    : `<span class="badge ${value > 0 ? "positive" : value < 0 ? "negative" : "neutral"}">${value > 0 ? "↗ +" : value < 0 ? "↘ " : ""}${fmt(value)}${unit}</span>`;
let data,
  analyzed = [],
  filtered = [],
  localServer = false,
  page = 1,
  view = "overview",
  toastTimer,
  detailKey,
  downloadChartState;
let pageSize = 15;
const filters = {
  country: "vn",
  platform: "",
  genre: "",
  days: 7,
  sort: "rank",
  search: "",
  watchOnly: false,
};
let watchlist = [];
try {
  const saved = JSON.parse(
    localStorage.getItem("checktopgame:watchlist") ?? "[]",
  );
  if (Array.isArray(saved))
    watchlist = saved.filter((k) => typeof k === "string");
} catch {
  /* A blocked storage context still permits browsing. */
}
const names = {
  overview: "Tổng quan",
  ranking: "Bảng xếp hạng",
  watchlist: "Đang theo dõi",
  sources: "Nguồn dữ liệu",
};

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4500);
}
function watchButton(game) {
  const saved = watchlist.includes(game.key);
  return `<button class="watch-button ${saved ? "saved" : ""}" data-watch="${esc(game.key)}" aria-pressed="${saved}" aria-label="${saved ? "Bỏ theo dõi" : "Theo dõi"} ${esc(game.title)}">${icon("bookmark")}</button>`;
}
function gamePreview(game) {
  return `<button class="game-preview" data-detail="${esc(game.key)}">${image(game)}<span class="game-text"><span class="game-title">${esc(game.title)}</span><span class="game-developer">${esc(game.developer)}</span></span></button>`;
}
function renderStats() {
  const market = analyzed.filter(
    (g) =>
      g.country === filters.country &&
      (!filters.platform || g.platform === filters.platform),
  );
  const days = new Set(
    data.observations
      .filter((p) => market.some((g) => g.key === p.key))
      .map((p) => p.date),
  ).size;
  const withDownloads = market.filter((g) => g.downloads.total !== null).length;
  const good = data.sources.filter((s) => s.status !== "error").length;
  const stat = (label, value, description, glyph) =>
    `<article class="stat"><div class="stat-head">${label}<span class="icon-box">${icon(glyph)}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${description}</div></article>`;
  $("#stats").innerHTML =
    stat(
      "Game trên radar",
      fmt(market.length),
      `<span class="green">●</span> ${esc(countryName(filters.country))} · Game miễn phí`,
      "grid",
    ) +
    stat(
      "Nguồn đang hoạt động",
      `${good}<span style="font-size:17px;color:#b3bca7"> / ${data.sources.length}</span>`,
      "Cửa hàng & nguồn lịch sử lượt tải",
      "database",
    ) +
    stat(
      "Lịch sử đã tích lũy",
      `${days}<span style="font-size:14px;color:#8f9d80"> ngày</span>`,
      "Một bản ghi mỗi game / ngày UTC",
      "clock",
    ) +
    stat(
      "Có lượt tải trong kỳ",
      `${withDownloads}<span style="font-size:17px;color:#b3bca7"> / ${market.length}</span>`,
      withDownloads
        ? "Có nhãn nguồn, phạm vi và ngày kết thúc"
        : "Đang tích lũy hoặc chưa có nguồn phù hợp",
      "trend",
    );
}
function renderSpotlights() {
  const games = selectGames(analyzed, {
    country: filters.country,
    platform: filters.platform,
    sort: "rank",
  })
    .filter((g) => g.fresh && g.latest?.rank != null)
    .slice(0, 3);
  $("#spotlights").innerHTML = games
    .map(
      (g, i) =>
        `<article class="spotlight"><div class="spotlight-label"><span>${["LEADING THE CHART", "ON THE RADAR", "WORTH A LOOK"][i]}</span><strong>#${g.latest.rank.toString().padStart(2, "0")}</strong></div>${gamePreview(g)}<div class="spotlight-footer">${platform(g)}<span class="score">${g.score == null ? "—" : `${fmt(g.score)} <span class="star">★</span>`}</span><a href="${safeUrl(g.url)}" target="_blank" rel="noopener noreferrer">Mở cửa hàng ↗</a></div></article>`,
    )
    .join("");
}
function renderSources() {
  $("#sources-panel").innerHTML =
    `<p class="sources-intro">Lần chạy gần nhất: ${time(data.updatedAt)}. Cửa hàng cập nhật mỗi 6 giờ; các nguồn lịch sử lượt tải được đọc tối đa một lần/ngày/game. Khi một nguồn lỗi, dữ liệu trước đó vẫn được giữ.</p><div class="sources-grid">${data.sources.map((s) => `<article class="source-card"><div class="eyebrow">${esc(countryName(s.country))} · ${s.kind === "downloads" ? "LỊCH SỬ LƯỢT TẢI" : s.platform === "ios" ? "APPLE" : "GOOGLE"}</div><h3>${esc(s.name ?? (s.platform === "ios" ? "App Store · Games" : "Google Play · Games"))}</h3><span class="badge ${s.status === "error" ? "negative" : s.status === "partial" ? "neutral" : "positive"}">${s.status === "error" ? "Lỗi nguồn" : s.status === "partial" ? "Một phần" : "Đang hoạt động"}</span><div class="source-details"><br>${fmt(s.count)} game có dữ liệu<br>Kiểm tra: ${time(s.checkedAt)}<br>Thành công gần nhất: ${time(s.lastSuccessAt)}</div>${s.error || s.warning ? `<p>${esc(s.error ?? s.warning)}</p>` : ""}<a class="button button-white small" href="${safeUrl(s.sourceUrl)}" target="_blank" rel="noopener noreferrer">Mở nguồn ↗</a></article>`).join("")}</div><article class="source-card" style="margin-top:18px"><h3>Vận hành tool thu thập</h3><p>Thu thập toàn bộ: <code>npm run collect</code>. Chỉ tìm lịch sử lượt tải: <code>npm run collect:downloads</code>. Server và GitHub Actions được cấu hình chạy mỗi 6 giờ.</p><p>Android: lưu bộ đếm Google Play trực tiếp, nạp lịch sử công khai từ CivCharts và dự phòng AppCurves. Chênh lệch bộ đếm là tín hiệu tăng trưởng, không phải báo cáo người dùng mới.</p><p>iOS: đọc bảng ước tính từng ngày trên trang game công khai của AppTrendKit. Chỉ dùng game có số liệu công khai trong danh mục Games; nguồn yêu cầu tài khoản hoặc giới hạn truy cập sẽ được bỏ qua.</p><p>Nguồn toàn cầu luôn được gắn nhãn, không gán thành lượt tải Việt Nam/Mỹ. Có thể nhập thêm báo cáo riêng bằng <code>npm run import -- downloads.json</code>.</p></article>`;
}
function downloadCell(g) {
  const label =
    g.downloadMetric === "public-counter-change"
      ? "Biến động bộ đếm"
      : g.downloads.estimated
        ? "Ước tính"
        : "Theo báo cáo";
  return `${g.downloads.total == null ? '<span class="empty-value">—</span>' : compact(g.downloads.total)}<span class="cell-sub">${g.downloads.total == null ? `${g.downloads.count}/${filters.days} ngày dữ liệu` : label}</span><span class="cell-sub">${g.downloadScope === "global" ? "Toàn cầu" : esc(countryName(g.downloadScope))} · đến ${g.downloadAsOf}</span>`;
}
function renderTable() {
  filtered = selectGames(analyzed, filters, watchlist);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, pages);
  const offset = (page - 1) * pageSize,
    rows = filtered.slice(offset, offset + pageSize);
  $("#game-rows").innerHTML = rows
    .map(
      (g) =>
        `<tr><td>${g.fresh && g.latest?.rank != null ? `#${g.latest.rank.toString().padStart(2, "0")}` : '<span class="empty-value">—</span>'}</td><td class="game-cell">${gamePreview(g)}</td><td>${platform(g)}</td><td>${downloadCell(g)}</td><td>${badge(g.downloads.growth)}${g.downloads.growth !== null && g.downloads.comparisonEstimated ? '<span class="cell-sub">Có dữ liệu ước tính</span>' : ""}</td><td>${badge(g.rankChange, "")}<span class="cell-sub">${g.rankChange == null ? "Chưa đủ lịch sử" : `Trong ${filters.days} ngày`}</span></td><td>${g.score == null ? "—" : `${fmt(g.score)} <span class="star">★</span>`}<span class="cell-sub">${compact(g.ratings)} đánh giá</span></td><td>${watchButton(g)}</td></tr>`,
    )
    .join("");
  $("#empty").hidden = rows.length > 0;
  $("#result-count").textContent =
    `${filtered.length} game · ${countryName(filters.country)}`;
  $("#pagination-info").textContent = filtered.length
    ? `${offset + 1}–${Math.min(offset + pageSize, filtered.length)} trong ${filtered.length} game · Trang ${page}/${pages}`
    : "0 game";
  $("#prev").disabled = page <= 1;
  $("#next").disabled = page >= pages;
  $("#export").disabled = filtered.length === 0;
}
function render() {
  if (!data) return;
  analyzed = data.games.map((g) => analyze(g, data, filters.days));
  $("#dashboard").hidden = false;
  $("#watch-count").textContent = watchlist.length;
  const currentSources = data.sources.filter(
    (s) => s.country === filters.country,
  );
  const errors = currentSources.some((s) => s.status === "error");
  const old =
    data.updatedAt && Date.now() - Date.parse(data.updatedAt) > 24 * 3600000;
  $("#data-status").innerHTML =
    `<span class="status-dot ${errors || old ? "error" : ""}"></span><strong>${errors ? "Có nguồn tạm lỗi" : old ? "Dữ liệu quá 24 giờ" : "Đã kết nối nguồn dữ liệu"}</strong><span class="status-divider"></span><span>Cập nhật ${time(data.updatedAt)}</span><span class="status-divider"></span><span>Chu kỳ thu thập 6 giờ</span>`;
  $("#spotlight-section").hidden = view !== "overview";
  $("#ranking-panel").hidden = view === "sources";
  $("#sources-panel").hidden = view !== "sources";
  $("#stats").hidden = view === "sources";
  $("#breadcrumb").textContent = names[view];
  $("#page-title").innerHTML = {
    overview: "Nắm bắt nhịp tăng trưởng<span>.</span>",
    ranking: "Đọc vị chuyển động thị trường<span>.</span>",
    watchlist: "Radar của riêng bạn<span>.</span>",
    sources: "Mỗi con số, một nguồn rõ ràng<span>.</span>",
  }[view];
  $("#page-description").textContent = {
    overview: "Khám phá game nổi bật. Theo dõi chuyển động. Đi trước xu hướng.",
    ranking: "So sánh game trên Google Play và App Store theo từng thị trường.",
    watchlist: "Lưu những game bạn quan tâm. Theo dõi hành trình tăng trưởng.",
    sources: "Kiểm tra nguồn, độ mới và tình trạng thu thập dữ liệu.",
  }[view];
  $("#table-title").textContent =
    view === "watchlist" ? "Game đang theo dõi" : "Toàn cảnh thị trường";
  renderStats();
  renderSpotlights();
  renderTable();
  if (view === "sources") renderSources();
}
function chart(game) {
  const end = dateKey(new Date()),
    start = shiftDay(end, -filters.days);
  const points = game.history.filter(
    (p) => p.date >= start && p.date <= end && p.rank != null,
  );
  if (points.length < 2)
    return `<div class="chart-empty">Đã có ${points.length} ngày dữ liệu trong kỳ.<br>Biểu đồ sẽ xuất hiện khi có ít nhất hai ngày quan sát.</div>`;
  const width = 650,
    height = 150,
    left = 32,
    right = 630,
    top = 12,
    bottom = 124;
  const max = Math.max(5, ...points.map((p) => p.rank)),
    min = 1;
  const x = (p) =>
    left +
    ((Date.parse(p.date) - Date.parse(start)) / (filters.days * 86400000)) *
      (right - left);
  const y = (p) => top + ((p.rank - min) / (max - min)) * (bottom - top);
  // Break segments across missing observations; never imply unobserved intermediate ranks.
  const path = points
    .map(
      (p, i) =>
        `${i && Date.parse(p.date) - Date.parse(points[i - 1].date) <= 2 * 86400000 ? "L" : "M"}${x(p)},${y(p)}`,
    )
    .join(" ");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ thứ hạng game, số nhỏ hơn là thứ hạng tốt hơn"><path d="M${left} ${top}H${right}M${left} ${(top + bottom) / 2}H${right}M${left} ${bottom}H${right}" stroke="#e5ebdc" stroke-dasharray="3 4" fill="none"/><text x="3" y="${top + 4}">#1</text><text x="3" y="${bottom + 4}">#${max}</text><path class="chart-line" d="${path}"/>${points.map((p) => `<circle cx="${x(p)}" cy="${y(p)}" r="3" fill="#749852"><title>${p.date}: #${p.rank}</title></circle>`).join("")}<text x="${left}" y="147">${start}</text><text x="${right}" y="147" text-anchor="end">${end}</text></svg>`;
}
function openDetail(key) {
  const game = analyzed.find((g) => g.key === key);
  if (!game) return;
  if (detailKey !== key) downloadChartState = null;
  detailKey = key;
  $("#detail-content").innerHTML =
    `<div class="eyebrow">GAME PROFILE · ${esc(countryName(game.country))}</div>
    <div class="detail-top">${image(game)}<div><h2>${esc(game.title)}</h2><p>${esc(game.developer)} · ${esc(game.genre)}</p>${platform(game)}</div></div>
    <div class="detail-actions"><a class="button button-dark" href="${safeUrl(game.url)}" target="_blank" rel="noopener noreferrer">Mở ${game.platform === "ios" ? "App Store" : "Google Play"} ↗</a><button class="button button-white" data-watch="${esc(game.key)}">${icon("bookmark")}${watchlist.includes(game.key) ? "Bỏ theo dõi" : "Thêm vào theo dõi"}</button></div>
    <div id="download-chart"></div>
    <h3 class="detail-section">Biến động thứ hạng · ${filters.days} ngày</h3>
    <div class="chart-wrap">${chart(game)}<div class="chart-legend"><span>Thứ hạng nhỏ hơn = vị trí cao hơn</span><span>${esc(countryName(game.country))} · Top miễn phí</span></div></div>
    <p class="detail-meta">Thứ hạng mới nhất: ${game.fresh && game.latest?.rank != null ? `#${game.latest.rank}` : "—"}<br>Quan sát gần nhất: ${time(game.latest?.collectedAt)}<br>Điểm: ${fmt(game.score)} / 5 · ${fmt(game.ratings)} đánh giá<br>${game.platform === "android" ? `Mốc lượt cài đặt toàn cầu: ${esc(game.installs ?? "Chưa có")} (tích lũy, không phải lượt tải trong kỳ)<br>` : ""}Phiên bản: ${esc(game.version ?? "Chưa có")} · Bắt đầu theo dõi: ${time(game.firstSeen)}</p>
    ${game.screenshots?.length ? `<h3 class="detail-section">Bên trong game</h3><div class="screenshots">${game.screenshots.map((url, i) => `<a href="${safeUrl(game.url)}" target="_blank" rel="noopener noreferrer"><img src="${safeUrl(url)}" alt="Ảnh chụp màn hình ${i + 1} của ${esc(game.title)}" loading="lazy" referrerpolicy="no-referrer"></a>`).join("")}</div>` : ""}
    <h3 class="detail-section">Giới thiệu</h3><div class="detail-description">${esc(game.description || "Nguồn chưa cung cấp mô tả.")}</div><p class="detail-note">Thông tin và hình ảnh từ cửa hàng game. <a href="${safeUrl(game.sourceUrl)}" target="_blank" rel="noopener noreferrer">Xem nguồn bảng xếp hạng ↗</a></p>`;
  mountDownloadChart(
    $("#download-chart"),
    game.downloadSeries[0]?.records ?? [],
    {
      days: filters.days,
      ...downloadChartState,
      series: game.downloadSeries,
      onChange: (state) => {
        downloadChartState = state;
      },
    },
  );
  if (!$("#detail").open) $("#detail").showModal();
}
function setView(next) {
  view = next;
  filters.watchOnly = next === "watchlist";
  page = 1;
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === next));
  render();
}
function resetFilters() {
  Object.assign(filters, { platform: "", genre: "", search: "", sort: "rank" });
  $("#search").value = "";
  $("#genre").value = "";
  $("#sort").value = "rank";
  document
    .querySelectorAll("[data-platform]")
    .forEach((b) => b.classList.toggle("selected", b.dataset.platform === ""));
  page = 1;
  render();
}
function exportCsv() {
  const rows = [
    [
      "game",
      "developer",
      "platform",
      "country",
      "rank",
      "observed_at",
      "period_days",
      "download_scope",
      "download_provider",
      "downloads_as_of",
      "download_metric",
      "downloads",
      "growth_percent",
      "acceleration_pp",
      "rank_change",
      "score",
      "estimated_comparison",
      "url",
    ],
    ...filtered.map((g) => [
      g.title,
      g.developer,
      g.platform,
      g.country,
      g.fresh ? g.latest?.rank : "",
      g.latest?.collectedAt,
      filters.days,
      g.downloadScope,
      g.downloadSeries[0]?.provider,
      g.downloadAsOf,
      g.downloadMetric,
      g.downloads.total,
      g.downloads.growth,
      g.downloads.acceleration,
      g.rankChange,
      g.score,
      g.downloads.comparisonEstimated,
      g.url,
    ]),
  ];
  const cell = (value) => {
    let s = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  const blob = new Blob(
    ["\uFEFF", rows.map((r) => r.map(cell).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const link = document.createElement("a"),
    url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `checktopgame-${filters.country}-${dateKey(new Date())}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Đã xuất ${filtered.length} game.`);
}
async function load({ quiet = false } = {}) {
  try {
    const response = await fetch(`./data/catalog.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Không tải được dữ liệu.");
    const next = await response.json();
    if (
      !Array.isArray(next.games) ||
      !Array.isArray(next.observations) ||
      !Array.isArray(next.downloads) ||
      !Array.isArray(next.sources)
    )
      throw new Error("Dữ liệu không đúng định dạng.");
    data = next;
    const genres = [...new Set(data.games.map((g) => g.genre))].sort();
    $("#genre").innerHTML =
      '<option value="">Mọi thể loại</option>' +
      genres
        .map((g) => `<option value="${esc(g)}">${esc(g)}</option>`)
        .join("");
    $("#genre").value = filters.genre;
    $("#load-error").hidden = true;
    render();
    if (detailKey && $("#detail").open) openDetail(detailKey);
  } catch (error) {
    if (data) {
      if (!quiet) toast("Không tải được bản mới; đang giữ dữ liệu đã tải.");
      return;
    }
    $("#load-error").hidden = false;
    $("#load-error").innerHTML =
      `<h3>Chưa kết nối được dữ liệu</h3><p>Chạy <code>npm run collect</code>, sau đó bấm cập nhật để thử lại.</p>`;
    $("#data-status").textContent = error.message;
  }
}

document.addEventListener("click", (event) => {
  const watch = event.target.closest("[data-watch]");
  if (watch) {
    const key = watch.dataset.watch,
      exists = watchlist.includes(key);
    watchlist = exists
      ? watchlist.filter((k) => k !== key)
      : [...watchlist, key];
    let persisted = true;
    try {
      localStorage.setItem("checktopgame:watchlist", JSON.stringify(watchlist));
    } catch {
      persisted = false;
    }
    render();
    if ($("#detail").open) openDetail(key);
    toast(
      persisted
        ? exists
          ? "Đã bỏ game khỏi danh sách theo dõi."
          : "Đã thêm game vào radar của bạn."
        : "Đã lưu trong phiên này; trình duyệt không cho phép lưu lâu dài.",
    );
    return;
  }
  const detail = event.target.closest("[data-detail]");
  if (detail) return openDetail(detail.dataset.detail);
  const nav = event.target.closest("[data-view]");
  if (nav) return setView(nav.dataset.view);
  const pf = event.target.closest("[data-platform]");
  if (pf) {
    filters.platform = pf.dataset.platform;
    page = 1;
    document
      .querySelectorAll("[data-platform]")
      .forEach((b) => b.classList.toggle("selected", b === pf));
    render();
  }
  const period = event.target.closest("[data-days]");
  if (period) {
    filters.days = Number(period.dataset.days);
    page = 1;
    document
      .querySelectorAll("[data-days]")
      .forEach((b) => b.classList.toggle("selected", b === period));
    render();
  }
  if (event.target.closest(".dialog-close"))
    event.target.closest("dialog").close();
});
$("#search").addEventListener("input", (event) => {
  filters.search = event.target.value.trim();
  page = 1;
  if (view === "sources") setView("ranking");
  else render();
});
for (const id of ["country", "genre", "sort"])
  $(`#${id}`).addEventListener("change", (e) => {
    filters[id] = e.target.value;
    page = 1;
    render();
  });
$("#prev").addEventListener("click", () => {
  page--;
  renderTable();
});
$("#page-size").addEventListener("change", (event) => {
  pageSize = Number(event.target.value);
  page = 1;
  renderTable();
});
$("#next").addEventListener("click", () => {
  page++;
  renderTable();
});
$("#reset").addEventListener("click", resetFilters);
$("#export").addEventListener("click", exportCsv);
for (const id of ["help", "method-link"])
  $(`#${id}`).addEventListener("click", () => $("#method").showModal());
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) &&
    !$("#detail").open &&
    !$("#method").open
  ) {
    event.preventDefault();
    $("#search").focus();
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === "checktopgame:watchlist") {
    try {
      const next = JSON.parse(e.newValue ?? "[]");
      if (Array.isArray(next)) {
        watchlist = next.filter((k) => typeof k === "string");
        render();
      }
    } catch {}
  }
});
$("#refresh").addEventListener("click", async () => {
  const button = $("#refresh");
  button.disabled = true;
  try {
    if (localServer) {
      toast("Đang lấy dữ liệu từ các cửa hàng…");
      const response = await fetch("./api/refresh", {
        method: "POST",
        headers: { "X-CheckTopGame": "refresh" },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể cập nhật.");
      await load();
      toast(
        result.sources.some((s) => s.status === "error")
          ? "Đã cập nhật; có nguồn tạm lỗi. Xem Nguồn dữ liệu."
          : "Đã thu thập và lưu dữ liệu mới.",
      );
    } else {
      await load();
      toast("Đã tải lại bản dữ liệu được xuất gần nhất.");
    }
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
});
$("#year").textContent = new Date().getFullYear();
await load();
try {
  const response = await fetch("./api/status");
  if (
    response.ok &&
    response.headers.get("content-type")?.includes("application/json")
  )
    localServer = (await response.json()).local === true;
} catch {}
setInterval(() => {
  if (!document.hidden) load({ quiet: true });
}, 300000);
