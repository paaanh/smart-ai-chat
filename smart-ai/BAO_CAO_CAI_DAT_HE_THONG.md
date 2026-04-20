# BÁO CÁO CÀI ĐẶT HỆ THỐNG SMART AI CHAT

## Thông tin chung
- Tên hệ thống: Smart AI Chat
- Kiến trúc tổng thể: Frontend (React + Vite), Backend (Node.js + Express + Socket.io), CSDL MongoDB, tích hợp SkyOffice (Colyseus)
- Mục tiêu: Xây dựng hệ thống chat thời gian thực có AI, gọi video, quản lý bạn bè/phòng chat và khu vực virtual office.

---

## 1) Giới thiệu chung về cài đặt hệ thống

### 1.1 Môi trường cài đặt hệ thống

#### a) Cấu hình máy đề xuất
- CPU: tối thiểu 4 nhân (khuyến nghị Intel Core i5 thế hệ 10+ hoặc tương đương)
- RAM: tối thiểu 8 GB (khuyến nghị 16 GB nếu chạy đồng thời Docker + dev tools)
- Ổ cứng: còn trống tối thiểu 15 GB
- Hệ điều hành: Windows 10/11, macOS, Linux
- Mạng: ổn định (phục vụ npm install, docker pull, API bên thứ 3)

#### b) Phần mềm cần thiết
- Node.js: khuyến nghị bản LTS 20.x
- npm: đi kèm Node.js
- Docker Desktop (nếu cài đặt theo container)
- Git (quản lý source code)
- Trình duyệt hiện đại: Chrome/Edge (test WebRTC, Socket)
- MongoDB:
  - Cách 1: dùng container mongo trong docker-compose
  - Cách 2: cài MongoDB local (nếu chạy thủ công)

#### c) Biến môi trường cần cấu hình (tối thiểu)
- Backend:
  - PORT
  - MONGODB_URI
  - JWT_SECRET
  - GROQ_API_KEY (nếu bật AI service)
  - CORS_ORIGINS
  - MAIL_USER, MAIL_APP_PASSWORD (nếu dùng OTP email)
  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (nếu dùng Google login)
  - METERED_API_KEY, METERED_DOMAIN (nếu dùng TURN động)
- Frontend:
  - VITE_API_URL
  - VITE_GOOGLE_CLIENT_ID
  - VITE_SKYOFFICE_URL

### 1.2 Phương pháp cài đặt hệ thống

#### Phương pháp A - Cài đặt bằng Docker (khuyến nghị)
Bước 1: Di chuyển vào thư mục smart-ai  
Bước 2: Chuẩn bị biến môi trường theo docker-compose.yml  
Bước 3: Chạy lệnh:
- docker compose up --build

Kết quả mong đợi:
- Frontend chat: http://localhost
- Backend API: http://localhost:5000
- SkyOffice client: http://localhost:3000
- MongoDB: localhost:27018

#### Phương pháp B - Cài đặt thủ công (local development)
Bước 1: Cài dependencies backend
- cd backend
- npm install
- npm run dev

Bước 2: Cài dependencies frontend
- cd frontend
- npm install
- npm run dev

Bước 3: Đảm bảo MongoDB đang chạy (local hoặc container)  
Bước 4: Kiểm tra sức khỏe backend tại /api/health

### 1.3 Các tính năng của hệ thống đã cài đặt
- Đăng ký, đăng nhập, đăng nhập Google
- Xác thực OTP cho đăng ký và quên mật khẩu
- Chat realtime (1-1 và nhóm) qua Socket.io
- Quản lý phòng: tạo phòng, mời thành viên, phê duyệt tham gia
- Gọi voice/video qua WebRTC + ICE/TURN
- Trợ lý AI trong khung chat (bật/tắt, tóm tắt nội dung)
- Quản lý bạn bè: gửi lời mời, chấp nhận, từ chối, hủy kết bạn
- Ghi chú bạn bè (note) và phản hồi note
- Báo cáo người dùng, block/unblock
- Trang quản trị (admin): thống kê, quản lý user, report, bad words, config hệ thống, nhật ký
- Tích hợp SkyOffice Virtual Office tại route /office

### 1.4 Các chức năng mới đã bổ sung
- Tư vấn hỗ trợ AI theo danh mục (tâm lý, pháp luật, sức khỏe, giáo dục, bạo lực gia đình)
- Phòng chat theo chủ đề (Topic Room): tạo/chọn/tham gia/rời phòng theo chủ đề
- Gợi ý bạn bè thông minh theo 2 nhóm điểm: tương đồng hồ sơ và mức độ gần theo chủ đề
- Hiển thị gợi ý bạn bè trực tiếp ngay màn hình “Chọn cuộc trò chuyện để bắt đầu”
- Theo dõi tương tác direct chat bằng ChatDuration (tổng tin nhắn, lần tương tác gần nhất)
- Chính sách gọi an toàn: chỉ cho phép gọi khi đã là bạn bè accepted (vẫn giữ nhắn tin không giới hạn)
- Bổ sung nút Home trong cửa sổ chat để quay nhanh về màn chọn cuộc trò chuyện

