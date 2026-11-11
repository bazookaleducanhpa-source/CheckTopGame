# CheckTopGame

Website và tool theo dõi thị trường game trên **Google Play (Android)** và **App Store (iOS)**. Khám phá game, lưu danh sách theo dõi và so sánh biến động theo tuần, tháng, năm.

## Chạy ngay

Cần **Node.js 22 trở lên** (khuyến nghị Node.js 24).

```bash
npm ci
npm start
```

Mở **http://localhost:3000**. Tool lấy top **100 game miễn phí cho mỗi nền tảng tại mỗi quốc gia**: 100 Google Play + 100 App Store tại Việt Nam và tương tự tại Hoa Kỳ (tối đa 400 vị trí hiện tại). Danh mục giữ cả game đã rời top nên tổng số bản ghi có thể lớn hơn 400. Thời điểm quan sát được hiển thị trên website. Một game có thể xuất hiện ở nhiều thị trường.

Lấy dữ liệu mới bằng nút **Cập nhật dữ liệu** khi server đang chạy, hoặc:

```bash
npm run collect
```

## Chức năng đã có

- Dashboard và bảng xếp hạng game miễn phí, lấy dữ liệu thực từ hai cửa hàng.
- Lọc thị trường Việt Nam / Hoa Kỳ, Android / iOS, thể loại. Ô tìm kiếm tìm trên toàn danh mục, hỗ trợ tiếng Việt không dấu, tên game, nhà phát hành, package ID, App Store ID và link cửa hàng; không bị bộ lọc bảng xếp hạng che kết quả.
- Khi chạy server, tìm trực tiếp Google Play và App Store tại VN/US sau khi ngừng gõ hoặc nhấn Enter. Có thể mở chi tiết và lưu theo dõi game ngoài top 100; thông tin game đã lưu giữ trên trình duyệt sau khi tải lại trang. Game tìm thấy chưa chắc có lịch sử lượt tải.
- Xem icon, ảnh chụp màn hình, mô tả, phiên bản, đánh giá và link mở trực tiếp cửa hàng.
- Cột **Tổng lượt tải** và thẻ tổng tích lũy trong chi tiết game: Android dùng bộ đếm công khai mới nhất, có nguồn/ngày quan sát/phạm vi toàn cầu; nếu chỉ có mốc thì giữ dấu `+`. Có sắp xếp theo tổng và xuất CSV. iOS chưa có tổng tích lũy tại nguồn đang dùng sẽ hiển thị thiếu dữ liệu, không cộng lịch sử ngắn hạn thành tổng toàn thời gian.
- Lưu / bỏ theo dõi game bằng localStorage, giữ danh sách sau khi tải lại trang và đồng bộ giữa các tab cùng trình duyệt.
- Lưu lịch sử mỗi game/thị trường/nền tảng theo ngày UTC; vẽ biểu đồ thứ hạng khi đủ quan sát.
- Chọn kỳ 7 / 30 / 365 ngày; sắp xếp theo thứ hạng, tăng hạng, điểm, biến động đánh giá hoặc chỉ số lượt tải khi có dữ liệu.
- Tự lấy lịch sử Android từ CivCharts (dự phòng AppCurves), đọc bộ đếm Google Play trực tiếp và lấy ước tính iOS từ các trang AppTrendKit công khai. Có thể nhập thêm báo cáo riêng.
- Bấm vào game để xem **biểu đồ tăng trưởng lượt tải**: chọn 7/30/90/365 ngày và ngày kết thúc, đối chiếu đường kỳ trước, xem tổng lượt tải, tăng trưởng, trung bình ngày và ngày cao nhất. Di chuột/chạm hoặc dùng phím trái/phải trên biểu đồ để đọc từng ngày; có bảng số liệu bên dưới.
- Xuất danh sách đang lọc thành CSV; chọn 15/30/50/100 dòng mỗi trang và giao diện responsive cho điện thoại.
- Trang nguồn dữ liệu: tình trạng từng nguồn, lần chạy gần nhất, lỗi và thời điểm thành công gần nhất.
- Tự thu thập mỗi 6 giờ khi server chạy; GitHub Actions cũng có lịch 6 giờ để tích lũy dữ liệu ngay cả khi máy cá nhân tắt. Trang đang mở tải lại dataset mỗi 5 phút.

## Những con số nào có thật?

