// Netlify Function: Webhook Mercado Pago
// Path: netlify/functions/webhook.js

const mercadopago = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

// Configurações
const ACCESS_TOKEN = 'TEST-861897508909678-020211-a341f8eaad70bcc352afa028a9339b8d-136456359';
const SUPABASE_URL = 'https://yyoyxanloloupwoczkhr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5b3l4YW5sb2xvdXB3b2N6a2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODM2MjYsImV4cCI6MjA4NTI1OTYyNn0.yV9UszxZW0Ee5X6Zj8OLo1Q_uQfj99RJviaZIImiMAM';

// Inicializar Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        console.log('Webhook recebido:', body);

        // Mercado Pago envia notificações de diferentes tipos
        if (body.type === 'payment' || body.action === 'payment.updated') {
            const paymentId = body.data.id;

            // Configurar Mercado Pago
            mercadopago.configure({
                access_token: ACCESS_TOKEN
            });

            // Buscar informações do pagamento
            const payment = await mercadopago.payment.get(paymentId);
            
            console.log('Status do pagamento:', payment.body.status);
            console.log('External reference:', payment.body.external_reference);

            // Se pagamento foi aprovado
            if (payment.body.status === 'approved') {
                const saleId = payment.body.external_reference;

                // Atualizar status no Supabase
                const { data, error } = await supabase
                    .from('raffle_sales')
                    .update({ 
                        payment_status: 'approved',
                        payment_id: paymentId
                    })
                    .eq('id', saleId);

                if (error) {
                    console.error('Erro ao atualizar Supabase:', error);
                } else {
                    console.log('✅ Pagamento aprovado e atualizado no Supabase:', saleId);
                }
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error('Erro no webhook:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Erro ao processar webhook',
                message: error.message 
            })
        };
    }
};
