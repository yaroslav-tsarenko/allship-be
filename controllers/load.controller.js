const Load = require('../models/Load');
const User = require('../models/User');
const Chat = require('../models/Chat');
const TransactionModel = require('../models/Transaction');
const sendEmail = require('../utils/sendEmail');
const createMollieClient = require('@mollie/api-client').default;
const mollie = createMollieClient({ apiKey: "test_T2NbH38hTvDDPASvnQ9aRqdWeWrT5B" });
const { sendMessageToChannel } = require('../telegram-bot/telegramBot');
const {uploadImage} = require("../utils/uploadImage");

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
            return res.status(404).json({ message: 'User not found' });
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

        const randomDelay = Math.floor(Math.random() * (5 - 1 + 1) + 1) * 60 * 1000;
        setTimeout(async () => {
            try {
                newLoad.status = 'Active';
                await newLoad.save();
                sendEmail(loadData.email, `AI review your ${loadSubType} load🤖`, 'AI reviewed your load and made it active for carriers, now your load is visible to carriers');
            } catch (error) {
                console.error('Error updating load status:', error);
            }
        }, randomDelay);
    } catch (error) {
        console.error('Error creating load:', error);
        res.status(500).json({ message: 'Error creating load', error });
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

const applyBid = async (req, res) => {
    try {
        const {loadId, carrierId, companyName, bidPrice, shipperName, shipperId} = req.body;
        const load = await Load.findOne({loadId});
        if (!load) {
            return res.status(404).json({message: 'Load not found'});
        }

        const userEmail = load.email;
        const carrier = await User.findById(carrierId);
        const carrierEmail = carrier.email;

        load.status = 'Applied';
        await load.save();

        const chat = new Chat({
            carrierId: carrierId,
            shipperId: shipperId,
            loadId: loadId,
            title: load.title,
            subType: load.subType,
            bidPrice: bidPrice,
            shipperName: shipperName,
            carrierCompanyName: companyName,
            chatHistory: []
        });
        await chat.save();

        await Promise.all([
            sendEmail(userEmail, "Congratulations, your new experience with carrier", "You have successfully applied a bid from carrier"),
            sendEmail(carrierEmail, "Congratulations, shipper applied bid from you", "Hurry up! You catch your destiny")
        ]);

        res.status(200).json({message: 'Bid applied and chat created successfully', chat});
    } catch (error) {
        console.error('Error applying bid:', error);
        res.status(500).json({message: 'Error applying bid', error});
    }
};

const assignDriver = async (req, res) => {
    const { loadId, driverId } = req.body;
    try {
        const load = await Load.findOne({loadId});
        if (!load) {
            return res.status(404).json({ message: 'Load not found' });
        }
        load.assignedDriver = driverId;
        await load.save();
        const driver = await User.findById(driverId);
        if (!driver || driver.role !== 'driver') {
            return res.status(404).json({ message: 'Driver not found' });
        }
        driver.assignedLoads.push(loadId);
        await driver.save();
        res.status(200).json({ message: 'Driver assigned successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
};


const payLoad = async (req, res) => {
    const { loadId, bidPrice, userId } = req.body;

    try {
        const formattedBidPrice = parseFloat(bidPrice).toFixed(2);
        const payment = await mollie.payments.create({
            amount: {
                value: formattedBidPrice,
                currency: 'USD'
            },
            description: `Payment for load ${loadId}`,
            redirectUrl: 'http://localhost:3000/success',
            webhookUrl: 'https://your-webhook-url.com',
        });

        const load = await Load.findOne({ loadId });
        if (!load) {
            return res.status(404).json({ message: 'Load not found' });
        }
        console.log("Load: ", load);
        load.status = 'Payed';
        await load.save();

        const newTransaction = new TransactionModel({
            purpose: `Payment for load`,
            amount: formattedBidPrice,
            type: 'payment',
            userId: userId,
            date: new Date()
        });
        await newTransaction.save();
        res.status(200).json({ checkoutUrl: payment.getCheckoutUrl() });
        const message = `New payment for load:
Load ID: ${loadId}
Amount: ${formattedBidPrice}$`;
        sendMessageToChannel(message);
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ message: 'Error creating checkout session', error });
    }
};

module.exports = {
    createLoad,
    makeBid,
    payLoad,
    applyBid,
    getAllUserLoads,
    getAllLoadsForCarriers,
    getLoadById,
    deleteLoadById,
    updateLoadStatus,
    assignDriver
};
