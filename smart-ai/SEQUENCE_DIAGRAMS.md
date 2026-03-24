# Sequence Diagrams - Smart AI Chat System

Tai lieu nay tong hop so do tuan tu cho cac chuc nang chinh cua he thong (REST + Socket realtime).

## 1. Dang ky voi OTP

```mermaid
sequenceDiagram
    actor Client
    participant API as Auth API
    participant OTP as OTP Store (in-memory)
    participant DB as MongoDB(User)
    participant Mail as Mail Service

    Client->>API: POST /api/auth/send-register-otp(email)
    API->>DB: findOne(email)
    alt Email da ton tai
        API-->>Client: 409 Email da duoc su dung
    else Email hop le
        API->>OTP: save otp + expire(5m)
        API->>Mail: sendRegistrationOTPEmail(email, otp)
        Mail-->>API: sent
        API-->>Client: 200 OTP da gui
    end

    Client->>API: POST /api/auth/register(username,email,password,otp)
    API->>OTP: get(email)
    alt OTP sai/het han/khong ton tai
        API-->>Client: 400 Loi OTP
    else OTP hop le
        API->>DB: findOne(email or username)
        alt Ton tai user
            API-->>Client: 409 Trung email/username
        else Chua ton tai
            API->>DB: create user(provider=local)
            API-->>Client: 201 token + user
        end
    end
```

## 2. Dang nhap (Local + Google)

```mermaid
sequenceDiagram
    actor Client
    participant API as Auth API
    participant DB as MongoDB(User,SystemConfig)
    participant Google as Google UserInfo API

    alt Local Login
        Client->>API: POST /api/auth/login(email,password)
        API->>DB: findOne(email)+password
        API->>DB: comparePassword()
        API->>DB: check accountStatus + maintenanceMode
        API-->>Client: 200 token + user
    else Google Login
        Client->>API: POST /api/auth/google(credential)
        API->>Google: validate token + get profile
        Google-->>API: googleId,email,name,picture
        API->>DB: findOne(googleId or email)
        API->>DB: create/merge user
        API->>DB: check maintenanceMode
        API-->>Client: 200 token + user
    end
```

## 3. Quen mat khau (OTP)

```mermaid
sequenceDiagram
    actor Client
    participant API as Auth API
    participant DB as MongoDB(User)
    participant Mail as Mail Service

    Client->>API: POST /api/auth/forgot-password(email)
    API->>DB: findOne(email)
    API->>DB: save resetOTP + resetOTPExpire
    API->>Mail: sendOTPEmail(email, otp)
    API-->>Client: 200 OTP da gui

    Client->>API: POST /api/auth/verify-otp(email,otp)
    API->>DB: validate resetOTP/resetOTPExpire
    API-->>Client: 200 OTP hop le

    Client->>API: POST /api/auth/reset-password(email,otp,newPassword)
    API->>DB: validate OTP
    API->>DB: update password + clear resetOTP
    API-->>Client: 200 Dat lai mat khau thanh cong
```

## 4. Cap nhat profile user

```mermaid
sequenceDiagram
    actor Client
    participant API as User API
    participant Auth as authMiddleware
    participant Multer as Upload Middleware
    participant DB as MongoDB(User)
    participant IO as Socket.io

    Client->>API: PUT /api/users/profile (+avatar/cover)
    API->>Auth: verify JWT
    Auth-->>API: req.user
    API->>Multer: parse files
    API->>DB: findByIdAndUpdate(req.user._id, updates)
    API->>IO: emit user:profile-updated
    API-->>Client: 200 user updated
```

## 5. Quan ly ban be (gui, chap nhan, huy)

```mermaid
sequenceDiagram
    actor UserA
    actor UserB
    participant API as Friend API
    participant DB as MongoDB(Friendship,User)
    participant IO as Socket.io

    UserA->>API: POST /api/friends/request(recipientId=UserB)
    API->>DB: check existing friendship
    API->>DB: create/update friendship(status=pending)
    API->>IO: emit friend:request-received to UserB
    API-->>UserA: friendship pending

    UserB->>API: PUT /api/friends/:id/accept
    API->>DB: validate recipient + pending
    API->>DB: update status=accepted
    API->>IO: emit friend:accepted to both users
    API-->>UserB: friendship accepted

    UserA->>API: DELETE /api/friends/request/:id
    API->>DB: delete pending request
    API->>IO: emit friend:request-cancelled
    API-->>UserA: cancelled
```

## 6. Tao room va quan ly thanh vien

```mermaid
sequenceDiagram
    actor Client
    participant API as Room API
    participant DB as MongoDB(Room,User)
    participant IO as Socket.io

    Client->>API: POST /api/rooms(type=direct|group)
    alt Direct
        API->>DB: findDirectRoom(currentUser,target)
        alt Da ton tai
            API-->>Client: existing room
        else Chua ton tai
            API->>DB: create direct room
            API-->>Client: 201 room
        end
    else Group
        API->>DB: create group room + members
        API-->>Client: 201 room
    end

    Client->>API: POST /api/rooms/:id/members(userId)
    API->>DB: validate member + append user
    API->>IO: emit room:member-added to online members
    API-->>Client: room updated
```

## 7. Nhan tin realtime (Socket)

```mermaid
sequenceDiagram
    actor Sender
    actor Receiver
    participant Socket as Socket.io(message.handler)
    participant DB as MongoDB(Room,Message,User)
    participant Filter as BadWord Filter
    participant Trans as Translation Service

    Sender->>Socket: message:send(roomId, content/type/file)
    Socket->>DB: validate room + sender membership
    Socket->>DB: validate block status + account status
    Socket->>Filter: filterMessage(content)
    Filter-->>Socket: filteredContent
    Socket->>DB: create Message + update Room.lastMessage
    Socket-->>Receiver: message:received
    Socket-->>Receiver: room:new-message
    opt Text message
        Socket->>Trans: translateForRoom(...)
        Trans-->>Socket: async translated events
    end
```

