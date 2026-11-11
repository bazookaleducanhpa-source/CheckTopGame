import { dateKey, downloadTimeline } from "./metrics.js";

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const number = (value) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
        value,
      );
const compact = (value) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
const signed = (value) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${number(value)}%`;
const W = 660,
  H = 240,
  L = 54,
  R = 640,
  T = 18,
  B = 198;

function graph(model) {
  const max = Math.max(
    1,
    ...model.points.flatMap((p) => [
      p.current?.downloads ?? 0,
      p.previous?.downloads ?? 0,
    ]),
  );
  const ceiling = Math.ceil(max / 4) * 4;
  const x = (i) => L + (i / Math.max(1, model.points.length - 1)) * (R - L);
  const y = (value) => B - (value / ceiling) * (B - T);
  function path(field) {
    return model.points
      .map((p, i) =>
        p[field] == null
          ? ""
          : `${i > 0 && model.points[i - 1][field] != null ? "L" : "M"}${x(i)},${y(p[field].downloads)}`,
      )
      .join(" ");
  }
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const value = (ceiling * i) / 4,
      yy = y(value);
    return `<path d="M${L} ${yy}H${R}" class="download-grid"/><text x="${L - 9}" y="${yy + 4}" text-anchor="end">${compact(value)}</text>`;
  }).join("");
  const labels = [
    ...new Set([
      0,
      Math.floor((model.points.length - 1) / 2),
      model.points.length - 1,
    ]),
  ]
    .map(
      (i) =>
        `<text x="${x(i)}" y="226" text-anchor="${i === 0 ? "start" : i === model.points.length - 1 ? "end" : "middle"}">${model.points[i].date.slice(5).split("-").reverse().join("/")}</text>`,
    )
    .join("");
  const dots = ["previous", "current"]
    .map((field) =>
      model.points
        .map((p, i) =>
          p[field] == null
            ? ""
            : `<circle cx="${x(i)}" cy="${y(p[field].downloads)}" r="${field === "current" ? 2.8 : 2}" class="download-dot ${field}"/>`,
        )
        .join(""),
    )
    .join("");
  return `<div class="download-plot" tabindex="0" role="group" aria-label="Khám phá lượt tải theo ngày; dùng phím trái phải để xem từng ngày" aria-describedby="download-readout"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ lượt tải hằng ngày và kỳ trước; khoảng trống là ngày thiếu dữ liệu">${ticks}${labels}<path d="${path("previous")}" class="download-line previous"/><path d="${path("current")}" class="download-line current"/>${dots}<line class="download-cursor" x1="${R}" x2="${R}" y1="${T}" y2="${B}"/></svg></div><output id="download-readout" class="download-readout" aria-live="polite"></output>`;
}