| Chỉ số | Nguồn / giới hạn |
| --- | --- |
| Thứ hạng | Bảng game miễn phí Google Play và Apple RSS, theo từng quốc gia |
| Tên, ảnh, mô tả, đánh giá | Trang Google Play và Apple Lookup; có thể thiếu nếu nguồn lỗi hoặc không có dữ liệu |
| Bộ đếm Android | Giá trị chi tiết `maxInstalls` trong dữ liệu trang Google Play, bên cạnh mốc làm tròn; lưu quan sát trực tiếp và lịch sử công khai |
| Biến động Android theo ngày | Chênh lệch bộ đếm giữa **hai ngày liên tiếp** từ cùng nguồn; toàn cầu, là tín hiệu tăng trưởng, không phải báo cáo acquisition/người dùng mới |
| Lượt tải iOS theo ngày | Ước tính đã làm tròn từ bảng `Daily app metrics` trên các trang game công khai của AppTrendKit; gắn nhãn nguồn, độ tin cậy và phạm vi toàn cầu |
| Tăng trưởng lượt tải | Chỉ tính khi đủ dữ liệu cho hai kỳ liên tiếp và kỳ trước lớn hơn 0 |
| Tăng tốc lượt tải | Chênh lệch tỷ lệ tăng trưởng giữa hai kỳ, đơn vị điểm phần trăm; cần ba kỳ dữ liệu |

**Không sinh lượt tải giả, không lấy số đánh giá hoặc thứ hạng thay cho lượt tải.** Các cột thiếu dữ liệu hiển thị `—`. Thứ hạng và đánh giá là tín hiệu riêng. Chênh lệch bộ đếm và ước tính của bên thứ ba không phải số lượt tải được nhà phát hành xác nhận.

Lịch sử thứ hạng của dự án bắt đầu từ lần thu thập đầu tiên. Lịch sử lượt tải được nạp lại từ các quan sát có ngày rõ ràng trên nguồn công khai, không hồi tạo bằng mô hình của dự án. Tuần/tháng/năm là cửa sổ **7/30/365 ngày liên tiếp**, tính đến ngày dữ liệu mới nhất của từng nguồn đối với lượt tải; ngày kết thúc luôn được hiển thị. Năm vẫn có thể thiếu vì nguồn chưa có đủ lịch sử.

Biểu đồ lượt tải trong chi tiết game có bộ chọn **nguồn** và mặc định kết thúc vào ngày mới nhất có dữ liệu. Đường nét đứt là kỳ trước có cùng số ngày. Ngày có 0 lượt tải được vẽ tại 0; ngày thiếu để trống và ngắt đường. Không chia đều tổng tháng thành ngày; không phân bổ chênh lệch nhiều ngày thành từng ngày; bộ đếm bị giảm do hiệu chỉnh không bị chuyển thành lượt tải âm hoặc 0. Chỉ tính tổng, trung bình và tăng trưởng khi đủ ngày. Các nguồn và phạm vi được giữ riêng, không nối ngày của hai nhà cung cấp thành một chuỗi.

## Tự động cào lịch sử lượt tải

```bash
npm run collect:downloads
```

Lệnh này cũng tự chạy bên trong `npm run collect`, server và workflow định kỳ. Có cache theo ngày/provider/app để không tải lại lịch sử mỗi lần bấm cập nhật. Không cần API key cho các đường công khai đang dùng.

- **CivCharts:** đọc JSON mà trang chi tiết game công khai đang dùng; chỉ lấy chuỗi `series.android.installs` có ID khớp. Giữ bộ đếm gốc và tính chênh lệch ngày liền kề.
- **AppCurves:** dự phòng khi không có lịch sử CivCharts; dùng Markdown công khai `/app/<package>.md`, chỉ lấy các quan sát mà nguồn hiển thị miễn phí. API đầy đủ và lịch sử bị khóa không được truy cập.
- **Google Play:** mỗi lần đọc trang game, lưu bộ đếm chi tiết công khai vào lịch sử riêng. Cần ít nhất hai ngày liên tiếp để sinh một điểm biến động; nguồn này giúp tiếp tục tích lũy nếu archive ngoài không có game.
- **AppTrendKit:** tìm game qua danh mục Games, App Explorer lọc Games và Top Grossing Games; chỉ chọn game có số ước tính công khai trong bảng. Lấy bảng `Daily app metrics` từ trang game đúng App Store ID. Các giá trị K/M/B được chuyển thành số và giữ nhãn ước tính. Không coi tổng đã làm mượt trên trang là tổng của chuỗi ngày thô.
- Nguồn trả 401/402/403/429 sẽ dừng chuỗi yêu cầu tới nguồn đó, giữ dữ liệu cũ và ghi tình trạng. Không vượt đăng nhập, CAPTCHA hoặc giới hạn trả phí. Yêu cầu được giãn cách; có thể điều chỉnh `downloads` trong `config.json`.
- Dữ liệu toàn cầu dùng key `android:global:<id>` / `ios:global:<id>`. Game và thứ hạng vẫn thuộc VN/US. Báo cáo nhập riêng cho một thị trường được ưu tiên, nguồn toàn cầu là lựa chọn riêng. CSV có các cột scope/provider/as-of/metric.

