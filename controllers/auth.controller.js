const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";
const isProd = process.env.NODE_ENV === "production";

/** ✅ Абсолютно безпечна установка cookie */
const setAuthCookie = (res, token) => {
    try {
        const host = process.env.HOST || "";
        const looksLikeProd =
            isProd || host.includes("render") || host.includes("allship.ai");

        // ⚙️ Стандартні параметри
        const cookieOptions = {
            httpOnly: true,
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        };

        // 🟢 Для продакшену / Render / HTTPS
        if (looksLikeProd) {
            cookieOptions.secure = true;
            cookieOptions.sameSite = "None"; // ключ: "None" з великої літери
            cookieOptions.domain = ".allship.ai";
        } else {
            // 🟠 Для локалки
            cookieOptions.secure = false;
            cookieOptions.sameSite = "Lax";
        }

        res.cookie("token", token, cookieOptions);
    } catch (err) {
        console.error("⚠️ Cookie setup failed:", err.message);
    }
};

/** 🔹 Генератор 6-значного коду */
const generateCode = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

/** 🔹 REGISTER */
const registerAndAuth = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

    const { name, secondName, email, phone, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser)
            return res.status(400).json({ message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = generateCode();
        const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

        const newUser = new User({
            name,
            secondName,
            email,
            phone,
            password: hashedPassword,
            verificated: false,
            verificationCode,
            verificationCodeExpires,
        });

        await newUser.save();

        const html = `
      <h2>Welcome, ${name}!</h2>
      <p>To verify your AllShipAI account, use this code:</p>
      <div style="font-size:28px;font-weight:bold;color:#2563eb;">${verificationCode}</div>
      <p>This code is valid for 15 minutes.</p>
    `;

        await sendEmail(email, "Verify your AllShipAI account 🚀", html);

        res.status(201).json({
            message: "User registered successfully, verification required",
            userId: newUser._id,
            email,
        });
    } catch (error) {
        console.error("❌ registerAndAuth:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

/** 🔹 VERIFY CODE */
const verifyCode = async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code)
        return res.status(400).json({ message: "Email and code are required" });

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found" });
        if (user.verificationCode !== code)
            return res.status(400).json({ message: "Invalid code" });
        if (new Date(user.verificationCodeExpires).getTime() < Date.now())
            return res.status(400).json({ message: "Code expired" });

        user.verificated = true;
        user.verificationCode = null;
        user.verificationCodeExpires = null;
        await user.save();

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
            expiresIn: "7d",
        });

        setAuthCookie(res, token);

        res.status(200).json({
            message: "Verification successful",
            token,
            userId: user._id,
        });
    } catch (error) {
        console.error("❌ verifyCode:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

/** 🔹 LOGIN */
const login = async (req, res) => {
    console.log("📩 [LOGIN] Body:", req.body);

    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user)
            return res.status(400).json({ error: "Invalid credentials (email)" });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword)
            return res.status(400).json({ error: "Invalid credentials (password)" });

        if (!user.verificated)
            return res.status(403).json({ error: "Email not verified" });

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
            expiresIn: "7d",
        });

        // 👇 Якщо навіть тут щось піде не так, воно не впаде
        try {
            setAuthCookie(res, token);
        } catch (err) {
            console.warn("⚠️ Cookie error suppressed:", err.message);
        }

        res.status(200).json({
            message: "Login successful",
            userId: user._id,
        });
    } catch (error) {
        console.error("❌ Login error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

/** 🔹 LOGOUT */
const logout = (req, res) => {
    console.log("👋 [LOGOUT]");
    try {
        res.clearCookie("token", {
            path: "/",
            sameSite: "None",
            secure: true,
            domain: ".allship.ai",
        });
    } catch (err) {
        console.warn("⚠️ Logout cookie clear failed:", err.message);
    }
    return res.status(200).json({ message: "Logged out successfully" });
};

/** 🔹 Інші ендпоінти (password reset etc.) */
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });
        const resetToken = jwt.sign({ userId: user._id }, JWT_SECRET, {
            expiresIn: "15m",
        });
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        const resetLink = `${
            isProd ? "https://allship.ai" : "http://localhost:3000"
        }/reset-password/${resetToken}`;

        const html = `
      <h2>Password Reset Request</h2>
      <p>Click below to reset your password (valid for 15 minutes):</p>
      <a href="${resetLink}" style="font-size:18px;color:#2563eb;">Reset Password</a>
    `;
        await sendEmail(user.email, "Reset Your AllShipAI Password", html);

        res.status(200).json({ message: "Reset link sent successfully" });
    } catch (error) {
        console.error("❌ forgotPassword error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    registerAndAuth,
    verifyCode,
    login,
    logout,
    forgotPassword,
};
