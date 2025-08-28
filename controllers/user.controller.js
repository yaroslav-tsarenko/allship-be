const paypal = require('@paypal/checkout-server-sdk');
const payPalClient = require('../utils/payPalClient');
const client = payPalClient.client();
const axios = require("axios");
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');
const {createZohoLead} = require('../utils/addToZoho');
const {uploadImage} = require('../utils/uploadImage');
const {sendMessageToChannel} = require('../telegram-bot/telegramBot');
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const User = require('../models/User');
const UserModel = require('../models/User');
const Load = require('../models/Load');
const Chat = require('../models/Chat');
const CardModel = require('../models/Card');
const TransactionModel = require('../models/Transaction');
const HelpQuote = require('../models/HelpQuote');

const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let password = '';
    password += chars.charAt(Math.floor(Math.random() * 26)); // Lowercase letter
    password += chars.charAt(Math.floor(Math.random() * 26) + 26); // Uppercase letter
    password += chars.charAt(Math.floor(Math.random() * 10) + 52); // Number
    password += chars.charAt(Math.floor(Math.random() * 10) + 62); // Special character
    for (let i = 4; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            res.redirect('/');
            res.status(404).json({error: 'User not found'});
        }
        res.json({user});
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
};

const addDriver = async (req, res) => {
    const {name, carrierId, secondName, phone, email} = req.body;
    const password = generatePassword();

    try {
        const existingUser = await User.findOne({$or: [{phone}, {email}]});
        if (existingUser) {
            return res.status(400).json({message: 'User with the same phone or email already exists'});
        }

        const newUser = new User({
            name,
            secondName,
            phone,
            carrierId,
            email,
            password: password,
            role: 'driver',
        });
        await newUser.save();
        await sendEmail(email, 'Welcome to the team!', `Carrier added you as driver, and you will be assigned for future loads, your credentials for account is: 
        Email - ${email}
        Password - ${password}
        please change it after first login, and don't share it with anyone.`);
        res.status(201).json({message: 'User created successfully', password});
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
};

const getAllDrivers = async (req, res) => {
    const {carrierId} = req.query;

    try {
        const drivers = await User.find({carrierId, role: 'driver'});
        res.status(200).json(drivers);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
};

const updateLocation = async (req, res) => {
    const {userId, lat, lng} = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }

        user.lat = lat;
        user.lng = lng;
        await user.save();

        res.status(200).json({message: 'Location updated successfully'});
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server error');
    }
};

const addCard = async (req, res) => {
    const {cardNumber, cardHolder, expiryDate, cvv, userId} = req.body;

    if (!cardNumber || !cardHolder || !expiryDate || !cvv || !userId) {
        return res.status(400).json({message: 'All fields are required'});
    }

    try {
        const userCards = await CardModel.find({userId});

        if (userCards.length >= 5) {
            return res.status(400).json({message: 'User already has 5 cards'});
        }

        const colors = ['grey', 'blue', 'green', 'yellow', 'purple', 'red'];
        const usedColors = userCards.map(card => card.color);
        const availableColors = colors.filter(color => !usedColors.includes(color));

        if (availableColors.length === 0) {
            return res.status(400).json({message: 'No available colors for new card'});
        }

        const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];

        const paymentSystem = cardNumber.startsWith('4') ? 'visa' : cardNumber.startsWith('5') ? 'mastercard' : 'unknown';

        const newCard = new CardModel({
            cardNumber,
            cardHolder,
            expiryDate,
            cvv,
            userId,
            color: randomColor,
            paymentSystem,
            selected: false
        });

        await newCard.save();
        res.status(201).json({message: 'Card added successfully', card: newCard});
    } catch (error) {
        console.error('Error adding card:', error);
        res.status(500).json({message: 'Error adding card', error});
    }
};

const getAllCards = async (req, res) => {
    const {userId} = req.query;

    if (!userId) {
        return res.status(400).json({message: 'User ID is required'});
    }

    try {
        const cards = await CardModel.find({userId});
        res.status(200).json(cards);
    } catch (error) {
        console.error('Error fetching cards:', error);
        res.status(500).json({message: 'Error fetching cards', error});
    }
};

