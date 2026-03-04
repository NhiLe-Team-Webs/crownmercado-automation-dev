# Hướng dẫn Hệ thống Highlight Text & Local Render với Remotion

Tài liệu này giải thích chi tiết cách hệ thống xử lý video tự động, nhận diện giọng nói (Speech-to-Text), trích xuất từ khóa, làm nổi bật (highlight) từ khóa trên video và render (xuất) video trực tiếp trên máy local mà không cần dùng AWS Lambda.

## 1. Tổng quan Kiến trúc

Hệ thống hoạt động theo quy trình (Pipeline) từ Python (Xử lý dữ liệu AI) xuống NodeJS/React (Render Video):

1. **Phân tích âm thanh (Whisper / AssemblyAI)**: Python đọc video gốc, gửi lên AssemblyAI để lấy transcript (kịch bản) kèm timestamps (thời gian chi tiết đến từng từ).
2. **Trích xuất từ khóa (Google Gemini AI)**: Python gửi transcript cho LLM Gemini để phân tích ngữ cảnh và chọn ra các cảnh, câu cần hiển thị text (Overlay), cũng như chọn ra **từ khóa quan trọng (highlight_word)**.
3. **Đồng bộ vào Video Source**: Python tự động ghi đè danh sách Overlay này vào file `Root.tsx` của Remotion.
4. **Render Video (Remotion CLI)**: Ứng dụng dùng câu lệnh terminal gọi Remotion CLI để vẽ giao diện web (React) ở chế độ chạy ngầm (headless) và quay lại màn hình đó thành file `.mp4` hoàn chỉnh.

---

## 2. Chi tiết các File Code Quan trọng

### A. Tầng Logic & AI (Python)
- **`test_pipeline_real.py`**: File chạy thử quy trình thực tế từ A-Z.
  - Sử dụng AssemblyAI để lấy transcript (`transcribe_video()`).
  - Dùng module `GeminiKeywordExtractor` để suy luận Overlay.
  - Sửa đổi trực tiếp file `src/remotion/src/Root.tsx` để truyền mảng overlay vào Remotion.
- **`src/modules/video_processing/infrastructure/adapters/remotion_renderer.py`**:
  - Chứa class `RemotionRenderer`. Chức năng của nó là gọi lệnh terminal `npx remotion render ...` thay cho việc dùng AWS Lambda.

### B. Tầng Giao diện & Render (React / Remotion trong `src/remotion/`)
- **`src/remotion/src/types.ts`**: Nơi định nghĩa cấu trúc dữ liệu `TextOverlay` có chứa thuộc tính **`highlight_word`** (từ cần bôi sáng).
- **`src/remotion/src/components/TextOverlayLayer.tsx`**: Component nhận danh sách các đoạn text từ Python và quyết định lúc nào thì render cái gì (phụ trách điều phối `start` và `end` frames). Nó sẽ nạp props `highlightWord` vào `BRollOverlay`.
- **`src/remotion/src/components/BRollOverlay.tsx`**: **Đây là trái tim của tính năng Highlight**.
  - Tách đoạn text thành từng từ (`text.split(" ")`).
  - Kiểm tra từ hiện tại có chứa chuỗi `highlightWord` hay không (`isHighlight`).
  - Áp dụng các hiệu ứng cho từ khóa được highlight:
    - **Màu sắc**: Luân phiên đổi màu Đỏ (`#ff3333`) hoặc Xanh Cyan (`#00d2ff`).
    - **Phát sáng**: Thêm `textShadow` màu glow tương ứng.
    - **Định dạng**: In hoa chữ cái (`uppercase`), đẩy nhẹ dòng chữ.
    - **Animation**: Vẽ một đường gạch chân phát sáng trượt từ trái sang phải (`scaleX` animation).

---

## 3. Các Câu Lệnh Cần Thiết

### Chạy Quy trình tự động (Pipeline Test)
Để bắt đầu quá trình trích xuất âm thanh và chèn overlay:

```bash
# Đứng ở thư mục gốc của project, chạy file Python:
python test_pipeline_real.py
```
> **Lưu ý**: Đảm bảo bạn đã cấu hình file `.env` chứa `ASSEMBLYAI_API_KEY` và `GEMINI_API_KEY`. Video gốc cần đặt tên là `video test.mp4` và nằm trong `src/remotion/public/`.

### Xem trước Video (Preview/Studio)
Để mở giao diện UI web (Remotion Studio) và xem video xem các hiệu ứng có chuẩn không trước khi xuất file nặng:

```bash
# Di chuyển vào thư mục remotion
cd src/remotion

# Khởi chạy server npm
npm run dev
```
> Trình duyệt sẽ mở ở `http://localhost:3000`. Chọn composition **VideoWithOverlays** để xem.

### Xuất Video về máy Local (Render)
Thay vì đẩy lên AWS, bạn có thể render trực tiếp bằng sức mạnh của máy cá nhân. Đứng tại thư mục `src/remotion/`, chạy một trong các lệnh sau:

```bash
# 1. Render chuẩn (Mặc định) - File xuất ra nằm ở out/video.mp4
npm run render

# 2. Render tốc độ tối đa (Dùng toàn bộ core của CPU, dễ gây lag máy)
npm run render:fast

# 3. Render bản nháp (Giảm kích thước video và chất lượng xuống 50% để xem nhanh)
npm run render:draft
```

---

## 4. Bắt đầu Dành Cho Người Mới

1. Cài đặt các thư viện Python: `pip install assemblyai python-dotenv openai-whisper`
2. Cài đặt package NodeJS: `cd src/remotion` và chạy `npm install`
3. Nhét file video của bạn vào `src/remotion/public/video test.mp4`.
4. Điền API Key vào `.env`.
5. Chạy `python test_pipeline_real.py`. Hệ thống tự làm hết.
6. (Tùy chọn) Chạy `npm run dev` ở thư mục remotion để kiểm tra UI.
7. Chạy `npm run render` (ở thư mục remotion) để tải file hoàn thiện.

Nếu có bất cứ lỗi nào khi gọi Remotion CLI thì kiểm tra lại máy bàn đã cài đặt FFMPEG chưa vì Remotion cần FFMPEG để gom hình ảnh thành video.
