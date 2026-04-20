# Figma Handoff Spec - Smart AI Chat

## 1) Mục tiêu
Tài liệu này chuyển toàn bộ mã nguồn hiện tại thành đặc tả thiết kế để dựng Figma full app.

Phạm vi bao phủ:
- Toàn bộ route public và private
- Toàn bộ luồng chính: Auth, Chat, Friend, Call, Profile, Settings, Group, Admin, Office
- Thành phần dùng lại, trạng thái tương tác, trạng thái lỗi
- Luồng dữ liệu và sự kiện realtime cần annotate trong prototype

Kết quả mong muốn:
- Team design dựng xong file Figma mà không cần đọc lại code
- Team dev đối chiếu frame với cấu trúc thực tế để triển khai không lệch

---

## 2) Nguồn tham chiếu code
Frontend trọng tâm:
- smart-ai/frontend/src/routes/AppRoutes.jsx
- smart-ai/frontend/src/pages/ChatPage.jsx
- smart-ai/frontend/src/components/chat/ChatWindow.jsx
- smart-ai/frontend/src/components/friend/FriendPanel.jsx
- smart-ai/frontend/src/pages/ProfilePage.jsx
- smart-ai/frontend/src/pages/SettingsPage.jsx
- smart-ai/frontend/src/pages/GroupProfilePage.jsx
- smart-ai/frontend/src/pages/AdminPage.jsx
- smart-ai/frontend/src/pages/OfficePage.jsx
- smart-ai/frontend/src/services/api.js