export function mountDownloadChart(element, records, options = {}) {
  const today = dateKey(new Date());
  const series = options.series?.length
    ? options.series
    : [
        {
          id: "default",
          scope: options.scope ?? "",
          label: "Báo cáo lượt tải",
          records,
        },
      ];
  const initial = series.find((s) => s.id === options.seriesId) ?? series[0];
  const latest = initial.records
    .filter((p) => p.date <= today)
    .map((p) => p.date)
    .sort()
    .at(-1);
  const state = {
    days: [7, 30, 90, 365].includes(options.days) ? options.days : 7,
    end: options.end ?? latest ?? today,
    seriesId: initial.id,
  };
  function render(focus) {
    const selected = series.find((s) => s.id === state.seriesId) ?? series[0];
    records = selected.records;
    const latest = records
      .map((p) => p.date)
      .filter((d) => d <= today)
      .sort()
      .at(-1);
    const model = downloadTimeline(records, state.end, state.days),
      n = model.metrics;
    const hasPoints = model.points.some((p) => p.current || p.previous);
    const stale =
      latest && Date.parse(today) - Date.parse(latest) > 2 * 86400000;
    const stat = (label, value, note, cls = "") =>
      `<div class="download-stat"><span>${label}</span><strong class="${cls}">${value}</strong><small>${note}</small></div>`;
    element.innerHTML = `<section class="download-section" aria-labelledby="download-heading"><div class="download-heading"><div><div class="eyebrow">DOWNLOAD GROWTH</div><h3 id="download-heading">Tăng trưởng lượt tải</h3></div><div class="segments download-periods" aria-label="Khoảng thời gian biểu đồ lượt tải">${[7, 30, 90, 365].map((days) => `<button data-download-days="${days}" aria-pressed="${days === state.days}" class="${days === state.days ? "selected" : ""}">${days === 365 ? "1 năm" : `${days} ngày`}</button>`).join("")}</div></div><div class="download-range"><span>${model.start} → ${model.end} · UTC</span><label>Đến ngày <input type="date" aria-label="Ngày kết thúc biểu đồ lượt tải" value="${state.end}" max="${today}"></label></div><div class="download-stats">${stat("Lượt tải trong kỳ", number(n.total), n.total == null ? `Có ${n.count}/${state.days} ngày dữ liệu` : model.points.some((p) => p.current?.estimated) ? "Có dữ liệu ước tính" : "Theo báo cáo")}${stat("So với kỳ trước", signed(n.growth), `Kỳ trước: ${number(n.previous)} lượt`, n.growth > 0 ? "download-up" : n.growth < 0 ? "download-down" : "")}${stat("Trung bình / ngày", number(n.total == null ? null : n.total / state.days), "Chỉ tính khi đủ kỳ")}${stat("Ngày cao nhất", number(model.peak), n.count === state.days ? "Trong kỳ đang chọn" : "Trong các ngày đã có dữ liệu")}</div><div class="download-chart-surface">${hasPoints ? graph(model) : '<div class="download-empty"><span>↗</span><h4>Chưa có lịch sử lượt tải cho game này</h4><p>Khi có báo cáo lượt tải hằng ngày, biểu đồ tăng giảm sẽ xuất hiện tại đây. Hiện tool đang thu thập thứ hạng và thông tin cửa hàng.</p><p>Nhập báo cáo bằng <code>npm run import -- downloads.json</code></p></div>'}<div class="download-legend"><span><i class="current"></i>Kỳ đang xem</span><span><i class="previous"></i>Kỳ trước (${state.days} ngày)</span><span>${model.estimated ? "Có dữ liệu ước tính" : "Theo báo cáo nguồn"}</span></div></div><p class="download-footnote">${n.count < state.days && hasPoints ? `Thiếu ${state.days - n.count} ngày trong kỳ. Đường biểu đồ ngắt tại ngày thiếu; không tính tổng kỳ từ dữ liệu chưa đủ.<br>` : ""}${latest ? `Dữ liệu lượt tải mới nhất: ${latest}.${stale ? " Dữ liệu chưa được cập nhật gần đây." : ""}<br>` : ""}${model.sources.length ? `Nguồn: ${model.sources.map(escape).join(", ")}.<br>` : ""}Tăng tốc: ${n.acceleration == null ? "chưa đủ ba kỳ dữ liệu" : `${number(n.acceleration)} điểm phần trăm${n.comparisonEstimated ? " (có dữ liệu ước tính)" : ""}`}. Lượt tải và thứ hạng là hai chỉ số riêng.</p>${hasPoints ? `<details class="download-table"><summary>Xem số liệu từng ngày</summary><div class="download-table-scroll"><table><thead><tr><th>NGÀY</th><th>LƯỢT TẢI</th><th>NGÀY KỲ TRƯỚC</th><th>LƯỢT TẢI KỲ TRƯỚC</th><th>NGUỒN KỲ NÀY</th></tr></thead><tbody>${model.points.map((p) => `<tr><td>${p.date}</td><td>${number(p.current?.downloads)}${p.current?.estimated ? " (ước tính)" : ""}</td><td>${p.previousDate}</td><td>${number(p.previous?.downloads)}${p.previous?.estimated ? " (ước tính)" : ""}</td><td>${escape(p.current?.source ?? "Chưa có dữ liệu")}</td></tr>`).join("")}</tbody></table></div></details>` : ""}</section>`;
    const sourceUrl = records.find((p) =>
      p.sourceUrl?.startsWith("https://"),
    )?.sourceUrl;
    const explanation =
      selected.metric === "public-counter-change"
        ? "Biến động bộ đếm cài đặt Google Play giữa hai ngày liên tiếp; thời điểm Google cập nhật có thể trễ. Không phải số người dùng mới hoặc báo cáo Play Console."
        : selected.metric === "download-estimate"
          ? "Lượt tải ước tính do nguồn cung cấp theo ngày; số đã làm tròn, không phải báo cáo nội bộ của nhà phát hành."
          : "Dữ liệu từ báo cáo lượt tải đã nhập.";
    element
      .querySelector(".download-heading")
      .insertAdjacentHTML(
        "afterend",
        `<div class="download-source"><label>Nguồn biểu đồ <select aria-label="Nguồn dữ liệu lượt tải">${series.map((s) => `<option value="${escape(s.id)}" ${s.id === selected.id ? "selected" : ""}>${escape(s.label)}</option>`).join("")}</select></label><p><strong>${selected.scope === "global" ? "Phạm vi: Toàn cầu. Không phải lượt tải riêng tại Việt Nam hay Mỹ." : "Phạm vi: thị trường của báo cáo."}</strong> ${explanation} ${sourceUrl ? `<a href="${escape(sourceUrl)}" target="_blank" rel="noopener noreferrer">Xem nguồn ↗</a>` : ""}</p></div>`,
      );
    if (!hasPoints) {
      element.querySelector(".download-empty p").textContent = records.length
        ? "Khoảng ngày đang chọn chưa có dữ liệu. Hãy chọn ngày kết thúc nằm trong lịch sử của nguồn."
        : "Tool tự tìm lịch sử công khai và số ước tính; game này chưa có dữ liệu tại các nguồn đang hỗ trợ. Bạn vẫn có thể nhập báo cáo riêng.";
      element.querySelector(".download-legend>span:last-child").textContent =
        "Chưa có dữ liệu trong kỳ";
    }
    const confidence = (value) =>
      ({ high: "cao", medium: "trung bình", low: "thấp" })[value] ?? value;
    if (selected.metric === "download-estimate" && hasPoints) {
      const table = element.querySelector(".download-table table");
      const heading = document.createElement("th");
      heading.textContent = "ĐỘ TIN CẬY";
      table.querySelector("thead tr").append(heading);
      table.querySelectorAll("tbody tr").forEach((row, i) => {
        const cell = document.createElement("td");
        cell.textContent = confidence(
          model.points[i].current?.confidence ?? "—",
        );
        row.append(cell);
      });
    }
    element.querySelector("select").addEventListener("change", (event) => {
      state.seriesId = event.target.value;
      state.end = series.find((s) => s.id === state.seriesId).latest ?? today;
      render("source");
      options.onChange?.({ ...state });
    });
    element.querySelectorAll("[data-download-days]").forEach((button) =>
      button.addEventListener("click", () => {
        state.days = Number(button.dataset.downloadDays);
        render(state.days);
        options.onChange?.({ ...state });
      }),
    );
    element.querySelector("input").addEventListener("change", (event) => {
      const value = event.target.value;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        value > today ||
        dateKey(value) !== value
      ) {
        event.target.value = state.end;
        return;
      }
      state.end = value;
      render("date");
      options.onChange?.({ ...state });
    });
    if (hasPoints) {
      let index = model.points.length - 1;
      const plot = element.querySelector(".download-plot"),
        output = element.querySelector("output"),
        cursor = element.querySelector(".download-cursor");
      function inspect(i) {
        index = Math.max(0, Math.min(model.points.length - 1, i));
        const p = model.points[index],
          x = L + (index / Math.max(1, model.points.length - 1)) * (R - L);
        cursor.setAttribute("x1", x);
        cursor.setAttribute("x2", x);
        const value = (row) =>
          row
            ? `${number(row.downloads)} lượt${row.estimated ? " (ước tính)" : ""}${row.confidence ? ` · độ tin cậy ${confidence(row.confidence)}` : ""}`
            : "chưa có dữ liệu";
        output.textContent = `${p.date}: ${value(p.current)} · Kỳ trước ${p.previousDate}: ${value(p.previous)}`;
      }
      inspect(index);
      const inspectPointer = (event) => {
        const rect = plot.getBoundingClientRect();
        inspect(
          Math.round(
            ((((event.clientX - rect.left) / rect.width) * W - L) / (R - L)) *
              (model.points.length - 1),
          ),
        );
      };
      plot.addEventListener("pointermove", inspectPointer);
      plot.addEventListener("pointerdown", inspectPointer);
      plot.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        inspect(
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? model.points.length - 1
              : index + (event.key === "ArrowLeft" ? -1 : 1),
        );
      });
    }
    if (focus)
      element
        .querySelector(
          focus === "date"
            ? "input"
            : focus === "source"
              ? "select"
              : `[data-download-days="${focus}"]`,
        )
        ?.focus();
  }
  render();
  options.onChange?.({ ...state });
}
