const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;

const basicAuth = async (req, res, next) => {
    try {
        let token = null;

        // 🔹 1. Перевіряємо Authorization
        if (req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }

        // 🔹 2. Якщо немає — шукаємо у cookies
        if (!token && req.cookies?.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({ message: "No authentication token provided" });
        }

        // 🔹 3. Верифікуємо токен
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select("-password");
        if (!user) return res.status(401).json({ message: "User not found" });

        req.user = user;
        next();
    } catch (error) {
        console.error("❌ [Auth Error]:", error.message);
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};

module.exports = basicAuth;
