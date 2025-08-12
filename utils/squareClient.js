require('dotenv').config();
const { Client, Environment } = require('square/legacy');

const env = process.env.NODE_ENV === 'production'
    ? Environment.Production
    : Environment.Sandbox;

const squareClient = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: env,
});

module.exports = { squareClient };