Lần nạp đầu ngày 2026-11-11 lấy được **3.748 bản ghi ngày cho 75 game** (60 Android, 15 iOS). Đây là kết quả ở thời điểm chạy, không phải cam kết độ phủ mọi game; xem trang Nguồn dữ liệu để biết kết quả mới nhất.

## Tool nhập lượt tải hằng ngày

Tạo file JSON bằng dữ liệu từ nhà cung cấp hoặc báo cáo có quyền sử dụng. Mỗi dòng là **lượt tải trong một ngày**, không phải tổng tích lũy. `key` lấy từ `public/data/catalog.json` theo định dạng `platform:country:appId`.

Ví dụ định dạng (cần thay key và số liệu bằng dữ liệu của bạn):

```json
[
  {
    "key": "android:vn:YOUR_PACKAGE_ID",
    "date": "2026-11-10",
    "downloads": 1500,
    "source": "Tên báo cáo / nhà cung cấp",
    "estimated": true
  }
]
```

```bash
npm run import -- downloads.json
```

- `estimated: true`: số ước tính; `false`: số báo cáo do nguồn cung cấp. Nhãn nguồn và trạng thái ước tính được hiển thị trên website.
- Key phải tồn tại trong danh mục; ngày phải hợp lệ và không ở tương lai; lượt tải là số nguyên không âm.
- Nhập lại cùng key/ngày sẽ thay thế bản ghi cũ. Trùng key/ngày trong cùng file sẽ bị từ chối.
- Kỳ chỉ được cộng khi có đủ tất cả ngày, bao gồm những ngày có lượt tải bằng 0. Không nhập 0 thay cho dữ liệu thiếu.
- So sánh đúng cùng quốc gia, định nghĩa lượt tải và phương pháp đo giữa các kỳ. Tool xác thực cấu trúc; người nhập chịu trách nhiệm về chất lượng và phạm vi dữ liệu của nguồn.
- Chạy lệnh nhập khi không có một lần collect/import khác đang ghi dữ liệu. Với bản static, build và triển khai lại sau khi nhập.

## Cấu hình và chạy liên tục

Sửa `config.json`:

```json
{
  "countries": ["vn", "us"],
  "limit": 100,
  "intervalHours": 6
}
```

Lịch sử nằm trong `public/data/catalog.json`. Mỗi ngày giữ lần quan sát mới nhất cho một game, lưu khoảng 1.100 ngày. Game rời top sẽ được ghi nhận là không có thứ hạng trong bảng, không giữ thứ hạng cũ làm hiện tại. Nếu nguồn lỗi, tool giữ dữ liệu trước đó, ghi lỗi riêng và không tạo quan sát mới cho nguồn đó.

### GitHub Actions

Workflow **Update game data** chạy theo cron mỗi 6 giờ hoặc chạy tay trong **GitHub → Actions → Update game data → Run workflow**. Workflow commit dữ liệu và lịch sử về `main`. Cần cho phép Actions và quyền ghi repository trong cài đặt GitHub; chính sách tổ chức hoặc bảo vệ nhánh có thể chặn bot push. GitHub có thể trì hoãn lịch hoặc tắt lịch ở repository không hoạt động.

Nếu một nguồn lỗi, workflow vẫn lưu tình trạng và kết quả nguồn thành công, sau đó báo thất bại để có thể kiểm tra. Dữ liệu không tự cập nhật nếu cả server lẫn workflow đều không hoạt động.

## Build và triển khai

```bash
npm run build
```