const selectCard = async (req, res) => {
    const {userId, cardNumber} = req.body;

    if (!userId || !cardNumber) {
        return res.status(400).json({message: 'User ID and card number are required'});
    }

    try {
        await CardModel.updateMany({userId}, {selected: false});
        const card = await CardModel.findOneAndUpdate({userId, cardNumber}, {selected: true}, {new: true});
        if (!card) {
            return res.status(404).json({message: 'Card not found'});
        }
        res.status(200).json({message: 'Card selected successfully', card});
    } catch (error) {
        console.error('Error selecting card:', error);
        res.status(500).json({message: 'Error selecting card', error});
    }
};

const getAllTransactions = async (req, res) => {
    const {userId} = req.query;

    try {
        const transactions = await TransactionModel.find({userId});
        res.status(200).json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({message: 'Error fetching transactions', error});
    }
};

const getSelectedCard = async (req, res) => {
    const {userId} = req.query;

    if (!userId) {
        return res.status(400).json({message: 'User ID is required'});
    }

    try {
        const cards = await CardModel.find({userId});
        const selectedCard = cards.find(card => card.selected);

        if (!selectedCard) {
            return res.status(404).json({message: 'No selected card found'});
        }

        res.status(200).json(selectedCard);
    } catch (error) {
        console.error('Error fetching selected card:', error);
        res.status(500).json({message: 'Error fetching selected card', error});
    }
};

const updateUser = async (req, res) => {
    try {
        const {userId} = req.body;
        const updates = req.body;

        if (!userId) {
            return res.status(400).json({message: "User ID is required"});
        }

        if (req.files && req.files.avatar) {
            const avatar = req.files.avatar;
            const avatarName = `avatar-${userId}-${Date.now()}`;
            const avatarUrl = await uploadImage(avatar, avatarName);
            updates.avatar = avatarUrl;
        }

        const user = await User.findByIdAndUpdate(userId, updates, {new: true});

        if (!user) {
            return res.status(404).json({message: "User not found"});
        }

        res.status(200).json({message: "User updated successfully", user});
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({message: "Error updating user", error});
    }
};

const updatePassword = async (req, res) => {
    const {userId, oldPassword, newPassword} = req.body;

    console.log("Request received", req.body);

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }

        if (oldPassword !== user.password) {
            return res.status(400).json({message: 'Incorrect old password'});
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({message: 'Password updated successfully'});
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({message: 'Error updating password', error});
    }
};

const createHelpForm = async (req, res) => {
    const {userId, email, message} = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }

        const newHelpQuote = new HelpQuote({
            userId,
            email,
            message,
        });

        const messageToChannel = `
🆘 New help quote:
👨 Name: ${user.name}
👨 Second Name: ${user.secondName}
👤 Contact: ${email}
💬 Message: ${message}
📇 User's Role: ${user.role}
📞 Phone Number: ${user.phone}`;

        sendMessageToChannel(messageToChannel);

        await newHelpQuote.save();
        res.status(201).json({message: 'Help quote created successfully'});
    } catch (error) {
        console.error('Error creating help quote:', error);
        res.status(500).json({message: 'Error creating help quote', error});
    }
};

const updateNotifications = async (req, res) => {
    const {
        userId,
        notificationsEnabled,
        aiNotifications,
        carrierNotifications,
        loadNotifications,
        driverNotifications,
        updateNotifications
    } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }

        user.notifications = {
            notificationsEnabled,
            aiNotifications,
            carrierNotifications,
            loadNotifications,
            driverNotifications,
            updateNotifications,
        };

        await user.save();
        res.status(200).json({message: 'Notification settings updated successfully'});
    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({message: 'Error updating notification settings', error});
    }
};

