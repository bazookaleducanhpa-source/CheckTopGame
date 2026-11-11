# CheckTopGame

Website và tool theo dõi thị trường game trên **Google Play (Android)** và **App Store (iOS)**. Khám phá game, lưu danh sách theo dõi và so sánh biến động theo tuần, tháng, năm.

## Chạy ngay

Cần **Node.js 22 trở lên** (khuyến nghị Node.js 24).

```bash
npm ci
npm start
```

Mở **http://localhost:3000**. Repository đã có dữ liệu thật từ top 30 × 2 nền tảng × 2 quốc gia, không phải dữ liệu demo. Danh mục giữ cả game đã rời top nên tổng số bản ghi có thể lớn hơn 120. Thời điểm quan sát được hiển thị trên website. Một game có thể xuất hiện ở nhiều thị trường.

Lấy dữ liệu mới bằng nút **Cập nhật dữ liệu** khi server đang chạy, hoặc:

```bash
npm run collect
```

## Chức năng đã có

- Dashboard và bảng xếp hạng game miễn phí, lấy dữ liệu thực từ hai cửa hàng.
- Lọc thị trường Việt Nam / Hoa Kỳ, Android / iOS, thể loại; tìm tên game và nhà phát hành.
- Xem icon, ảnh chụp màn hình, mô tả, phiên bản, đánh giá và link mở trực tiếp cửa hàng.
- Lưu / bỏ theo dõi game bằng localStorage, giữ danh sách sau khi tải lại trang và đồng bộ giữa các tab cùng trình duyệt.
- Lưu lịch sử mỗi game/thị trường/nền tảng theo ngày UTC; vẽ biểu đồ thứ hạng khi đủ quan sát.
- Chọn kỳ 7 / 30 / 365 ngày; sắp xếp theo thứ hạng, tăng hạng, điểm, biến động đánh giá hoặc chỉ số lượt tải khi có dữ liệu.
- Tính lượt tải trong kỳ, tăng trưởng và tăng tốc từ báo cáo lượt tải hằng ngày được nhập vào tool.
- Xuất danh sách đang lọc thành CSV; phân trang và giao diện responsive cho điện thoại.
- Trang nguồn dữ liệu: tình trạng từng nguồn, lần chạy gần nhất, lỗi và thời điểm thành công gần nhất.
- Tự thu thập mỗi 6 giờ khi server chạy; GitHub Actions cũng có lịch 6 giờ để tích lũy dữ liệu ngay cả khi máy cá nhân tắt. Trang đang mở tải lại dataset mỗi 5 phút.

## Những con số nào có thật?

| Chỉ số | Nguồn / giới hạn |
| --- | --- |
| Thứ hạng | Bảng game miễn phí Google Play và Apple RSS, theo từng quốc gia |
| Tên, ảnh, mô tả, đánh giá | Trang Google Play và Apple Lookup; có thể thiếu nếu nguồn lỗi hoặc không có dữ liệu |
| Mốc cài đặt Android | Mốc tích lũy công khai trên Google Play, có phạm vi toàn cầu; không dùng làm lượt tải trong kỳ hoặc lượt tải tại quốc gia đang chọn |
| Lượt tải theo ngày | Cần nhập báo cáo từ nguồn riêng; nguồn công khai hiện dùng không có chỉ số này cho mọi game |
| Tăng trưởng lượt tải | Chỉ tính khi đủ dữ liệu cho hai kỳ liên tiếp và kỳ trước lớn hơn 0 |
| Tăng tốc lượt tải | Chênh lệch tỷ lệ tăng trưởng giữa hai kỳ, đơn vị điểm phần trăm; cần ba kỳ dữ liệu |

**Không sinh lượt tải giả, không lấy số đánh giá hoặc thứ hạng thay cho lượt tải.** Các cột thiếu dữ liệu hiển thị `—`. Thứ hạng và đánh giá là tín hiệu riêng. Chưa có nguồn lượt tải theo ngày được tích hợp tự động; bản đầu vẫn theo dõi liên tục được thứ hạng và thông tin cửa hàng.

Lịch sử bắt đầu từ lần thu thập đầu tiên, không hồi tạo dữ liệu quá khứ. Tuần/tháng/năm là cửa sổ **7/30/365 ngày liên tiếp** tính đến ngày UTC hiện tại. Biểu đồ và so sánh dài hạn xuất hiện dần khi tích lũy đủ dữ liệu.

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
  "limit": 30,
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
  import-downloads.mjs Kiểm tra và nhập lượt tải hằng ngày
  build.mjs            Xuất bản static vào dist/
server.mjs             Server local và lịch thu thập
tests/                 Kiểm thử dữ liệu và trình duyệt
.github/workflows/     Lịch thu thập và kiểm thử CI
```

### Nguồn tham khảo

- [Google Play scraper](https://github.com/facundoolano/google-play-scraper) — thư viện đọc dữ liệu công khai, có thể cần cập nhật khi cửa hàng thay đổi cấu trúc.
- [Apple Search / Lookup API](https://performance-partners.apple.com/search-api).
- [Apple RSS game miễn phí Việt Nam](https://itunes.apple.com/vn/rss/topfreeapplications/limit=30/genre=6014/json).

Hình ảnh và nội dung game thuộc chủ sở hữu tương ứng, được hiển thị kèm liên kết cửa hàng để khám phá sản phẩm. Không tự ghép hai game Android/iOS thành một sản phẩm nếu chưa xác minh.