## 8. Trang thai tin nhan (da doc, react, xoa)

```mermaid
sequenceDiagram
    actor Client
    participant Socket as Socket.io(message.handler)
    participant DB as MongoDB(Message)
    participant Room as Socket Room

    Client->>Socket: message:read(roomId,messageId)
    Socket->>DB: addToSet readBy
    Socket-->>Room: message:read-update

    Client->>Socket: message:react(messageId,emoji)
    Socket->>DB: toggle/update reaction
    Socket-->>Room: message:reacted

    Client->>Socket: message:delete(messageId,roomId)
    Socket->>DB: verify sender + mark deleted
    Socket-->>Room: message:deleted
```

## 9. Notes va reply note thanh tin nhan

```mermaid
sequenceDiagram
    actor User
    participant API as Note API
    participant DB as MongoDB(Note,Friendship,Room,Message)
    participant IO as Socket.io

    User->>API: POST /api/notes(content)
    API->>DB: delete old note of user
    API->>DB: create note
    API->>IO: emit note:new
    API-->>User: 201 note

    User->>API: POST /api/notes/:id/reply(content)
    API->>DB: find note + findOrCreate direct room
    API->>DB: create message(replyToNote)
    API->>DB: update room.lastMessage
    API->>IO: emit message:received + room:new-message
    API-->>User: roomId
```

## 10. Upload file

```mermaid
sequenceDiagram
    actor Client
    participant API as Upload API
    participant Auth as authMiddleware
    participant Multer as multer
    participant FS as uploads/

    Client->>API: POST /api/upload or /multiple
    API->>Auth: verify JWT
    API->>Multer: parse and save file(s)
    Multer->>FS: write file(s)
    API-->>Client: file URL(s) + metadata
```

## 11. User actions (block, unblock, report)

```mermaid
sequenceDiagram
    actor UserA
    actor UserB
    participant API as UserActions API
    participant DB as MongoDB(User,Report)
    participant IO as Socket.io

    UserA->>API: POST /api/user-actions/block/:userId
    API->>DB: add userId to blockedUsers
    API->>IO: emit user:block-updated(action=block) to UserB
    API-->>UserA: blockedUsers

    UserA->>API: DELETE /api/user-actions/block/:userId
    API->>DB: remove userId from blockedUsers
    API->>IO: emit user:block-updated(action=unblock) to UserB
    API-->>UserA: blockedUsers

    UserA->>API: POST /api/user-actions/report
    API->>DB: create report
    API-->>UserA: 201 report created
```

## 12. Quan tri he thong (Admin)

```mermaid
sequenceDiagram
    actor Admin
    participant API as Admin API
    participant Mid as auth + admin middleware
    participant DB as MongoDB(User,Report,BadWord,SystemConfig,AdminLog)
    participant IO as Socket.io

    Admin->>API: PUT /api/admin/users/:id/ban
    API->>Mid: verify admin/super_admin
    API->>DB: update accountStatus=banned
    API->>IO: emit account:banned + user:status-updated
    API->>DB: insert AdminLog
    API-->>Admin: user banned

    Admin->>API: PUT /api/admin/config (maintenanceMode=true)
    API->>DB: upsert SystemConfig
    API->>IO: disconnect non-admin sockets
    API->>DB: insert AdminLog
    API-->>Admin: config updated
```

## 13. Goi video/thoai + WebRTC signaling

```mermaid
sequenceDiagram
    actor Caller
    actor Callee
    participant Socket as Socket.io(webrtc.handler)
    participant Active as activeCalls(in-memory)
    participant DB as MongoDB(User,Message)

    Caller->>Socket: call:initiate(roomId,callType,targetUserIds)
    Socket->>Active: create call session
    Socket->>DB: find target socketId
    Socket-->>Callee: call:incoming

    Callee->>Socket: call:accept(roomId,callerId)
    Socket->>Active: add participant
    Socket-->>Caller: call:accepted

    Caller->>Socket: webrtc:offer(targetUserId,sdp)
    Socket-->>Callee: webrtc:offer
    Callee->>Socket: webrtc:answer(targetUserId,sdp)
    Socket-->>Caller: webrtc:answer
    Caller->>Socket: webrtc:ice-candidate
    Socket-->>Callee: webrtc:ice-candidate

    Caller->>Socket: call:end(roomId)
    Socket->>Active: close call
    Socket->>DB: create system message(call ended)
    Socket-->>Callee: call:ended
```

## 14. AI Assistant (tom tat, hoi dap, dich)

```mermaid
sequenceDiagram
    actor User
    participant Socket as Socket.io(ai.handler)
    participant DB as MongoDB(Room)
    participant AI as AI Service(Gemini)

    User->>Socket: ai:chat(roomId, message)
    Socket->>DB: validate membership
    Socket-->>User: ai:thinking
    Socket->>AI: generateAIResponse(prompt, roomId)
    AI-->>Socket: response
    Socket-->>User: ai:chat-response(private)

    User->>Socket: ai:summarize(roomId,messageCount)
    Socket->>AI: summarizeConversation(roomId, messageCount)
    AI-->>Socket: summary
    Socket-->>User: ai:chat-response(summary)

    User->>Socket: ai:translate(messageId,content,targetLanguage)
    Socket->>AI: translateText(...)
    AI-->>Socket: translated text
    Socket-->>User: ai:translate-result
```

---

Neu ban muon, minh co the tach tiep theo tung endpoint chi tiet (1 endpoint = 1 sequence diagram rieng) cho tai lieu SRS/SDD.
