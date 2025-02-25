const axios = require('axios');
const User = require('../models/User');

const API_KEY = "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";
const API_URL = 'https://api.openai.com/v1/chat/completions';

const sendMessage = async (req, res) => {
    const { messages, email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).send('User not found');
        }
        const userInfo = JSON.stringify(user);
        console.log("User Info: ", userInfo);
        const response = await axios.post(API_URL, {
            model: 'gpt-3.5-turbo',
            messages: [
                ...messages,
                { role: 'system', content: `The user's name is ${user.name}. 
                Please respond in a friendly manner with emojis. Also analyze 
                this data of user ${userInfo}, DO NOT TELL HIM ABOUT HIS PASSWORD,
                 IT SECRET INFORMATION, also if user will be asking about him info
                  you need to answer friendly and with good intonation, you can analyze his data, 
                  but dont tell that you analyzed user's data, if user will asks about his
                   data you can answer, but DO NOT TELL HIS PASSWORD, you do not need
                    to answer with greeting on any message if he asks you something else,
                     personalize your answer because you already used Hello userName! How can I
                      assist you today?, you need to personalize the answer and make it detailed, if user 
                      asks you about password you give give him a friendly refusal,
                       IF USER ASKS ABOUT PASSWORD YOU GIVE RESPONSE: i cant share your password` }
            ],
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const botReply = response.data.choices[0].message;
        res.json({ message: botReply });
    } catch (error) {
        console.error('Error fetching response:', error);
        res.status(500).send('Error fetching response');
    }
};

module.exports = {
    sendMessage
};