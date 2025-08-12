require('dotenv').config();
const mongoose = require('mongoose');
const Load = require('../models/Load');
const User = require('../models/User');
const Chat = require('../models/Chat');
const TransactionModel = require('../models/Transaction');
const sendEmail = require('../utils/sendEmail');
const createMollieClient = require('@mollie/api-client').default;
const crypto = require('crypto');
const {sendMessageToChannel} = require('../telegram-bot/telegramBot');
const {uploadImage} = require("../utils/uploadImage");
const {client, paypal} = require('../utils/payPalClient');

const {v4: uuidv4} = require('uuid');
const UserModel = require("../models/User");
const {squareClient} = require("../utils/squareClient");

const generateLoadId = async () => {
    const prefix = '49-0013';
    let uniqueSuffix;
    let loadId;
    let isUnique = false;

    while (!isUnique) {
        uniqueSuffix = `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
        loadId = `${prefix}-${uniqueSuffix}`;
        const existingLoad = await Load.findOne({loadId});
        if (!existingLoad) {
            isUnique = true;
        }
    }

    return loadId;
};

const createLoad = async (req, res) => {
    try {
        const userId = req.body.user;
        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found for ID:', userId);
            return res.status(404).json({message: 'User not found'});
        }
        const loadData = req.body;
        loadData.userId = user._id;
        loadData.email = user.email;
        const loadSubType = loadData.subType;
        loadData.loadId = await generateLoadId();
        Object.keys(loadData).forEach(key => {
            if (loadData[key] === false || loadData[key] === undefined || loadData[key] === "" || (Array.isArray(loadData[key]) && loadData[key].length === 0)) {
                delete loadData[key];
            }
        });

        const files = req.files?.files || [];
        const photos = req.files?.photos || [];
        const imageUrls = [];

        const uploadFiles = async (fileArray, type) => {
            for (let i = 0; i < fileArray.length; i++) {
                const fileName = `load-${loadData.loadId}-${type}-${i + 1}`;
                const imageUrl = await uploadImage(fileArray[i], fileName);
                imageUrls.push(imageUrl);
            }
        };

        await uploadFiles(files, 'file');
        await uploadFiles(photos, 'photo');

        loadData.images = imageUrls;

        const newLoad = new Load(loadData);
        await newLoad.save();
        sendEmail(loadData.email, 'Congratulations🎉', `Your new ${loadSubType} load with ID ${loadData.loadId} has been created successfully`);
        res.status(201).json(newLoad);

        const publicLink = `https://www.allship.ai/load/${loadData.loadId}`;
        let messageToChannel;

        if (loadSubType === 'Rent Truck') {
            messageToChannel = `
🚨 NEW REQUEST FOR RENT TRUCK 🚨
📧 Contact Email: ${user.email}
📞 Contact Phone: ${user.phone}
📝 Description: ${loadData.description}
🆔 Order ID: ${loadData.loadId}
📍 Pickup Location: ${loadData.pickupLocation}
📦 Delivery Location: ${loadData.deliveryLocation}
🔗 Public Load Link: ${publicLink}
`;
        } else {
            messageToChannel = `
🚨 NEW LOAD POST 🚨
📧 User Email: ${loadData.email}
🆔 Load ID: ${loadData.loadId}
🛠️ SubType: ${loadData.subType}
🏷️ Title: ${loadData.title}
📊 Status: ${loadData.status}
📍 Pickup Location: ${loadData.pickupLocation}
📦 Delivery Location: ${loadData.deliveryLocation}
📝 Description: ${loadData.description}
🔗 Public Load Link: ${publicLink}
`;
        }

        sendMessageToChannel(messageToChannel);

    } catch (error) {
        console.error('Error creating load:', error);
        res.status(500).json({message: 'Error creating load', error});
    }
};

const getAllUserLoads = async (req, res) => {
    try {
        const {userId} = req.query;
        console.log("Request user id: ", userId);
        const loads = await Load.find({userId});
        res.status(200).json(loads);
    } catch (error) {
        console.error('Error fetching user loads:', error);
        res.status(500).json({message: 'Error fetching user loads', error});
    }
};

const getAllLoadsForCarriers = async (req, res) => {
    try {
        const loads = await Load.find({status: 'Active'});
        res.status(200).json(loads);
    } catch (error) {
        console.error('Error fetching loads for carriers:', error);
        res.status(500).json({message: 'Error fetching loads for carriers', error});
    }
};