Backend đối chiếu nghiệp vụ:
- smart-ai/backend/controllers/*.js
- smart-ai/backend/routes/*.js
- smart-ai/backend/socket/*.js
- smart-ai/backend/models/*.js

---

## 3) Cấu trúc file Figma đề xuất
Tạo 16 pages trong Figma theo thứ tự:

1. 00 Foundations
2. 01 Auth
3. 02 Chat Shell
4. 03 Room List and Sidebar
5. 04 Chat Window and Messages
6. 05 Room Info Sidebar
7. 06 Friend Panel
8. 07 Calls
9. 08 Profile and Settings
10. 09 Group Profile
11. 10 Admin
12. 11 Office
13. 12 Modals and Overlays
14. 13 Components Base
15. 14 Components Feature
16. 15 Responsive and QA

Quy ước đặt tên frame:
Feature / Section / State / Variant

Ví dụ:
- Chat / Window / Default / Desktop
- Friend / Requests / Empty / Light
- Call / Incoming / Ringing / Mobile
- Admin / Users / Lock Confirm / Super Admin

---

## 4) Information Architecture và route map

### Public routes
- /login
- /register
- /forgot-password
- /verify-otp
- /reset-password

### Private routes
- /
- /settings
- /profile/:id
- /group/:id
- /admin
- /office

### Điều kiện guard
- Public route: nếu đã đăng nhập thì điều hướng về /
- Private route: nếu chưa đăng nhập thì điều hướng về /login
- Khi loading auth: hiển thị loading skeleton screen

---

## 5) Design foundations

### 5.1 Grid và layout
- Desktop: 1440
- Tablet: 1024
- Mobile: 390
- Chat shell desktop: sidebar trái cố định, nội dung chat giữa, info sidebar phải dạng mở rộng
- Mobile: sidebar ẩn khi đã chọn room, có hành vi quay lại

### 5.2 Spacing scale
- 4, 8, 12, 16, 20, 24, 32, 40, 48

### 5.3 Radius
- Input: 10
- Card: 12
- Modal: 16
- Bubble: 18-22
- Pill badge: 999

### 5.4 Shadow
- S1: nhẹ cho card
- S2: modal và panel nổi
- S3: call modal và overlay ưu tiên cao

### 5.5 Typography
Khuyến nghị dùng:
- Primary: Be Vietnam Pro
- Secondary: Inter

Scale:
- H1: 28/36 semibold
- H2: 22/30 semibold
- H3: 18/26 semibold
- Body L: 16/24 regular
- Body M: 14/22 regular
- Body S: 12/18 regular
- Label XS: 11/16 medium

### 5.6 Color tokens
Do app hỗ trợ nhiều theme, dùng token semantic thay vì hardcode:
- bg.page
- bg.card
- bg.subtle
- text.primary
- text.secondary
- text.inverse
- border.default
- border.strong
- action.primary
- action.primary.hover
- action.success
- action.danger
- status.online
- status.warning
- status.locked

Tối thiểu cần tạo 3 theme preview:
- Light
- Glassmorphism
- Neon Night

### 5.7 Icon set
- Lucide icon đồng nhất toàn app
- Kích thước chuẩn: 14, 16, 18, 20

---

## 6) Component inventory và variants

### 6.1 Base components
1. Button
- Variants: Primary, Secondary, Ghost, Danger
- Sizes: S, M, L
- States: default, hover, focus, pressed, disabled, loading

2. Input
- Types: text, password, search, textarea
- States: default, focus, error, disabled, success

3. Tabs
- Segmented tabs cho sidebar và panel
- States: active, inactive, hover, badge-count

4. Badge
- Dot, numeric, pill
- Dùng cho online, request count, role

5. Avatar
- Image, initials, online indicator, offline

6. Toast
- success, error, warning, info

7. Modal shell
- Header, body, footer, close icon
- States: confirm, destructive confirm, loading

### 6.2 Chat feature components
1. Room tile
- direct, group, unread, muted, typing, selected

2. Message bubble
- self, other, system
- text, image, file, location, poll
- translated state
- deleted state

3. Chat header action cluster
- multi-select toggle
- AI toggle
- office entry
- audio call
- video call
- info toggle

4. Message input composer
- idle, typing, uploading, disabled

5. Pinned header
- no pin, one pin, multiple pin

### 6.3 Friend feature components
1. Friend list item
- online, offline
- with quick message action

2. Request item
- incoming with accept/reject
- sent with cancel

3. Search result item
- none, pending, accepted, rejected state chip

4. Suggestions item
- top similarity
- topic affinity
- reason badges
- send request action

### 6.4 Call components
1. Incoming call modal
- audio/video
- accept/reject
- timeout state

2. Active call modal
- single call
- group call
- participant join/leave
- screen sharing on/off

3. Call controls bar
- mic toggle
- cam toggle
- screen share
- end call

### 6.5 Admin components
1. Stats cards
2. Data table
3. Filter bar
4. Action dialog: lock, ban, unban, resolve report
5. Role badge

---

## 7) Page specs chi tiết

## 7.1 Auth
Bao gồm các frame:
- Login default
- Login loading
- Login error
- Register default
- Register validation error
- Forgot password send OTP
- Verify OTP
- Reset password success

Trường chính:
- Email
- Password
- Confirm password
- OTP

Lỗi cần có:
- Sai thông tin đăng nhập
- OTP hết hạn
- Email đã tồn tại
- Mật khẩu yếu

---

## 7.2 Chat Shell
Bố cục:
- User bar trên cùng sidebar trái
- Tabs Messages và Friends
- Room list hoặc FriendPanel
- Vùng chat chính
- Room info sidebar phải mở theo toggle

Frame bắt buộc:
- Desktop default
- Desktop with info sidebar
- Mobile default
- Mobile room selected
- Loading skeleton

---

## 7.3 Room List and Sidebar
Trạng thái:
- Có room
- Không có room
- Có tin chưa đọc
- Có typing indicator
- Room bị mute
- Room bị ẩn

Hành vi:
- Chọn room cập nhật active state
- Mobile tự ẩn sidebar khi vào room

---

## 7.4 Chat Window and Messages
Frame bắt buộc:
- Empty conversation
- Conversation loaded
- Sending state
- File message
- Poll message
- Location message
- Message translated
- Multi-select mode
- Message deleted

Header action states:
- Call enabled
- Call disabled theo policy bạn bè

Input states:
- Idle
- Typing
- Uploading
- Disabled

---

## 7.5 Room Info Sidebar
Direct room:
- Thông tin người dùng
- Nickname
- Mute

Group room:
- Tabs members, pending, about
- Approve/reject member
- Group settings update

---

## 7.6 Friend Panel
Tabs:
- Friends
- Requests
- Search
- Suggestions

Suggestions theo nghiệp vụ mới:
- Nhóm 1: Top Similarity 5 user
- Nhóm 2: Topic Affinity 5 user
- Không trùng user giữa 2 nhóm

Frame bắt buộc:
- Friends empty
- Requests with badge
- Search loading
- Search result with friend statuses
- Suggestions loaded
- Suggestions empty

---

## 7.7 Calls
Luồng 1-1:
- Initiate
- Incoming
- Accepted
- In call
- Ended
- Rejected
- Timeout

Luồng group:
- Group call started
- Invite member
- Participant joined
- Participant left

Policy frame bắt buộc:
- Non-friend call attempt blocked
- Group invite blocked nếu chưa là bạn

---

## 7.8 Profile and Settings
Profile:
- View self
- View other user
- Edit profile
- Upload avatar/cover
- Save success
- Save fail

Settings:
- Theme selection
- Language selection
- Account preferences

---

## 7.9 Group Profile
Frame:
- Overview
- Member list
- Shared media
- Group actions

State:
- Viewer member
- Viewer non-member
- Admin member actions

---

## 7.10 Admin
Tab chính:
- Dashboard
- Users
- Reports
- Bad words
- Config
- Logs

Khác biệt role:
- Sub admin: xem và thao tác giới hạn
- Super admin: toàn quyền cấu hình

Frame lỗi/quyền:
- Permission denied
- Empty data
- API fail retry

---

## 7.11 Office
Page office dạng iframe:
- Header có nút quay lại chat
- Badge username
- Iframe area

States:
- Loading iframe
- Loaded
- Cross-window message sync
- Fallback nếu office URL không truy cập

---

## 8) Data mapping cho annotation trong Figma

Mỗi frame quan trọng nên có annotation block:
- Endpoint sử dụng
- Socket event subscribe và emit
- Điều kiện business rule
- Validation quan trọng

Ví dụ annotation loại:
- Data source
- Mutation
- Realtime update
- Access control
- Empty and error handling

---

## 9) Core user flows để nối prototype

1. Đăng ký -> OTP -> Đăng nhập -> Chat home
2. Chat direct -> gửi tin -> đọc tin -> pin tin
3. Search user -> gửi lời mời -> chấp nhận -> mở gọi
4. Non-friend direct chat -> nhắn tin được -> gọi bị chặn
5. Tạo group -> mời member -> gọi nhóm
6. Mở profile -> chỉnh sửa -> lưu
7. Admin lock user -> user bị khóa realtime
8. Enter office -> sync tên -> quay lại chat

---

## 10) Edge states bắt buộc

Auth:
- Sai mật khẩu
- OTP sai hoặc hết hạn
- Account locked
- Account banned

Chat:
- Mất kết nối socket
- Gửi tin thất bại
- Upload file lỗi
- Room bị xóa trong lúc đang mở

Call:
- Quyền mic/cam bị từ chối
- Call timeout
- Peer connection failed
- Policy friend-gated từ chối gọi

Friend:
- Đã gửi request trước đó
- Đã là bạn
- Request bị hủy ở phía còn lại

Admin:
- Không đủ quyền
- Hành động xung đột dữ liệu

Office:
- Iframe không tải được
- Không nhận được username bridge

---

## 11) Handoff checklist cho team thiết kế

1. Đã dựng đủ 16 pages trong file Figma
2. Đã có token page và style library
3. Đã có component variants đầy đủ trạng thái
4. Đã có frame cho toàn bộ route public/private
5. Đã có frame cho happy path và error path
6. Đã có annotation data và business rules ở frame chính
7. Đã nối prototype cho 8 luồng core
8. Đã có desktop, tablet, mobile cho Chat và Call
9. Đã có section policy call cho non-friend
10. Đã review với dev để chốt mapping tên component

---

## 12) Handoff checklist cho team dev

1. So khớp tên frame với route thật
2. So khớp component variants với component code
3. So khớp call policy states với logic backend socket
4. So khớp suggestions 2 nhóm 5 user với API response
5. So khớp empty và error states với lỗi thực tế từ API/socket

---

## 13) Đầu ra đi kèm cần tạo thêm sau file này

1. COMPONENT_MAP_VI.md
- Bảng component -> file code -> props chính -> states

2. DESIGN_TOKENS_VI.json
- Semantic tokens theo theme

3. FLOW_MATRIX_VI.md
- Mỗi flow: trigger -> API/socket -> next state -> error fallback

4. EDGE_STATE_MATRIX_VI.md
- Danh sách tình huống lỗi và frame tương ứng

---

## 14) Ghi chú giới hạn kỹ thuật

- Môi trường hiện tại không xuất trực tiếp file nhị phân .fig.
- Tài liệu này là blueprint đầy đủ để dựng nhanh trong Figma.
- Nếu cần import bán tự động, dùng plugin phù hợp và xuất thêm schema JSON theo chuẩn plugin đó.

---

## 15) QA tiêu chí nghiệm thu

Pass khi thỏa cả 4 điều kiện:
1. Route coverage đạt 100 phần trăm
2. Core flow coverage đạt 100 phần trăm
3. Critical edge-state coverage đạt 100 phần trăm
4. Team dev xác nhận frame mapping triển khai không thiếu state nghiệp vụ
