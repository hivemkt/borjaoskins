// Netlify Function — Create PIX Payment
// Mercado Pago SDK v2
// Produção | Seguro | Validado

const { MercadoPagoConfig, Payment } = require('mercadopago');

exports.handler = async (event) => {
  // ===============================
  // CORS
  // ===============================
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Apenas POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // ===============================
    // Parse body
    // ===============================
    const body = JSON.parse(event.body);

    const {
      transaction_amount,
      description,
      payer,
      external_reference
    } = body;

    console.log('📥 BODY RECEBIDO:', body);

    // ===============================
    // Validações fortes
    // ===============================
    const amount = Number(transaction_amount);

    if (!amount || isNaN(amount)) {
      throw new Error('Invalid transaction_amount');
    }

    if (amount <= 0) {
      throw new Error('Transaction amount must be greater than zero');
    }

    // trava de segurança (opcional)
    if (amount > 10000) {
      throw new Error('Transaction amount too high');
    }

    if (!payer?.email) {
      throw new Error('Payer email is required');
    }

    // ===============================
    // Mercado Pago Client (PRODUÇÃO)
    // ===============================
    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN || 
        'APP_USR-861897508909678-020211-124d4fa380e582c73f57be0350a9945a-136456359'
    });

    const payment = new Payment(client);

    // ===============================
    // Criação do PIX
    // ===============================
    const paymentData = {
      transaction_amount: amount, // ⚠️ SEM *100
      description: description || 'Pagamento PIX',
      payment_method_id: 'pix',
      payer: {
        email: payer.email,
        first_name: payer.first_name || 'Cliente',
        last_name: payer.last_name || payer.first_name || 'PIX'
      },
      external_reference: external_reference || `PIX-${Date.now()}`,
      notification_url: 'https://www.borjaoskins.com/.netlify/functions/webhook'
    };

    console.log('📤 ENVIANDO PARA MP:', paymentData);

    const result = await payment.create({ body: paymentData });

    console.log('✅ PIX CRIADO:', {
      id: result.id,
      amount: result.transaction_amount,
      status: result.status
    });

    // ===============================
    // Retorno limpo pro front
    // ===============================
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: result.id,
        status: result.status,
        transaction_amount: result.transaction_amount,
        qr_code: result.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64
      })
    };

  } catch (error) {
    console.error('❌ ERRO CREATE PIX:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Payment creation failed',
        message: error.message,
        details: error.response?.data || null
      })
    };
  }
};
