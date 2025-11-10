require("dotenv").config();
const express = require("express");
const http = require("http");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");
const bodyParser = require("body-parser");
const path = require("path");
const WebSocket = require("ws");
const cron = require("node-cron");

// 🧱 Models
const Chat = require("./models/Chat");

// 🧠 Config
const connectDB = require("./config/db");

// 🛣️ Routes
const authRoutes = require("./routes/auth.route");
const userRoutes = require("./routes/user.route");
const aiRoutes = require("./routes/ai.route");
const loadRoutes = require("./routes/load.route");
const chatRoutes = require("./routes/chat.route");
const notificationsRoute = require("./routes/notifications.route");
const adminRoutes = require("./routes/admin.route");

// 🧠 Controllers (cron jobs)
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
const port = process.env.PORT || 5000;

// 🧩 Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(fileUpload());
app.use(cookieParser());

const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://allship.ai",
    "https://www.allship.ai",
    "https://dashboard.allship.ai",
    "https://www.dashboard.allship.ai",
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                console.log("❌ Blocked by CORS:", origin);
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.options("*", cors()); // дозволяє preflight

// 🖼️ Static Files
app.use("/images/avatars", express.static(path.join(__dirname, "images", "avatars")));

// 🛣️ Routes
app.get("/", (req, res) => res.send("🚀 AllShipAI backend is running!"));
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/ai", aiRoutes);
app.use("/load", loadRoutes);
app.use("/chat", chatRoutes);
app.use("/admin", adminRoutes);
app.use("/notifications", notificationsRoute);

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

let wss;
(async () => {
    try {
        await connectDB();
        console.log("✅ MongoDB connected.");

        server.listen(port, () => console.log(`🚀 Server on port ${port}`));

        wss = new WebSocket.Server({ server });
        console.log("💬 WebSocket initialized");

        wss.on("connection", (ws) => {
            ws.on("message", async (message) => {
                try {
                    const { chatId, carrierId, shipperId, messageText } = JSON.parse(message);
                    if (!chatId || !messageText) return;

                    const chat = await Chat.findById(chatId);
                    if (!chat) return console.error("Chat not found:", chatId);

                    const newMessage = { carrierId, shipperId, message: messageText, createdAt: new Date() };
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

        // 🕒 CRON Jobs
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