const makeBid = async (req, res) => {
    try {
        const {
            loadId,
            title,
            subType,
            carrierId,
            carrierCompanyName,
            bidPrice,
            letter,
            estimatedDeliveryTime
        } = req.body;
        const load = await Load.findOne({loadId});
        if (!load) {
            return res.status(404).json({message: 'Load not found'});
        }
        const shipperEmail = load.email;

        const newBid = {
            carrierId,
            carrierCompanyName,
            bidPrice,
            letter,
            title,
            subType,
            estimatedDeliveryTime,
            createdAt: new Date()
        };

        load.bids.push(newBid);
        load.bidsQuantity = load.bids.length;
        load.avgPrice = load.bids.reduce((acc, bid) => acc + parseFloat(bid.bidPrice), 0) / load.bids.length;
        await sendEmail(shipperEmail, 'New bid on your load🚚', `Carrier ${carrierCompanyName} made a bid on your load with ID ${loadId}, maybe it's your destiny`);
        await load.save();

        const messageToChannel = `
📢NEW BID FOR LOAD📢
🆔Load ID: ${loadId}
🏢Carrier Company: ${carrierCompanyName}
💵Bid Price: ${bidPrice}$
📅Estimated Delivery Time: ${estimatedDeliveryTime}
📝Letter: ${letter}
        `;
        sendMessageToChannel(messageToChannel);

        res.status(200).json(load);
    } catch (error) {
        console.error('Error adding bid to load:', error);
        res.status(500).json({message: 'Error adding bid to load', error});
    }
};

const updateLoadStatus = async (req, res) => {
    const {loadId, status} = req.body;

    try {
        const load = await Load.findOne({loadId});
        if (!load) {
            return res.status(404).json({message: 'Load not found'});
        }

        load.status = status;
        await load.save();

        res.status(200).json({message: 'Load status updated successfully', load});
    } catch (error) {
        console.error('Error updating load status:', error);
        res.status(500).json({message: 'Error updating load status', error});
    }
};

async function confirmPayment(req, res) {
    try {
        const { userId, loadPaymentId, orderId } = req.body;
        if (!userId || !loadPaymentId || !orderId) {
            return res.status(400).json({ message: 'Missing userId, loadPaymentId or orderId' });
        }

        const load = await Load.findOne({ loadId: loadPaymentId });
        if (!load) return res.status(404).json({ message: 'Load not found' });

        const orderResp = await squareClient.ordersApi.retrieveOrder(orderId);
        const state = orderResp.result?.order?.state;
        if (state !== 'COMPLETED') {
            return res.status(400).json({ message: 'Order not completed' });
        }

        await TransactionModel.create({
            purpose: `Payment for load ${load._id}`,
            amount: load.price || '100',
            type: 'payment',
            userId,
        });

        load.status = 'Payed';
        await load.save();

        const user = await UserModel.findById(userId);
        if (user && user.email) {
            await sendEmail(
                user.email,
                'Payment Confirmation',
                `Your payment for load ${load._id} was successful.`
            );
        }

        return res.json({ message: 'Payment confirmed, transaction created, status updated.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
}

const createBidPaymentSession = async (req, res) => {
    try {
        const { loadId, carrierId, companyName, bidPrice, shipperName, shipperId } = req.body;
        if (!loadId || !carrierId || !companyName || !bidPrice || !shipperName || !shipperId) {
            return res.status(400).json({ message: 'Missing bid data' });
        }

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'USD',
                    value: "100"
                }
            }],
            application_context: {
                return_url: `${process.env.DASHBOARD_URL}/bid-applied`,
                cancel_url: `${process.env.DASHBOARD_URL}/`
            }
        });

        const order = await client().execute(request);
        const approvalUrl = order.result.links.find(link => link.rel === 'approve').href;

        res.status(200).json({ approvalUrl, orderId: order.result.id });
    } catch (error) {
        console.error('Error creating PayPal bid session:', error);
        res.status(500).json({ error: 'Failed to create PayPal session' });
    }
};

const getLoadById = async (req, res) => {
    try {
        const {loadId} = req.params;
        const load = await Load.findOne({loadId});

        if (!load) {
            return res.status(404).json({message: 'Load not found'});
        }

        res.status(200).json(load);
    } catch (error) {
        console.error('Error fetching load by ID:', error);
        res.status(500).json({message: 'Error fetching load by ID', error});
    }
};

const deleteLoadById = async (req, res) => {
    try {
        const {loadId} = req.params;
        const loadUserEmail = await Load.findOne({loadId}).select('email');
        const load = await Load.findOneAndDelete({loadId});
        if (!load) {
            return res.status(404).json({message: 'Load not found'});
        }
        sendEmail(loadUserEmail, "Load deleted successfully", `Your load with ID ${loadId} has been deleted successfully and doesn't visible for carriers`);
        res.status(200).json({message: 'Load deleted successfully'});
    } catch (error) {
        console.error('Error deleting load by ID:', error);
        res.status(500).json({message: 'Error deleting load by ID', error});
    }
};