---

## 2) Kết quả cài đặt hệ thống

### 2.1 Chương trình cài đặt
Hệ thống đã có đầy đủ module để khởi động theo 2 cách:
- Docker Compose cho môi trường đồng nhất
- Chạy riêng backend/frontend cho môi trường phát triển

Sau khi cài đặt thành công:
- Backend khởi tạo Express + Socket.io + Colyseus + kết nối MongoDB
- Frontend khởi tạo giao diện đăng nhập, chat, cài đặt, admin, office
- Uploads được mount và phục vụ static qua /uploads

### 2.2 Giao diện chính
Giao diện chính sau đăng nhập là trang ChatPage, gồm:
- Sidebar trái: thông tin user, tab tin nhắn/bạn bè/chủ đề, danh sách phòng, note bubbles
- Khu vực trung tâm: cửa sổ chat, hiển thị tin nhắn và thao tác chat
- Màn hình trống (khi chưa chọn phòng): có gợi ý bạn bè và thao tác nhanh để bắt đầu cuộc trò chuyện
- Sidebar thông tin phòng (mở rộng): thông tin nhóm/thành viên, cài đặt phòng
- Overlay toàn cục: incoming call modal, call modal, thông báo quyền notification

### 2.3 Giao diện các chức năng chính
- Đăng nhập: form email/password, hỗ trợ Google OAuth
- Đăng ký + OTP: cấp tài khoản local có xác minh OTP
- Quên mật khẩu: gửi OTP và reset password
- Trang cài đặt: cập nhật thông tin cá nhân, ngôn ngữ, avatar
- Trang hồ sơ user/nhóm: hiển thị profile và thông tin liên quan
- Trang admin: dashboard thống kê + tab user/report/bad words/config/logs
- Trang office: iframe SkyOffice, đồng bộ tên người dùng qua postMessage
- Trang tư vấn hỗ trợ (CounselingPage): tạo phiên tư vấn, gửi/nhận phản hồi AI, đóng phiên
- Bảng chủ đề (TopicPanel): lọc, tìm kiếm, tạo và tham gia phòng theo chủ đề

### 2.4 Các giải pháp an toàn, bảo mật hệ thống
- Xác thực JWT cho REST và Socket
- Phân quyền role admin (sub_admin/super_admin)
- Kiểm soát CORS theo whitelist + pattern
- Mật khẩu được hash bằng bcrypt trước khi lưu
- OTP có hạn sử dụng ngắn, có quy trình xóa OTP hết hạn
- Khóa/ban tài khoản và auto-unlock khi hết hạn lock
- Kiểm tra maintenance mode (chỉ admin được vào khi bảo trì)
- Gọi media realtime sử dụng ICE/TURN (có fallback STUN/TURN)
- Friend-gated call policy: chặn cuộc gọi nếu 2 bên chưa là bạn bè accepted

Lưu ý hạn chế hiện tại:
- Chưa thấy cấu hình helmet/rate limit/CSRF trong backend, nên bổ sung cho production.

---

## 3) Đánh giá kết quả cài đặt

### 3.1 Ưu điểm của hệ thống
- Kiến trúc tách lớp rõ ràng: frontend, backend, deploy
- Có 2 cách triển khai linh hoạt: Docker và local
- Hỗ trợ realtime đầy đủ (chat + gọi + office)
- Có module quản trị và xử lý an toàn nội dung (report, bad words)
- Có khả năng mở rộng (AI provider, TURN, OAuth, admin tools)
- Đã bổ sung nhóm tính năng xã hội mới: gợi ý bạn bè, phòng chủ đề, tư vấn AI

### 3.2 Nhược điểm của hệ thống
- Tài liệu README chi tiết cho từng thành phần chưa đầy đủ, cần bổ sung hướng dẫn .env mẫu
- Chưa có middleware hardening phổ biến (helmet, rate limit, anti-bruteforce)
- Đang lưu token phía client qua localStorage (dễ bị ảnh hưởng nếu có XSS)
- Chưa có bộ test tự động (unit/integration/e2e) được mô tả rõ ràng
- Thuật toán gợi ý bạn bè cần thêm dữ liệu thực tế để hiệu chỉnh trọng số tốt hơn

### 3.3 Kiến nghị cải tiến
- Bổ sung file .env.example cho backend và frontend
- Thêm express-rate-limit + helmet + giới hạn OTP resend theo IP/email
- Chuyển JWT sang HttpOnly cookie nếu quy trình frontend cho phép
- Bổ sung pipeline CI với lint + test + security scan
- Viết tài liệu vận hành sự cố (backup MongoDB, xoay secret, monitor)
- Tối ưu thuật toán gợi ý bạn bè bằng đánh giá chất lượng theo nhóm người dùng thật