const sendUserEmail = async (req, res) => {
    const {email} = req.body;
    try {
        const messageToChannel = `
⚠️ New subscriber from the website:
👤 Contact: ${email}`

        sendMessageToChannel(messageToChannel);
        sendEmail(email, "Thanks for subscribing!", "You will receive notifications about new features and updates on our platform.");
        res.status(200).json({message: 'Email sent successfully'});
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({message: 'Failed to send email'});
    }
};

const createCarrierLoadPaymentSession = async (req, res) => {
    try {
        const data = JSON.parse(req.query.data);
        console.log("Recieved data for payment session:", data);
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'USD',
                    value: data.price ? data.price.toString() : '1.00'
                }
            }],
            application_context: {
                return_url: `${process.env.DASHBOARD_FRONTEND_URL}/payment-success?data=${encodeURIComponent(JSON.stringify(data))}`,
                cancel_url: `${process.env.DASHBOARD_FRONTEND_URL}/payment-cancelled`
            }
        });
        const order = await client.execute(request);
        const approvalUrl = order.result.links.find(link => link.rel === 'approve').href;
        res.json({paymentUrl: approvalUrl});
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Failed to create payment session'});
    }
};


const generateLoadId = async () => {
    const prefix = '49-0013';
    let uniqueSuffix, loadId, isUnique = false;
    while (!isUnique) {
        uniqueSuffix = `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
        loadId = `${prefix}-${uniqueSuffix}`;
        const existingLoad = await Load.findOne({loadId});
        if (!existingLoad) isUnique = true;
    }
    return loadId;
};



const contactUsRequest = async (req, res) => {
    const {name, email, message} = req.body;

    try {
        await createZohoLead({
            lastName: name || 'Anonymous',
            email,
            company: 'AllShip Contact Form',
            phone: '',
            message,
        });

        const messageToChannel = `
⚠️ Contact Form Request:
👤 Name: ${name}
📧 Contact: ${email}
💬 Message: ${message}`;
        sendMessageToChannel(messageToChannel);

        sendEmail(
            email,
            "Thanks for contacting us!",
            "You will receive a notification when your request is reviewed."
        );

        res.status(200).json({message: 'Lead saved & email sent successfully'});
    } catch (error) {
        console.error('Error processing contact request:', error);
        res.status(500).json({message: 'Failed to handle request'});
    }
};

const addCarrierAdditionalInfo = async (req, res) => {
    const {userId, mileagePricing, serviceCosts} = req.body;

    try {
        const user = await UserModel.findOne({_id: userId, role: 'carrier'});
        if (!user) return res.status(404).json({message: 'Carrier not found'});

        user.carrierMileagePricing = mileagePricing;
        user.carrierServiceCosts = serviceCosts;
        user.carrierEnteredAdditionalInfo = true;
        await user.save();

        res.status(200).json({message: 'Additional info added', user});
    } catch (err) {
        res.status(500).json({message: 'Server error', error: err.message});
    }
};

const submitMovingQuote = async (req, res) => {
    const {
        from,
        to,
        movingDate,
        homeSize,
        name,
        email,
        phone,
        movedBefore,
        additionalInfo,
        contactTimes
    } = req.body;

    try {
        const message = `
🚚 New Moving Quote Request:
🔹 Name: ${name}
📍 From: ${from} ➡️ To: ${to}
📅 Date: ${movingDate}
🏠 Home Size: ${homeSize}
📞 Phone: ${phone}
📧 Email: ${email}
❓ Moved Before: ${movedBefore}
📝 Additional Info: ${additionalInfo || 'None'}
⏰ Preferred Contact Times: ${contactTimes.join(', ')}`;

        await sendMessageToChannel(message);

        await sendEmail(email, 'Your Moving Quote Request', `
Thank you for your quote request, ${name}!

Here’s what we received:
- From: ${from}
- To: ${to}
- Moving Date: ${movingDate}
- Home Size: ${homeSize}
- Phone: ${phone}
- Contact Times: ${contactTimes.join(', ')}

We will reach out to you shortly.`);

        await createZohoLead({
            lastName: name || 'Anonymous',
            email,
            phone,
            company: 'Moving Quote Request',
            message: `From: ${from} → ${to}, Home Size: ${homeSize}, Date: ${movingDate}, Info: ${additionalInfo}`,
        });

        res.status(200).json({message: 'Quote submitted successfully'});
    } catch (error) {
        console.error('Error submitting quote:', error);
        res.status(500).json({message: 'Server error while submitting quote', error});
    }
};

const OPENAI_API_KEY = process.env.OPENAI_KEY;

const getUniqueAvatars = (count) => {
    const avatars = [];
    const used = new Set();
    while (avatars.length < count) {
        const gender = Math.random() > 0.5 ? 'men' : 'women';
        const num = Math.floor(Math.random() * 99) + 1;
        const url = `https://randomuser.me/api/portraits/${gender}/${num}.jpg`;
        if (!used.has(url)) {
            avatars.push(url);
            used.add(url);
        }
    }
    return avatars;
};