const updateLoadCarrierStatus = async ({ loadId, companyName, chatId, carrierId, status }) => {
    return await Load.findOneAndUpdate(
        { loadId },
        {
            status,
            chosenCarrier: {
                carrierCompanyName: companyName,
                chatId,
                carrierId
            }
        },
        { new: true }
    );
};

const removeDuplicatesChat = async (loadId) => {
    const chats = await Chat.find({ loadId });
    if (chats.length > 1) {
        const sorted = chats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const [keep, ...duplicates] = sorted;
        const duplicateIds = duplicates.map(chat => chat._id);
        await Chat.deleteMany({ _id: { $in: duplicateIds } });
        return duplicateIds;
    }
    return [];
};

const applyBid = async (req, res) => {
    console.log("Request body for applyBid:", req.body);
    try {
        const { loadId, carrierId, companyName, bidPrice, shipperName, shipperId } = req.body;

        if (!loadId || !carrierId || !companyName || !bidPrice || !shipperName || !shipperId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const load = await Load.findOne({ loadId });
        if (!load) return res.status(404).json({ message: 'Load not found' });

        const userEmail = load.email;
        const carrier = await User.findById(carrierId);
        if (!carrier) return res.status(404).json({ message: 'Carrier not found' });

        const chat = await new Chat({
            carrierId,
            shipperId,
            loadId,
            title: load.title,
            subType: load.subType,
            bidPrice,
            shipperName,
            carrierCompanyName: companyName,
            chatHistory: []
        }).save();

        // Use the new function here
        const updatedLoad = await updateLoadCarrierStatus({
            loadId,
            companyName,
            chatId: chat._id.toString(),
            carrierId,
            status: "Payed"
        });
        await removeDuplicatesChat(loadId);
        if (!updatedLoad) {
            console.error('Failed to update load with bid info');
            return res.status(500).json({ message: 'Failed to update load' });
        }

        await Promise.all([
            sendEmail(userEmail, "Your bid has been applied", "You've successfully applied the bid."),
            sendEmail(carrier.email, "A shipper accepted your bid", "Check your chat now.")
        ]);

        return res.status(200).json({ message: 'Bid applied and chat created successfully', chat });
    } catch (error) {
        console.error('Error applying bid:', error);
        return res.status(500).json({ message: 'Internal error', error: error.message });
    }
};

const assignDriver = async (req, res) => {
    const { loadId, driverId } = req.body;
    console.log("Request body for assignDriver:", req.body);
    try {
        const load = await Load.findOne({ loadId });
        if (!load) {
            return res.status(404).json({ message: 'Load not found' });
        }
        const driver = await User.findById(driverId);
        if (!driver || driver.role !== 'driver') {
            return res.status(404).json({ message: 'Driver not found' });
        }
        load.assignedDriver = {
            driverId: driverId,
            lat: driver.lat || null,
            lng: driver.lng || null,
            avatar: driver.avatar || null
        };
        await load.save();
        if (!driver.assignedLoads.includes(loadId)) {
            driver.assignedLoads.push(loadId);
            await driver.save();
        }
        res.status(200).json({ message: 'Driver assigned successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
};

async function getLocationId() {
    if (process.env.SQUARE_LOCATION_ID) return process.env.SQUARE_LOCATION_ID;
    const resp = await squareClient.locationsApi.listLocations();
    const locations = resp?.result?.locations || [];
    const active = locations.find(l => l.status === 'ACTIVE');
    if (!active?.id) throw new Error('NO_ACTIVE_LOCATION');
    return active.id;
}

async function payLoad(req, res) {
    try {
        const { loadId } = req.body;
        const FRONTEND_URL = process.env.DASHBOARD_URL;

        if (!loadId) return res.status(400).json({ error: 'MISSING_LOAD_ID' });
        if (!process.env.SQUARE_ACCESS_TOKEN) return res.status(500).json({ error: 'MISSING_SQUARE_ACCESS_TOKEN' });
        if (!FRONTEND_URL) return res.status(500).json({ error: 'MISSING_DASHBOARD_URL' });

        const load = await Load.findOne({ loadId });
        if (!load) return res.status(404).json({ error: 'LOAD_NOT_FOUND' });

        let locationId;
        try {
            locationId = await getLocationId();
        } catch (e) {
            if (String(e.message) === 'NO_ACTIVE_LOCATION') {
                return res.status(500).json({ error: 'NO_ACTIVE_SQUARE_LOCATION' });
            }
            throw e;
        }

        const amountCents = Math.max(1, Math.round(Number(load.price || 100) * 100));

        // ПРОЩЕ: создаём ссылку через quickPay
        const { result } = await squareClient.checkoutApi.createPaymentLink({
            idempotencyKey: uuidv4(),
            description: `Payment for load ${load._id}`,
            checkoutOptions: {
                redirectUrl: `${FRONTEND_URL}/load-payed`,
            },
            quickPay: {
                name: `Load ${load._id}`,
                priceMoney: { amount: amountCents, currency: 'USD' },
                locationId,
                // optional: note, referenceId: String(loadId)
                referenceId: String(loadId),
            },
        });

        const approvalUrl = result?.paymentLink?.url;
        const orderId = result?.paymentLink?.orderId;

        if (!approvalUrl || !orderId) {
            return res.status(500).json({ error: 'LINK_NOT_CREATED', details: result || null });
        }

        return res.status(200).json({ approvalUrl, orderId, loadId });
    } catch (err) {
        const status = err?.statusCode || 500;
        const details = err?.result || err?.body || err?.errors || err?.message || err;
        console.error('Square create link error (status):', status);
        try { console.error('Square error (json):', JSON.stringify(details, null, 2)); } catch (_) { console.error('Square error (raw):', details); }
        return res.status(status).json({ error: 'SQUARE_ERROR', details });
    }
}

const createLoadFromCookie = async (req, res) => {
    try {
        const { bookingData, userId, email } = req.body;
        if (!bookingData) {
            return res.status(400).json({ error: 'Missing bookingData' });
        }

        const parsed =
            typeof bookingData === 'string'
                ? JSON.parse(decodeURIComponent(bookingData))
                : bookingData;

        const {
            from,
            to,
            pickupDate,
            deliveryDate,
            bedrooms,
            fullPacking,
            unpacking,
            storage,
            chosenCarrier,
        } = parsed;

        const bookingHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(parsed))
            .digest('hex');

        const existingLoad = await Load.findOne({ bookingHash });
        if (existingLoad) {
            return res.status(200).json({
                message: 'Load already exists for this booking',
                loadId: existingLoad._id,
                alreadyExists: true,
            });
        }

        const paypalOrderId = `paypal_${uuidv4()}`;
        const carrier = await User.findById(chosenCarrier);
        const shipper = await User.findById(userId);
        const loadId = await generateLoadId();

        const newChat = new Chat({
            carrierId: chosenCarrier,
            shipperId: userId,
            loadId,
            title: `Moving from ${from} to ${to}`,
            subType: 'Long Distance Moving',
            carrierCompanyName: carrier?.companyName || 'Unknown Carrier',
            shipperName: shipper?.name + shipper?.secondName || 'Unknown Shipper',
            bidPrice: null,
            chatHistory: [],
        });

        await newChat.save();

        const newLoad = new Load({
            userId,
            email,
            loadId,
            bookingHash,
            subType: 'Long Distance Moving',
            title: `Moving from ${from} to ${to}`,
            status: 'Inactive',
            pickupLocation: from,
            deliveryLocation: to,
            pickupDate: pickupDate ? new Date(pickupDate) : new Date(),
            deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
            numberOfBedrooms: String(bedrooms || ''),
            packingUnpackingServices: !!fullPacking,
            unpacking: !!unpacking,
            storageNeeds: !!storage,
            chosenCarrier: {
                carrierCompanyName: carrier?.companyName || 'Unknown Carrier',
                carrierId: chosenCarrier,
                chatId: newChat._id.toString(),
            },
            paypalOrderId,
        });

        await newLoad.save();

        return res.status(201).json({
            message: 'Load and chat created successfully',
            loadId: newLoad._id,
            paypalOrderId,
            chatId: newChat._id,
        });
    } catch (error) {
        if (error.code === 11000 && error.keyPattern?.bookingHash) {
            return res.status(200).json({ message: 'Duplicate load', alreadyExists: true });
        }
        console.error('[createLoadFromCookie]', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const activatePayedLoads = async () => {
    try {
        const pendingLoads = await Load.find({ status: 'Pending' });
        console.log(`Found ${pendingLoads.length} loads with status "Pending":`, pendingLoads.map(l => l.loadId));
        const result = await Load.updateMany(
            { status: 'Pending' },
            { $set: { status: 'Active' } }
        );
        console.log(`Modified count: ${result.modifiedCount}`);
        if (result.modifiedCount > 0) {
            console.log(`Activated ${result.modifiedCount} loads.`);
        } else {
            console.log('No loads were activated.');
        }
    } catch (error) {
        console.error('Error activating pending loads:', error);
    }
};

module.exports = {
    createLoad,
    createBidPaymentSession,
    makeBid,
    payLoad,
    applyBid,
    getAllUserLoads,
    getAllLoadsForCarriers,
    getLoadById,
    deleteLoadById,
    createLoadFromCookie,
    updateLoadStatus,
    assignDriver,
    confirmPayment,
    activatePayedLoads
};
