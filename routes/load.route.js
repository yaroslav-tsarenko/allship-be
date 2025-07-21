const express = require('express');
const router = express.Router();
const { createLoad, getAllUserLoads, updateLoadStatus, createBidPaymentSession, payLoad, assignDriver, confirmPayment, getAllLoadsForCarriers, makeBid, getLoadById, applyBid, deleteLoadById,
    createLoadFromCookie
} = require('../controllers/load.controller');

router.post('/create-load', createLoad);
router.get('/get-all-user-loads', getAllUserLoads);
router.get('/get-all-loads-for-carriers', getAllLoadsForCarriers);
router.post('/make-bid', makeBid);
router.patch('/apply-bid', applyBid);
router.post('/create-bid-payment-session', createBidPaymentSession);
router.post('/update-load-status', updateLoadStatus);
router.get('/get-load-by-id/:loadId', getLoadById);
router.delete('/delete-load-by-id/:loadId', deleteLoadById);
router.post('/assign-driver', assignDriver);
router.post('/pay-load', payLoad);
router.post('/create-load-from-cookie', createLoadFromCookie);
router.post('/confirm-payment', confirmPayment);

module.exports = router;