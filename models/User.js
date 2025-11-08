const mongoose = require("mongoose");

const MileagePricingSchema = new mongoose.Schema({
    fromMiles: { type: Number, required: true },
    toMiles: { type: Number, required: true },
    price: { type: Number, required: true },
}, { _id: false });

const ServiceCostsSchema = new mongoose.Schema({
    packingCost: { type: Number, required: true },
    unpackingCost: { type: Number, required: true },
    storageCost: { type: Number, required: true },
}, { _id: false });

const ReviewSchema = new mongoose.Schema({
    name: { type: String, required: true },
    secondName: { type: String, required: true },
    rate: { type: Number, min: 0, max: 5, required: true },
    text: { type: String, required: true },
    avatar: { type: String },
    reviewsCount: { type: Number, default: 0 },
    role: { type: String, enum: ['customer', 'carrier', 'driver', 'admin'], required: true }
}, { _id: false });

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    secondName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    companyName: { type: String },
    companyUrl: { type: String },
    about: { type: String, default: '' },
    estShipmentsPerMonth: { type: Number },
    dotNumber: { type: String },
    datNumber: { type: String },
    mcNumber: { type: String },
    avatar: { type: String },
    card: { type: String },
    carrierId: { type: String },
    notifications: {
        notificationsEnabled: { type: Boolean, default: true },
        aiNotifications: { type: Boolean, default: true },
        carrierNotifications: { type: Boolean, default: true },
        loadNotifications: { type: Boolean, default: true },
        driverNotifications: { type: Boolean, default: true },
        updateNotifications: { type: Boolean, default: true },
    },
    role: { type: String, enum: ['customer', 'carrier', 'driver', 'admin'], default: 'customer' },
    truck: { type: String },
    drivingCategory: { type: String, enum: ['', 'C', 'СЕ ', 'C1', 'C1E'], default: '' },
    assignedLoads: [String],
    insurance: { type: Boolean },
    insuranceExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    addedByCarrier: { type: String },
    dot: { type: String },
    usDot: { type: String },
    serviceRating: { type: Number, default: 0 },
    serviceAgreement: { type: Number, default: 0 },
    serviceActivity: { type: Number, default: 0 },
    company: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    currentLocation: { type: String },
    currentLocationTime: { type: Date },
    carrierEnteredAdditionalInfo: { type: Boolean, default: false },
    carrierMileagePricing: [MileagePricingSchema],
    carrierServiceCosts: ServiceCostsSchema,
    reviews: [ReviewSchema],
    verificationCode: { type: String },
    verificationCodeExpires: { type: Date },
    verificated: { type: Boolean },
    createdAt: { type: Date, default: Date.now },
});

const UserModel = mongoose.model("users", UserSchema);
module.exports = UserModel;