const generateReviewsForCarrier = async (user) => {
    const prompt = `
Generate between 7 and 10 unique, realistic, and positive reviews for a logistics carrier.
Each review must have:
- name (realistic, not repeating)
- secondName (realistic, not repeating)
- rate (4 or 5)
- text (human, positive, 1-2 sentences, not generic, not repeating)
- avatar (leave empty, will be filled later)
- role ("customer")
Return as a JSON array.
`;

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-4',
            messages: [{role: 'user', content: prompt}],
            max_tokens: 900,
            temperature: 0.8,
        },
        {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
        }
    );

    let reviews;
    try {
        reviews = JSON.parse(response.data.choices[0].message.content);
        if (!Array.isArray(reviews)) throw new Error('Not an array');
    } catch (e) {
        console.error('Failed to parse reviews from AI:', e);
        return;
    }

    const avatars = getUniqueAvatars(reviews.length);
    const reviewsCount = reviews.length;
    reviews = reviews.map((review, idx) => ({
        ...review,
        avatar: avatars[idx],
        reviewsCount
    }));

    user.reviews = reviews;
    await user.save();
    console.log(`Filled reviews for carrier: ${user.email}`);
};

const fillCarrierReviews = async () => {
    try {
        const carriers = await User.find({role: 'carrier', $or: [{reviews: {$exists: false}}, {reviews: {$size: 0}}]});
        for (const user of carriers) {
            await generateReviewsForCarrier(user);
        }
    } catch (err) {
        console.error('Error filling carrier reviews:', err);
    }
};

const generateAboutForCarrier = async (user) => {
    // Compose a prompt using user info if available
    const prompt = `
Write a professional, friendly, and realistic "About" section for a logistics carrier.
Include benefits of working with this carrier, years of experience (estimate if not provided), and what makes them stand out.
Use the following info if available:
- Name: ${user.companyName || user.name + ' ' + user.secondName}
- City/State: ${user.city || ''}${user.state ? ', ' + user.state : ''}
- Years of experience: ${user.serviceActivity || 'not specified'}
- Service rating: ${user.serviceRating || 'not specified'}
- Any other info: ${user.companyUrl ? 'Website: ' + user.companyUrl : ''}
Make it unique and human, 3-5 sentences.
`;

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-4',
            messages: [{role: 'user', content: prompt}],
            max_tokens: 300,
            temperature: 0.8,
        },
        {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
        }
    );

    let about;
    try {
        about = response.data.choices[0].message.content.trim();
    } catch (e) {
        console.error('Failed to parse about from AI:', e);
        return;
    }

    user.about = about;
    await user.save();
    console.log(`Filled about for carrier: ${user.email}`);
};

const fillCarrierAbouts = async () => {
    try {
        const carriers = await User.find({role: 'carrier', $or: [{about: {$exists: false}}, {about: ''}]});
        for (const user of carriers) {
            await generateAboutForCarrier(user);
        }
    } catch (err) {
        console.error('Error filling carrier abouts:', err);
    }
};

