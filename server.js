const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Отдаем index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Твои аккаунты
const USERS = {
  'LitiyI0N': { pass: 'MSCONFIG26', id: 1 },
  'Usman24':  { pass: 'AnapaZOV2022', id: 2 }
};

// Хранилище сообщений в памяти (при перезагрузке сервера история очистится)
// Если хотите сохранность - потом прикрутим SQLite, но для начала и так сойдет.
let messages = []; 
let onlineUsers = {}; // user_id -> socket.id
let typingTimers = {}; // user_id -> timeout

io.on('connection', (socket) => {
  let currentUser = null;

  // Вход
  socket.on('login', (data, callback) => {
    const user = USERS[data.login];
    if (user && user.pass === data.pass) {
      currentUser = { id: user.id, login: data.login };
      onlineUsers[currentUser.id] = socket.id;
      
      // Отправляем историю
      callback({ ok: true, user: currentUser, messages: messages, peers: [{id:1, login:'LitiyI0N'}, {id:2, login:'Usman24'}] });
      
      // Оповещаем всех, что мы онлайн
      io.emit('status', { peer_online: true });
    } else {
      callback({ ok: false, error: 'Неверный логин или пароль' });
    }
  });

  // Новое сообщение
  socket.on('send_message', (msg) => {
    if (!currentUser) return;
    
    const newMsg = {
      id: Date.now(),
      sender_id: currentUser.id,
      recipient_id: msg.to,
      body: msg.body,
      image: msg.image,
      reply_to: msg.reply_to,
      ts: Date.now(),
      read: false
    };
    
    messages.push(newMsg);
    io.emit('new_message', newMsg); // Рассылаем всем (вас же двое)
  });

  // Отметка о прочтении
  socket.on('mark_read', () => {
    if (!currentUser) return;
    let changed = false;
    messages.forEach(m => {
      if (m.recipient_id === currentUser.id && !m.read) {
        m.read = true;
        changed = true;
      }
    });
    if (changed) io.emit('messages_read');
  });

  // Печатает...
  socket.on('typing', () => {
    if (!currentUser) return;
    socket.broadcast.emit('peer_typing');
  });

  // Очистка чата
  socket.on('clear_chat', () => {
    messages = [];
    io.emit('chat_cleared');
  });

  // Отключение
  socket.on('disconnect', () => {
    if (currentUser) {
      delete onlineUsers[currentUser.id];
      io.emit('status', { peer_online: false });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
