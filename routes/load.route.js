const express = require('express');
const router = express.Router();
const { createLoad, getAllUserLoads, updateLoadStatus, payLoad, assignDriver, getAllLoadsForCarriers, makeBid, getLoadById, applyBid, deleteLoadById } = require('../controllers/load.controller');

router.post('/create-load', createLoad);
router.get('/get-all-user-loads', getAllUserLoads);
router.get('/get-all-loads-for-carriers', getAllLoadsForCarriers);
router.post('/make-bid', makeBid);
router.post('/apply-bid', applyBid);
router.post('/update-load-status', updateLoadStatus);
router.get('/get-load-by-id/:loadId', getLoadById);
router.delete('/delete-load-by-id/:loadId', deleteLoadById);
router.post('/assign-driver', assignDriver);
router.post('/pay-load', payLoad);

module.exports = router;