Thư mục `dist/` là website static, có thể đưa lên host static hoặc GitHub Pages. Không cần backend để đọc dữ liệu, tìm kiếm, theo dõi hay xuất CSV. Trên bản static, nút cập nhật chỉ tải lại dataset đã xuất; công việc collect chạy riêng qua CLI/Actions. Cần xuất bản lại `dist/` sau khi dataset thay đổi. Dự án chưa tự cấu hình hosting công khai.

Tìm kiếm trên cửa hàng cần server Node.js (`npm run dev` hoặc `npm start`); bản static chỉ tìm trong dữ liệu đã xuất và có link mở tìm kiếm tại cửa hàng. Endpoint đọc `/api/search?q=...` có cache 10 phút và giới hạn tối đa hai yêu cầu tìm kiếm đồng thời. Các game lấy qua tìm kiếm là kết quả cửa hàng, không tự gán thứ hạng top hoặc lịch sử lượt tải. Game ngoài danh mục được lưu theo dõi trên trình duyệt; lịch thu thập của server hiện vẫn chạy theo danh mục backend.

Chạy server Node.js khi cần nút thu thập trực tiếp và lịch chạy trên máy. Server mặc định chỉ lắng nghe `127.0.0.1`, không cung cấp endpoint quản trị ra Internet. Có thể đổi cổng bằng biến môi trường `PORT`.

## Kiểm thử

```bash
npm test
npm run test:ui
```

- Unit tests: cửa sổ dữ liệu, kỳ thiếu ngày, kỳ trước bằng 0, tăng trưởng, tăng tốc, nhãn ước tính, lịch sử thứ hạng, tìm kiếm và kiểm tra file nhập.
- Browser tests: dữ liệu thật, bộ lọc, trang chi tiết, lưu theo dõi, xuất CSV, trạng thái rỗng, điện thoại và bảo vệ endpoint cập nhật.
- Trên Windows, test trình duyệt dùng Microsoft Edge đã cài. Trên CI dùng Chromium (`npx playwright install --with-deps chromium`). Có thể sửa `playwright.config.js` để dùng trình duyệt khác.
- Workflow **Checks** tự chạy unit tests, build và browser tests khi push mã nguồn hoặc mở pull request.

## Công nghệ và cấu trúc

**Node.js + JavaScript ES modules + HTML/CSS**, không cần database hoặc framework để vận hành bản đầu. `google-play-scraper` đọc Google Play; Apple dùng RSS game miễn phí và Lookup API. Playwright kiểm thử trình duyệt.

```text
public/                Giao diện và module tính chỉ số dùng chung
  data/catalog.json    Danh mục thật, lịch sử, nguồn và báo cáo lượt tải
tools/
  providers.mjs        Bộ đọc dữ liệu hai cửa hàng
  collect.mjs          Thu thập, hợp nhất và lưu quan sát theo ngày
  collect-downloads.mjs Nạp lịch sử công khai và quản lý cache từng nguồn
  download-providers.mjs Đọc counter/Markdown/bảng iOS và suy ra biến động
  import-downloads.mjs Kiểm tra và nhập lượt tải hằng ngày
  build.mjs            Xuất bản static vào dist/
server.mjs             Server local và lịch thu thập
tests/                 Kiểm thử dữ liệu và trình duyệt
.github/workflows/     Lịch thu thập và kiểm thử CI
```

### Nguồn tham khảo

- [Google Play scraper](https://github.com/facundoolano/google-play-scraper) — thư viện đọc dữ liệu công khai, có thể cần cập nhật khi cửa hàng thay đổi cấu trúc.
- [Apple Search / Lookup API](https://performance-partners.apple.com/search-api).
- [Apple RSS game miễn phí Việt Nam](https://itunes.apple.com/vn/rss/topfreeapplications/limit=100/genre=6014/json).
- [CivCharts](https://civcharts.com/) — lịch sử bộ đếm Android từ các lần quan sát của nguồn.
- [AppCurves: dữ liệu và giới hạn](https://appcurves.com/llms.txt) — bộ đếm toàn cầu và Markdown công khai; API đầy đủ cần Pro.
- [AppTrendKit Games](https://www.apptrendkit.com/categories/games) — số ước tính iOS; [ví dụ trang có lịch sử từng ngày](https://www.apptrendkit.com/apps/ios/1617391485).

Hình ảnh và nội dung game thuộc chủ sở hữu tương ứng, được hiển thị kèm liên kết cửa hàng để khám phá sản phẩm. Không tự ghép hai game Android/iOS thành một sản phẩm nếu chưa xác minh.
