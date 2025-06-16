require('dotenv').config();
const axios = require('axios');

const {
    ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN,
    ZOHO_API_BASE,
    ZOHO_ACCOUNTS_BASE,
    ZOHO_REDIRECT_URI,
    ZOHO_LAYOUT_ID,
    ZOHO_OWNER_ID
} = process.env;

async function getAccessToken() {
    const { data } = await axios.post(`${ZOHO_ACCOUNTS_BASE}/oauth/v2/token`, null, {
        params: {
            refresh_token: ZOHO_REFRESH_TOKEN,
            client_id: ZOHO_CLIENT_ID,
            client_secret: ZOHO_CLIENT_SECRET,
            grant_type: 'refresh_token',
        },
    });

    return data.access_token;
}

const ORG_ID = '885744472'; // встав свій

async function createZohoLead({ firstName = '', lastName, email, company, phone, message, source, title }) {
    try {
        const accessToken = await getAccessToken();

        const payload = {
            data: [
                {
                    First_Name: firstName,
                    Last_Name: lastName || 'Unknown',
                    Full_Name: `${firstName} ${lastName || ''}`.trim(),
                    Email: email,
                    Company: company || 'AllShip Lead',
                    Phone: phone || '',
                    Lead_Source: source || 'Website',
                    Lead_Status: 'Not Contacted',
                    Job_Title: title,
                    Description: message || 'No message provided',
                    Owner: { id: ZOHO_OWNER_ID },
                    layout: { id: ZOHO_LAYOUT_ID },
                },
            ],
            trigger: ['workflow'],
        };

        const postResponse = await axios.post(
            `${ZOHO_API_BASE}/crm/v2/Leads`,
            payload,
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`,
                },
            }
        );

        const leadId = postResponse.data?.data?.[0]?.details?.id;
        if (!leadId) {
            throw new Error('Lead creation succeeded but no ID was returned.');
        }

        const crmUrl = `https://crm.zoho.com/crm/org${ORG_ID}/tab/Leads/${leadId}`;
        console.log('✅ Lead created:', leadId);
        console.log('🔗 View in CRM:', crmUrl);

        return { leadId, crmUrl };
    } catch (error) {
        const err = error.response?.data || error.message;
        console.error('❌ Error in lead flow:', err);
        throw error;
    }
}


module.exports = { createZohoLead };
