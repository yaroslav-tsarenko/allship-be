require('dotenv').config();
const paypal = require('@paypal/checkout-server-sdk');

function environment() {
    if (process.env.NODE_ENV === 'production') {
        return new paypal.core.LiveEnvironment(
            process.env.PAYPAL_CLIENT_ID,
            process.env.PAYPAL_SECRET_KEY
        );
    } else {
        return new paypal.core.SandboxEnvironment(
            process.env.PAYPAL_CLIENT_ID_TEST,
            process.env.PAYPAL_SECRET_TEST
        );
    }
}

function client() {
    return new paypal.core.PayPalHttpClient(environment());
}

module.exports = { client, paypal };