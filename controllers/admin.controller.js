const User = require("../models/User");
const Load = require("../models/Load");
const Transaction = require("../models/Transaction");

const getAdminMetrics = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalLoads = await Load.countDocuments();
        const activeLoads = await Load.countDocuments({ status: "Active" });
        const payedLoads = await Load.countDocuments({ status: "Payed" });
        const recentTransactions = await Transaction.find({
            date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        });
        const totalRevenue = recentTransactions
            .filter((t) => t.type === "payment")
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const totalRefunds = recentTransactions
            .filter((t) => t.type === "refund")
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        res.status(200).json({
            totalUsers,
            totalLoads,
            activeLoads,
            payedLoads,
            totalRevenue,
            totalRefunds,
        });
    } catch (err) {
        console.error("Error fetching metrics:", err);
        res.status(500).json({ message: "Server error" });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, "-password").sort({createdAt: -1});
        res.status(200).json(users);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({message: "Server error"});
    }
};

// ✅ Delete user
const deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({message: "User deleted"});
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({message: "Server error"});
    }
};

// ✅ Update user role
const updateUserRole = async (req, res) => {
    try {
        const {userId, role} = req.body;
        const user = await User.findByIdAndUpdate(userId, {role}, {new: true});
        res.status(200).json(user);
    } catch (err) {
        console.error("Error updating role:", err);
        res.status(500).json({message: "Server error"});
    }
};

// ✅ Update absolutely all user fields
const updateUser = async (req, res) => {
    try {
        const {userId, ...updates} = req.body;
        if (!userId) return res.status(400).json({message: "Missing userId"});

        const user = await User.findByIdAndUpdate(
            userId,
            {$set: updates},
            {new: true, runValidators: true}
        );

        if (!user) return res.status(404).json({message: "User not found"});
        res.status(200).json({message: "User updated successfully", user});
    } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).json({message: "Server error"});
    }
};


// ✅ Get all loads
const getAllLoads = async (req, res) => {
    try {
        const loads = await Load.find({}).sort({createdAt: -1});
        res.status(200).json(loads);
    } catch (err) {
        console.error("Error fetching loads:", err);
        res.status(500).json({message: "Server error"});
    }
};

// ✅ Delete load
const deleteLoad = async (req, res) => {
    try {
        await Load.findByIdAndDelete(req.params.id);
        res.status(200).json({message: "Load deleted"});
    } catch (err) {
        console.error("Error deleting load:", err);
        res.status(500).json({message: "Server error"});
    }
};

// ✅ Update load
const updateLoad = async (req, res) => {
    try {
        const {loadId, ...updates} = req.body;
        const load = await Load.findByIdAndUpdate(loadId, {$set: updates}, {new: true});
        if (!load) return res.status(404).json({message: "Load not found"});
        res.status(200).json({message: "Load updated successfully", load});
    } catch (err) {
        console.error("Error updating load:", err);
        res.status(500).json({message: "Server error"});
    }
};


module.exports = {
    getAllUsers,
    deleteUser,
    updateUserRole,
    updateUser,
    getAllLoads,
    deleteLoad,
    updateLoad,
    getAdminMetrics,

};
