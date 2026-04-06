# Chat-Vue Project Context

## Overview

A real-time chat application built with Vue 3, featuring a Telegram-style UI with direct messages and group rooms.

## Tech Stack

- **Frontend**: Vue 3.5.30, Vite 8.0.x
- **State Management**: Pinia 2.1.7
- **Routing**: Vue Router 4
- **UI Framework**: PrimeVue (Aura theme), Tailwind CSS 3.4.x
- **Real-time**: WebSocket connection
- **Backend API**: REST API on `http://192.168.1.103:8080` (configured in `.env`)

## Project Structure

```
src/
├── components/
│   ├── MessageList.vue       # Chat messages display with themes/styling
│   ├── RoomChat.vue          # Group room chat interface
│   ├── DirectMessageChat.vue # DM chat interface
│   ├── ChatsList.vue         # Unified chat list (sidebar) - DEPRECATED, moved to ChatView
│   ├── DefaultView.vue       # Welcome screen when no chat selected
│   ├── ConnectionStatus.vue  # WebSocket connection indicator
│   ├── NotificationBell.vue  # Notification dropdown
│   └── CreateRoomForm.vue    # Room creation form
├── views/
│   ├── ChatView.vue          # Main layout (Telegram-style sidebar + chat area)
│   ├── LoginView.vue         # Authentication screen
│   ├── RoomView.vue          # Room chat route wrapper
│   ├── DMView.vue            # DM chat route wrapper
│   └── CreateRoomView.vue    # Create room route
├── stores/
│   ├── auth.js               # Authentication state, API helper
│   ├── websocket.js          # WebSocket connection management
│   ├── chat.js               # Chat messages, rooms, users, typing indicators
│   ├── chats.js              # Unified chats list (API: /api/chats)
│   └── notifications.js      # App notifications
├── utils/
│   └── notifications.js      # Browser notification service (singleton)
├── router/
│   └── index.js              # Vue Router configuration
└── App.vue                   # Root component with Toast provider
```

## API Endpoints

### REST API

- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/users` - List users
- `GET /api/rooms` - List public rooms
- `GET /api/rooms/my` - List user's rooms
- `POST /api/rooms` - Create room
- `GET /api/rooms/:id/messages` - Room messages
- `POST /api/rooms/:id/messages/read` - Mark room as read
- `GET /api/dm/:userId` - DM messages
- `GET /api/chats` - Unified chats list (rooms + DMs with unread counts)
- `GET /api/chats/:type/:id` - Single chat with messages
- `GET /api/notifications` - User notifications

### WebSocket Events

**Outgoing:**

- `join_room` - Join a room
- `leave_room` - Leave a room
- `room_message` - Send room message
- `direct_message` - Send DM
- `typing` - Typing indicator
- `mark_read` - Mark DM as read

**Incoming:**

- `new_message` - New room message
- `new_direct_message` - New DM
- `user_joined` - User joined room
- `user_left` - User left room
- `user_typing` - Typing indicator
- `user_online` / `user_offline` - Online status
- `notification` - System notification

## Key Features

1. **Telegram-style UI**: Full-height sidebar with chats, main chat area
2. **Unified Chats List**: Combined DMs and rooms with filter tabs (All/DMs/Rooms)
3. **Real-time Updates**: WebSocket for messages, typing, online status
4. **Unread Badges**: Per-chat and total unread counts
5. **Browser Notifications**: Native notifications when tab not focused
6. **Toast Notifications**: In-app notifications with sound
7. **Customizable Chat UI**: Themes, bubble styles, colors
8. **Mobile Responsive**: Sidebar hides on mobile when chat open

## Routes

- `/` - Home (ChatView with DefaultView)
- `/login` - Login page
- `/room/:roomId` - Room chat
- `/dm/:userId` - Direct message
- `/create-room` - Create new room

## Environment Variables (.env)

```
VITE_API_URL=http://192.168.1.103:8080
VITE_WS_URL=ws://192.168.1.103:8080/ws
```

## Current State

- ✅ Telegram-style layout implemented
- ✅ Unified chats store with /api/chats integration
- ✅ Browser notifications service
- ✅ Mark as read functionality
- ✅ Online status indicators
- ✅ Typing indicators in chat list
- ✅ Mobile responsive design

## Known Issues / TODO

- [ ] First unread message scroll not fully tested
- [ ] Online status WebSocket events need backend support
- [ ] Chat search could be enhanced with backend search API
