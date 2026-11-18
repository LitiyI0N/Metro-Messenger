const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Database = require('better-sqlite3'); // Если ты его не подключал, закомментируй эту строку и код с db

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ЕСЛИ БАЗЫ НЕТ, ОСТАВЬ ТОЛЬКО ЭТИ ДВЕ СТРОКИ:
let messages = []; 
let avatars = {}; // Тут храним аватарки в оперативке

// Раздаем index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const USERS = {
  'LitiyI0N': { pass: 'MSCONFIG26', id: 1 },
  'Usman24':  { pass: 'AnapaZOV2022', id: 2 }
};

let onlineUsers = {}; 

io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('login', (data, callback) => {
    const user = USERS[data.login];
    if (user && user.pass === data.pass) {
      currentUser = { id: user.id, login: data.login };
      onlineUsers[currentUser.id] = socket.id;
      
      // Отдаем историю и текущие аватарки
      callback({ 
          ok: true, 
          user: currentUser, 
          messages: messages, 
          avatars: avatars, // <--- Отдаем аватарки
          peers: [{id:1, login:'LitiyI0N'}, {id:2, login:'Usman24'}] 
      });
      
      io.emit('status', { peer_online: true });
    } else {
      callback({ ok: false, error: 'Неверный логин или пароль' });
    }
  });

  // Обновление аватарки
  socket.on('set_avatar', (imgData) => {
    if (!currentUser) return;
    avatars[currentUser.id] = imgData;
    io.emit('avatar_updated', { id: currentUser.id, img: imgData }); // Рассылаем всем
  });

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
    io.emit('new_message', newMsg);
  });

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

  socket.on('typing', () => {
    if (!currentUser) return;
    socket.broadcast.emit('peer_typing');
  });

  socket.on('clear_chat', () => {
    messages = [];
    io.emit('chat_cleared');
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      delete onlineUsers[currentUser.id];
      io.emit('status', { peer_online: false });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server started on ${PORT}`));