const isCarrierSuitable = (carrier, load) => {
    return (
        carrier.state &&
        load.pickupLocation &&
        load.pickupLocation.includes(carrier.state) &&
        carrier.serviceRating >= 4
    );
};

const calculateBidPrice = (carrier, load) => {
    if (carrier.carrierMileagePricing && load.milesTrip) {
        for (const mp of carrier.carrierMileagePricing) {
            if (load.milesTrip >= mp.fromMiles && load.milesTrip <= mp.toMiles) {
                return mp.price;
            }
        }
    }
    return Math.round((load.milesTrip || 100) * 2.5);
};

const generateBidLetter = async (carrier, load, bidPrice) => {
    const prompt = `
Write a professional, detailed, and persuasive bid letter (at least 350 words) from a logistics carrier to a customer for the following load.
Include:
- Carrier's company name: ${carrier.companyName || carrier.name + ' ' + carrier.secondName}
- Carrier's experience: ${carrier.serviceActivity || 'not specified'} years
- Carrier's rating: ${carrier.serviceRating || 'not specified'}
- Load details: ${JSON.stringify({
        title: load.title,
        type: load.type,
        pickupLocation: load.pickupLocation,
        deliveryLocation: load.deliveryLocation,
        milesTrip: load.milesTrip,
        weight: load.weight,
        description: load.description
    })}
- Bid price: $${bidPrice}
- Why the carrier is a great fit for this load
- Commitment to service, reliability, and customer satisfaction

Letter:
`;

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-4',
            messages: [{role: 'user', content: prompt}],
            max_tokens: 1200,
            temperature: 0.8,
        },
        {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
        }
    );

    return response.data.choices[0].message.content.trim();
};

const autoBidForAllLoads = async () => {
    const carriers = await User.find({
        role: 'carrier',
        carrierMileagePricing: { $exists: true, $not: { $size: 0 } },
        carrierServiceCosts: { $exists: true },
        reviews: { $exists: true, $not: { $size: 0 } },
        serviceActivity: { $exists: true }
    });
    const loads = await Load.find({
        status: 'Active',
        bids: { $exists: true, $size: 0 },
        pickupLocation: { $ne: null },
        deliveryLocation: { $ne: null }
    });
    console.log(`🔍 Found ${carriers.length} carriers and ${loads.length} active loads to process.`);
    const globalCarrierBidMap = {};
    for (const carrier of carriers) {
        const price = Math.floor(Math.random() * (3500 - 1000 + 1)) + 1000;
        const companyName = carrier.companyName || `${carrier.name} ${carrier.secondName}`;
        const experience = carrier.serviceActivity?.yearsOfExperience || Math.floor(Math.random() * 6 + 1);
        const rating = (carrier.reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / carrier.reviews.length).toFixed(1);
        const letter = `
Hello,

My name is ${carrier.name} from ${companyName}. With over ${experience} years of experience in the logistics industry, I specialize in providing dependable, on-time deliveries with excellent customer communication.

Based on the route and requirements, I can offer to deliver your shipment for **$${price}**. My team and I prioritize careful handling, real-time tracking, and customer satisfaction — as reflected in our ${rating}-star rating from previous clients.

If you choose to work with us, I assure you a smooth, professional, and worry-free experience from pickup to drop-off.

Looking forward to assisting you!
Best regards,
${companyName}
        `.trim();

        globalCarrierBidMap[carrier._id.toString()] = {
            bidPrice: price.toString(),
            letter
        };
    }

    for (const load of loads) {
        for (const carrier of carriers) {
            const { bidPrice, letter } = globalCarrierBidMap[carrier._id.toString()];

            const deliveryDays = Math.floor(Math.random() * 7) + 1;
            const estimatedDeliveryTime = new Date();
            estimatedDeliveryTime.setDate(estimatedDeliveryTime.getDate() + deliveryDays);

            load.bids.push({
                carrierId: carrier._id.toString(),
                carrierCompanyName: carrier.companyName || `${carrier.name} ${carrier.secondName}`,
                bidPrice,
                aiMadeBid: true,
                letter,
                estimatedDeliveryTime,
                createdAt: new Date()
            });
        }
        load.bidsQuantity = load.bids.length;
        load.avgPrice = Math.round(
            load.bids.reduce((sum, b) => sum + Number(b.bidPrice), 0) / load.bids.length
        );
        load.markModified('bids');
        await load.save();
        console.log(`✅ Load ${load.loadId} filled with ${load.bids.length} AI-marked bids.`);
    }
    console.log('🎯 Auto-bidding complete. All active empty loads filled.');
};



