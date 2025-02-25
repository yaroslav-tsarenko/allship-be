const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();
const Chat = require('./models/Chat');
const WebSocket = require('ws');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth.route');
const userRoutes = require('./routes/user.route');
const aiRoutes = require('./routes/ai.route');
const loadRoutes = require('./routes/load.route');
const chatRoutes = require('./routes/chat.route');
const app = express();
const server = http.createServer(app);
const port = 8080;
const fileUpload = require("express-fileupload");
const path = require("path");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(express.json());
app.use(bodyParser.json());
app.use("/images/avatars", express.static(path.join(__dirname, "images", "avatars")));

app.use(helmet());

/*const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
});

app.use(limiter);*/
const wss = new WebSocket.Server({ server });

mongoose.connect("mongodb+srv://yaroslavtsarenko:qlKClTLv1d7rUCOR@allshipai-db.zrjqe.mongodb.net/?retryWrites=true&w=majority&appName=allshipai-db", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected✅ ');
}).catch(err => console.log(err));

app.get('/', (req, res) => {
  res.send('Server is live!');
});

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const parsedMessage = JSON.parse(message);
    const { chatId, carrierId, shipperId, messageText } = parsedMessage;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      console.error('Invalid chatId:', chatId);
      return;
    }

    const chat = await Chat.findById(chatId);
    if (chat) {
      const newMessage = {
        carrierId,
        shipperId,
        message: messageText,
        createdAt: new Date(),
      };
      chat.chatHistory.push(newMessage);
      await chat.save();

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(newMessage));
        }
      });
    } else {
      console.error('Chat not found for chatId:', chatId);
    }
  });
});

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/ai', aiRoutes);
app.use('/load', loadRoutes);
app.use('/chat', chatRoutes);

server.listen(port, () => {
  console.log(`Server running on port ${port}✅ `);
});