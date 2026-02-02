// Netlify Function: Create PIX Payment
// Mercado Pago SDK v2

const { MercadoPagoConfig, Payment } = require('mercadopago');

exports.handler = async (event) => {
    // CORS Headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Only POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse body
        const { transaction_amount, description, payer, external_reference } = JSON.parse(event.body);

        // Configure Mercado Pago Client (SDK v2 syntax)
        const client = new MercadoPagoConfig({ 
            accessToken: 'TEST-861897508909678-020211-a341f8eaad70bcc352afa028a9339b8d-136456359'
        });
        
        const payment = new Payment(client);

        // Create payment (SDK v2 syntax)
        const result = await payment.create({
            body: {
                transaction_amount: parseFloat(transaction_amount),
                description: description,
                payment_method_id: 'pix',
                payer: {
                    email: payer.email,
                    first_name: payer.first_name,
                    last_name: payer.last_name || payer.first_name
                },
                external_reference: external_reference,
                notification_url: 'https://www.borjaoskins.com/.netlify/functions/webhook'
            }
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('❌ Error:', error);
        console.error('❌ Error message:', error.message);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Payment creation failed',
                message: error.message,
                details: error.cause || error.response?.data || null
            })
        };
    }
};
