const https = require('https');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const inspectLink = event.queryStringParameters?.url;
  
  if (!inspectLink) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'URL obrigatória' })
    };
  }

  try {
    const apiUrl = `https://api.csfloat.com/?url=${encodeURIComponent(inspectLink)}`;
    
    const data = await new Promise((resolve, reject) => {
      https.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error('JSON inválido'));
          }
        });
      }).on('error', reject);
    });

    // Extrair float
    const floatValue = data?.iteminfo?.floatvalue || null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        float: floatValue,
        data: data
      })
    };

  } catch (error) {
    console.error('Erro:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        float: null
      })
    };
  }
};
