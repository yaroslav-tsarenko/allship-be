require("dotenv").config();

const express = require("express");
const http = require("http");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");
const bodyParser = require("body-parser");
const path = require("path");
const WebSocket = require("ws");
const cron = require("node-cron");
const Chat = require("./models/Chat");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth.route");
const userRoutes = require("./routes/user.route");
const aiRoutes = require("./routes/ai.route");
const loadRoutes = require("./routes/load.route");
const chatRoutes = require("./routes/chat.route");
const notificationsRoute = require("./routes/notifications.route");
const adminRoutes = require("./routes/admin.route");

// 🧠 Controllers for cron jobs
const {
    fillCarrierReviews,
    fillCarrierAbouts,
    autoBidForAllLoads,
} = require("./controllers/user.controller");

const {
    activatePayedLoads,
    updateChosenCarrierAvatars,
} = require("./controllers/load.controller");

// 🚀 App setup
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});
app.use(
    helmet({
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: false,
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(fileUpload());
app.use(cookieParser());

app.use("/images/avatars", express.static(path.join(__dirname, "images", "avatars")));

app.get("/", (_, res) =>
    res.send("🚀 AllShipAI backend is running and open for all origins!")
);

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/ai", aiRoutes);
app.use("/load", loadRoutes);
app.use("/chat", chatRoutes);
app.use("/admin", adminRoutes);
app.use("/notifications", notificationsRoute);

(async () => {
    try {
        await connectDB();
        console.log("✅ MongoDB connected.");

        server.listen(PORT, () =>
            console.log(`🚀 Server is running on port ${PORT}`)
        );

        const wss = new WebSocket.Server({ server });
        console.log("💬 WebSocket initialized");

        wss.on("connection", (ws) => {
            ws.on("message", async (message) => {
                try {
                    const { chatId, carrierId, shipperId, messageText } = JSON.parse(message);
                    if (!chatId || !messageText) return;

                    const chat = await Chat.findById(chatId);
                    if (!chat) return console.error("Chat not found:", chatId);

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
                } catch (err) {
                    console.error("WebSocket error:", err.message);
                }
            });
        });

        cron.schedule("*/1 * * * *", async () => {
            try {
                await Promise.all([
                    fillCarrierReviews(),
                    fillCarrierAbouts(),
                    autoBidForAllLoads(),
                    activatePayedLoads(),
                    updateChosenCarrierAvatars(),
                ]);
                console.log("✅ CRON executed successfully");
            } catch (err) {
                console.error("❌ CRON error:", err.message);
            }
        });
    } catch (err) {
        console.error("❌ Failed to start server:", err.message);
        process.exit(1);
    }
})();