---

## PHẦN RIÊNG A - CÁC GIAO DIỆN (để đưa ảnh chụp màn hình)

Đề xuất chụp và chèn ảnh theo danh sách:
1. Màn hình đăng nhập
2. Màn hình đăng ký + OTP
3. Màn hình chat chính (sidebar + chat window)
4. Màn hình chọn cuộc trò chuyện (kèm gợi ý bạn bè)
5. Màn hình quản lý bạn bè
6. Màn hình bảng chủ đề
7. Màn hình tư vấn hỗ trợ AI
8. Màn hình thông tin phòng chat
9. Màn hình gọi video/voice (incoming call + in-call)
10. Màn hình admin dashboard
11. Màn hình office (SkyOffice iframe)

Mẫu đặt tên ảnh:
- interfaces/01-login.png
- interfaces/02-register-otp.png
- interfaces/03-chat-main.png
- interfaces/04-chat-start-suggestions.png
- interfaces/05-friend-panel.png
- interfaces/06-topic-panel.png
- interfaces/07-counseling-page.png
- interfaces/08-room-info.png
- interfaces/09-call-modal.png
- interfaces/10-admin-dashboard.png
- interfaces/11-office.png

---

## PHẦN RIÊNG B - PHẦN CODE MINH HỌA

### B.1 Route và điều hướng giao diện
- frontend/src/routes/AppRoutes.jsx
  - Định nghĩa route public/private
  - Lazy load trang, animation chuyển trang

### B.2 Giao tiếp API phía frontend
- frontend/src/services/api.js
  - Axios client
  - Interceptor gắn JWT vào Authorization
  - Xử lý 401 và phát sự kiện auth:logout
  - Gồm endpoint auth, room, friend, admin, notes, upload
  - Bổ sung endpoint counseling, topics, friend suggestions

### B.3 Khởi tạo backend và socket
- backend/index.js
  - Khởi tạo Express, Socket.io, Colyseus
  - Khai báo các route /api/*
  - Health check /api/health
  - API cấp ICE server cho WebRTC

### B.4 Xác thực và phân quyền
- backend/middlewares/auth.middleware.js
  - Kiểm tra JWT cho HTTP và Socket
- backend/middlewares/admin.middleware.js
  - Ràng buộc quyền admin/super admin

### B.5 CORS và cấu hình truy cập
- backend/config/cors.js
  - Whitelist domain + pattern theo biến môi trường

### B.6 Đăng ký/đăng nhập/OTP
- backend/controllers/auth.controller.js
  - Đăng ký có OTP
  - Đăng nhập local + Google
  - Quên mật khẩu, verify OTP, reset mật khẩu

### B.7 CSDL và mô hình mới
- backend/config/db.js
  - Kết nối MongoDB qua MONGODB_URI
- backend/models/CounselingSession.js
  - Lưu phiên tư vấn hỗ trợ AI
- backend/models/TopicRoom.js
  - Lưu metadata phòng chủ đề
- backend/models/ChatDuration.js
  - Theo dõi mức độ tương tác giữa 2 user trong direct chat

### B.8 Chức năng mới minh họa
- backend/controllers/counseling.controller.js + backend/routes/counseling.routes.js
  - API tạo phiên tư vấn, gửi tin, đóng phiên
- backend/controllers/topic.controller.js + backend/routes/topic.routes.js
  - API tạo/lọc/tham gia/rời phòng chủ đề
- backend/controllers/friend.controller.js (getSuggestions)
  - Gợi ý bạn bè theo điểm tương đồng và chủ đề
- backend/socket/webrtc.handler.js
  - Enforce gọi chỉ giữa bạn bè accepted
- backend/socket/message.handler.js
  - Cập nhật ChatDuration khi gửi tin direct chat
- frontend/src/pages/CounselingPage.jsx
  - Giao diện tư vấn hỗ trợ AI
- frontend/src/components/topic/TopicPanel.jsx
  - Giao diện chủ đề chat
- frontend/src/components/chat/ChatWindow.jsx
  - Hiển thị gợi ý bạn bè ở trạng thái chưa chọn cuộc trò chuyện

---

## Kết luận
Hệ thống Smart AI Chat đã đủ điều kiện cài đặt và vận hành với các chức năng cốt lõi: xác thực, chat realtime, gọi video, quản lý bạn bè/phòng, admin và mở rộng AI. Bản hiện tại đã bổ sung thêm nhóm chức năng mới gồm tư vấn AI, phòng chủ đề, gợi ý bạn bè thông minh và chính sách gọi an toàn theo quan hệ bạn bè.

Để đưa vào production ổn định hơn, cần tiếp tục tăng cường hardening bảo mật, hoàn thiện tài liệu cấu hình, và bổ sung bộ test tự động.
