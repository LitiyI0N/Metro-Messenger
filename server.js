const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: '*' },
  maxHttpBufferSize: 1e7 // Фикс для картинок
});

let messages = []; 
let avatars = {}; 
let lastSeen = {}; // <-- Храним время последнего визита

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
      
      // Оповещаем друга, что мы зашли
      socket.broadcast.emit('status', { user_id: currentUser.id, peer_online: true });

      // Отдаем данные при входе
      callback({ 
          ok: true, 
          user: currentUser, 
          messages: messages, 
          avatars: avatars, 
          last_seen: lastSeen, // <-- Передаем историю визитов
          online_peers: Object.keys(onlineUsers).map(Number),
          peers: [{id:1, login:'LitiyI0N'}, {id:2, login:'Usman24'}] 
      });
    } else {
      callback({ ok: false, error: 'Неверный логин или пароль' });
    }
  });

  socket.on('set_avatar', (imgData) => {
    if (!currentUser) return;
    avatars[currentUser.id] = imgData;
    io.emit('avatar_updated', { id: currentUser.id, img: imgData });
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
      lastSeen[currentUser.id] = Date.now(); // <-- Запоминаем время выхода
      
      // Оповещаем друга, что мы вышли
      socket.broadcast.emit('status', { 
        user_id: currentUser.id, 
        peer_online: false, 
        last_seen: lastSeen[currentUser.id] 
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server started on ${PORT}`));
