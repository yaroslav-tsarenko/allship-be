const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";
const isProd = process.env.NODE_ENV === "production";

/** 🔧 Helper — безпечна установка cookie */
const setAuthCookie = (res, token) => {
    const isProd = process.env.NODE_ENV === "production";

    // Якщо Render або HTTP, sameSite= 'lax'
    const cookieOptions = {
        httpOnly: true,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 днів
    };

    if (isProd) {
        cookieOptions.secure = true;
        cookieOptions.sameSite = "none";
        cookieOptions.domain = ".allship.ai";
    } else {
        cookieOptions.secure = false;
        cookieOptions.sameSite = "lax";
    }

    res.cookie("token", token, cookieOptions);
};


/** 🔹 Генератор 6-значного коду підтвердження */
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

/** 🔹 REGISTER (з підтвердженням через email) */
const registerAndAuth = async (req, res) => {
    console.log("📩 [REGISTER] Incoming request body:", req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn("⚠️ Validation errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, secondName, email, phone, password } = req.body;

    try {
        console.log(`🔍 Checking if user exists: ${email}`);
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.warn(`⚠️ User with email ${email} already exists`);
            return res.status(400).json({ message: "User already exists" });
        }

        console.log("🔐 Hashing password...");
        const hashedPassword = await bcrypt.hash(password, 10);

        const verificationCode = generateCode();
        const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 хв TTL

        console.log(`✅ Generated code: ${verificationCode}`);

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
        console.log("💾 User saved to DB:", newUser._id);

        // 📧 Надсилання листа
        const htmlContent = `
      <h2>Welcome, ${name}!</h2>
      <p>To verify your AllShipAI account, please use this code:</p>
      <div style="font-size:28px;font-weight:bold;color:#2563eb;margin:12px 0;">
        ${verificationCode}
      </div>
      <p>This code is valid for 15 minutes.</p>
    `;

        await sendEmail(email, "Verify your AllShipAI account 🚀", htmlContent);
        console.log(`📨 Verification email sent to ${email}`);

        return res.status(201).json({
            message: "User registered successfully, verification required",
            userId: newUser._id,
            email,
        });
    } catch (error) {
        console.error("❌ Error in registerAndAuth:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

/** 🔹 VERIFY CODE */
const verifyCode = async (req, res) => {
    console.log("📩 [VERIFY CODE] Body:", req.body);

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

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
        setAuthCookie(res, token);

        return res.status(200).json({
            message: "Verification successful",
            token,
            userId: user._id,
        });
    } catch (error) {
        console.error("❌ Verification error:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

/** 🔹 LOGIN */
const login = async (req, res) => {
    console.log("📩 [LOGIN] Body:", req.body);

    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            console.warn("❌ Invalid email:", email);
            return res.status(400).json({ error: "Invalid credentials" });
        }

        console.log("🔍 Checking password...");
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.warn("❌ Wrong password for user:", email);
            return res.status(400).json({ error: "Invalid credentials" });
        }

        if (!user.verificated) {
            console.warn("⚠️ Email not verified:", email);
            return res.status(403).json({ error: "Email not verified" });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
        setAuthCookie(res, token);

        return res.status(200).json({
            message: "Login successful",
            userId: user._id,
        });
    } catch (error) {
        console.error("❌ Login error:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};

/** 🔹 LOGOUT */
const logout = (req, res) => {
    console.log("👋 [LOGOUT]");
    res.clearCookie("token", {
        path: "/",
        domain: isProd ? ".allship.ai" : undefined,
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
    });
    return res.status(200).json({ message: "Logged out successfully" });
};

/** 🔹 Register wrapper */
const register = async (req, res) => {
    console.log("🔁 [REGISTER] Delegating to registerAndAuth()");
    return registerAndAuth(req, res);
};

/** 🔹 FORGOT PASSWORD */
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    try {
        const user = await User.findOne({ email });
        if (!user) {
            console.warn("⚠️ Email not found:", email);
            return res.status(404).json({ message: "User not found" });
        }

        const resetToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "15m" });
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        const resetLink = `${isProd ? "https://allship.ai" : "http://localhost:3000"}/reset-password/${resetToken}`;

        const html = `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password (valid for 15 minutes):</p>
      <a href="${resetLink}" style="font-size:18px;color:#2563eb;">Reset Password</a>
    `;

        await sendEmail(user.email, "Reset Your AllShipAI Password", html);
        console.log(`📨 Reset link sent to ${email}`);

        return res.status(200).json({ message: "Reset link sent successfully" });
    } catch (error) {
        console.error("❌ forgotPassword error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

/** 🔹 RESET PASSWORD */
const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password)
        return res.status(400).json({ message: "Token and password required" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(400).json({ message: "User not found" });

        if (
            !user.resetPasswordToken ||
            user.resetPasswordToken !== token ||
            new Date(user.resetPasswordExpires).getTime() < Date.now()
        ) {
            return res.status(400).json({ message: "Token expired or invalid" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        return res.status(200).json({ message: "Password successfully changed" });
    } catch (error) {
        console.error("❌ resetPassword error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    register,
    registerAndAuth,
    verifyCode,
    login,
    logout,
    resetPassword,
    forgotPassword,
};
