const express = require("express");
const router = express.Router();
const {
    getAllUsers,
    deleteUser,
    updateUserRole,
    updateUser,
    getAllLoads,
    deleteLoad,
    updateLoad,
    getAdminMetrics
} = require("../controllers/admin.controller");

router.get("/get-all-users", getAllUsers);
router.delete("/delete-user/:id", deleteUser);
router.post("/update-role", updateUserRole);
router.post("/update-user", updateUser);
router.get("/get-all-loads", getAllLoads);
router.delete("/delete-load/:id", deleteLoad);
router.post("/update-load", updateLoad);
router.get("/metrics", getAdminMetrics);

module.exports = router;
