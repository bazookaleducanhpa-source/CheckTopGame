# CheckTopGame

CheckTopGame là dự án website theo dõi và khám phá các game đang tăng trưởng trên **Google Play (Android)** và **App Store (iOS)**. Mục tiêu là giúp người dùng phát hiện game đang tăng tốc lượt tải, so sánh xu hướng và theo dõi các game quan tâm liên tục tại một nơi.

> Trạng thái: đang lên ý tưởng và xác định yêu cầu. Repository hiện chưa có website hoạt động hay hệ thống thu thập dữ liệu.

## Chức năng dự kiến

### Bảng xếp hạng game tăng trưởng

- Xem game có lượt tải tăng nhanh theo **tuần, tháng và năm**.
- Hiển thị lượt tải trong kỳ, mức tăng tuyệt đối và tỷ lệ tăng so với kỳ trước khi có dữ liệu tương ứng.
- Phân biệt game có tổng lượt tải lớn với game đang tăng tốc mạnh.
- Lọc theo Android/iOS, quốc gia, thể loại và khoảng thời gian.
- Sắp xếp theo lượt tải, tốc độ tăng trưởng, thứ hạng hoặc điểm đánh giá.

### Thông tin và liên kết game

- Mỗi game có ảnh biểu tượng, tên, nhà phát hành, nền tảng, thể loại và mô tả ngắn.
- Hiển thị ảnh chụp màn hình, điểm đánh giá và số lượt đánh giá khi nguồn dữ liệu cung cấp.
- Bấm vào thẻ game để mở trang chi tiết trong website.
- Có nút mở trực tiếp trang game trên Google Play hoặc App Store và website nhà phát hành khi có.
- Liên kết hai phiên bản Android/iOS của cùng một game khi xác minh được chúng thuộc cùng sản phẩm.

### Theo dõi liên tục

- Thêm game vào danh sách theo dõi để kiểm tra biến động nhanh.
- Biểu đồ lịch sử lượt tải, tăng trưởng và thứ hạng theo thời gian.
- Lưu ảnh chụp dữ liệu theo kỳ để so sánh tuần/tháng/năm.
- Tự động cập nhật theo lịch phù hợp với nguồn dữ liệu; hiển thị thời điểm cập nhật gần nhất và tình trạng dữ liệu.
- Dự kiến hỗ trợ cảnh báo khi game tăng trưởng vượt ngưỡng hoặc thay đổi thứ hạng đáng kể.

## Các trang dự kiến

| Trang | Nội dung |
| --- | --- |
| Tổng quan | Các game nổi bật, tăng trưởng nhanh và xu hướng mới |
| Bảng xếp hạng | Danh sách có bộ lọc và lựa chọn tuần/tháng/năm |
| Chi tiết game | Ảnh, thông tin, biểu đồ, nguồn dữ liệu và liên kết cửa hàng |
| Danh sách theo dõi | Các game đã lưu và biến động gần nhất |

## Nguyên tắc dữ liệu

- Phân biệt rõ **số liệu do nguồn cung cấp**, **ước tính** và **dữ liệu chưa có**; không trình bày số ước tính như số lượt tải chính xác.
- Khả năng lấy lượt tải theo tuần/tháng/năm phụ thuộc vào nguồn dữ liệu và quyền truy cập. Cần khảo sát nguồn/API trước khi cam kết độ phủ cho từng nền tảng.
- Nếu không có dữ liệu lượt tải đáng tin cậy, hiển thị trạng thái chưa có dữ liệu; các chỉ số như thứ hạng hoặc số lượt đánh giá được trình bày riêng, không thay thế âm thầm cho lượt tải.
- Mỗi chỉ số cần có nguồn, thị trường, kỳ đo và thời điểm cập nhật để người dùng hiểu đúng phạm vi so sánh.
- Tăng trưởng theo kỳ được tính bằng `(lượt tải kỳ này - lượt tải kỳ trước) / lượt tải kỳ trước × 100%` khi có đủ dữ liệu và kỳ trước lớn hơn 0. Nếu kỳ trước bằng 0 hoặc thiếu dữ liệu, hiển thị trạng thái phù hợp thay vì tỷ lệ gây hiểu nhầm.
- Tăng tốc tăng trưởng được đánh giá qua sự thay đổi tốc độ tăng trưởng giữa các kỳ liên tiếp có độ dài tương đương.
- Sử dụng ảnh, nội dung và dữ liệu theo điều kiện của nguồn cung cấp.

## Lộ trình dự kiến

1. Khảo sát nguồn dữ liệu cho Google Play và App Store; xác định độ phủ, chi phí và tần suất cập nhật.
2. Xây dựng giao diện tổng quan, bảng xếp hạng và trang chi tiết với dữ liệu mẫu được gắn nhãn rõ ràng.
3. Tích hợp nguồn dữ liệu thực, lưu lịch sử và lập lịch cập nhật tự động.
4. Bổ sung danh sách theo dõi, biểu đồ so sánh và cảnh báo tăng trưởng.

## Công nghệ và cách chạy

Chưa chốt công nghệ triển khai. Hướng dẫn cài đặt, cấu hình nguồn dữ liệu và chạy website sẽ được bổ sung khi có mã nguồn.