const findMatchedCarriers = async (req, res) => {
    const formData = req.body;
    const storageAmount = Number(formData.storageAmount) || 0;

    const calculateAverageRating = reviews => {
        if (!reviews?.length) return 0;
        const sum = reviews.reduce((a, r) => a + (r.rate || 0), 0);
        return Math.round((sum / reviews.length) * 10) / 10;
    };

    // 📍 Получаем реальную дистанцию между from → to
    const getDistanceMiles = async (from, to) => {
        try {
            const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${encodeURIComponent(from)}&destinations=${encodeURIComponent(to)}&key=${GOOGLE_MAPS_API_KEY}`;
            const response = await axios.get(url);

            if (response.data.rows[0].elements[0].status === "OK") {
                const meters = response.data.rows[0].elements[0].distance.value;
                const miles = meters / 1609.34;
                return Math.max(30, Math.round(miles)); // минимум 30 миль
            }
            return 50; // fallback
        } catch (err) {
            console.error("Distance API error:", err.message);
            return 50;
        }
    };

    // 🎯 Расчёт цены мили
    const getMileagePrice = (pricing, distance) => {
        if (!Array.isArray(pricing) || pricing.length === 0) return 2;

        let price = pricing[0].price;
        for (const tier of pricing) {
            if (distance >= tier.from && distance <= tier.to) {
                price = tier.price;
                break;
            }
        }
        return Math.min(price, 10); // max $10/mi
    };

    try {
        // Забираем перевозчиков с прайсингом и отзывами
        const carriers = await User.find({
            role: "carrier",
            $expr: {
                $and: [
                    { $gt: [{ $size: "$reviews" }, 0] },
                    { $gt: [{ $size: "$carrierMileagePricing" }, 0] }
                ]
            }
        });

        // Получаем дистанцию один раз
        const distance = await getDistanceMiles(formData.from, formData.to);

        const enriched = carriers.map((c, idx) => {
            const avgRating = calculateAverageRating(c.reviews);

            const mileagePrice = getMileagePrice(c.carrierMileagePricing, distance);
            let distanceCharge = Math.round(distance * mileagePrice);

            // Лимит на перевозку
            distanceCharge = Math.min(distanceCharge, 25000);

            const packingCharge = formData.fullPacking ? c.carrierServiceCosts.packingCost : 0;
            const unpackingCharge = formData.unpacking ? c.carrierServiceCosts.unpackingCost : 0;
            const storageCharge = formData.storage ? (c.carrierServiceCosts.storageCost * (storageAmount || 1)) : 0;

            let totalPrice = distanceCharge + packingCharge + unpackingCharge + storageCharge;
            totalPrice = Math.min(totalPrice, 25000);

            // 👇 Реальный расчет orders
            const pastOrders = c.pastOrders || c.reviews.length * 5;

            const description = `${c.companyName} rated ${avgRating}/5, serves ${c.state}, est. ${distance}mi, total ~$${totalPrice}.`;

            return {
                _id: c._id,
                name: c.name,
                secondName: c.secondName,
                companyName: c.companyName,
                avatar: c.avatar,
                state: c.state,
                experience: `${c.serviceActivity || 0} years`,
                rating: avgRating,
                carrierServiceCosts: c.carrierServiceCosts,
                carrierMileagePricing: c.carrierMileagePricing,
                reviewsCount: c.reviews.length,
                bestMatch: idx === 0,
                distance,
                distanceCharge,
                packingCharge,
                unpackingCharge,
                storageCharge,
                totalPrice,
                pastOrders,
                description
            };
        }).filter(carrier => carrier.totalPrice <= 25000);

        // Сортировка: рейтинг → цена → опыт
        const sorted = enriched.sort((a, b) => {
            if (b.rating !== a.rating) return b.rating - a.rating;
            if (a.totalPrice !== b.totalPrice) return a.totalPrice - b.totalPrice;
            return parseInt(b.experience) - parseInt(a.experience);
        }).slice(0, 6);

        res.json({ matchedCarriers: sorted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error", error: err.message });
    }
};



const createLoadFromCookie = async (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.userId) {
            return res.status(400).json({ error: 'Missing userId or data.' });
        }

        const user = await User.findById(data.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const formatSubType = (type) => {
            if (!type) return 'Moving';
            return type
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        };
        const subType = formatSubType(data.moveType);

        const loadId = await generateLoadId();

        let chosenCarrierObj = null;
        if (data.chosenCarrier) {
            const carrierUser = await User.findById(data.chosenCarrier);
            const carrierCompanyName = carrierUser && carrierUser.companyName ? carrierUser.companyName : '';

            const chat = new Chat({
                carrierId: data.chosenCarrier,
                shipperId: user._id,
                loadId,
                carrierCompanyName,
                shipperName: user.name,
                bidPrice: data.price,
                title: data.title || `${data.bedrooms || ''} Bedroom Move`,
                subType,
                chatHistory: []
            });
            await chat.save();

            chosenCarrierObj = {
                carrierId: data.chosenCarrier,
                carrierCompanyName,
                chatId: chat._id,
                bidPrice: data.price
            };
        }

        const newLoad = new Load({
            userId: user._id,
            email: user.email,
            loadId,
            type: 'Moving',
            subType,
            title: data.title || `${data.bedrooms || ''} Bedroom Move`,
            status: 'Inactive',
            pickupLocation: data.from,
            deliveryLocation: data.to,
            pickupDate: data.pickupDate ? new Date(data.pickupDate) : undefined,
            deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
            numberOfBedrooms: String(data.bedrooms || ''),
            totalSquareFootage: String(data.volume || ''),
            packingUnpackingServices: !!(data.fullPacking || data.halfPacking || data.quarterPacking),
            storageNeeds: !!data.storage,
            needExtraMovingSupplies: false,
            furnitureDisassemblyReassembly: false,
            appliancesBeingMoved: [],
            largeFurnitureItems: [],
            specialHandlingRequired: [],
            price: data.price,
            images: Array.isArray(data.images) ? data.images : [],
            bidsQuantity: 0,
            avgPrice: 0,
            ...(chosenCarrierObj && { chosenCarrier: chosenCarrierObj })
        });

        await newLoad.save();

        await sendEmail(
            user.email,
            `Order ${loadId} Created Successfully`,
            `Dear Customer,

Your order (${loadId}) has been created successfully and is currently inactive.

To activate your load and proceed with the service, please complete a payment of $100.

Thank you for choosing AllShip. If you have any questions, feel free to contact our support team.

Best regards,
AllShip Team`
        );

        res.status(200).json({
            message: 'Load created from cookie.',
            loadId: newLoad.loadId,
            chosenCarrier: chosenCarrierObj
        });
    } catch (err) {
        console.error('Error in createLoadFromCookie:', err);
        res.status(500).json({ error: 'Failed to create load from cookie' });
    }
};

module.exports = {
    getUser,
    addCard,
    fillCarrierAbouts,
    submitMovingQuote,
    contactUsRequest,
    updatePassword,
    autoBidForAllLoads,
    selectCard,
    sendUserEmail,
    addDriver,
    getAllTransactions,
    getAllCards,
    findMatchedCarriers,
    createCarrierLoadPaymentSession,
    createHelpForm,
    updateUser,
    getAllDrivers,
    updateNotifications,
    updateLocation,
    fillCarrierReviews,
    createLoadFromCookie,
    getSelectedCard,
    addCarrierAdditionalInfo
};