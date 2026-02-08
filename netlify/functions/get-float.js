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
      body: JSON.stringify({ error: 'Inspect link obrigatório' })
    };
  }
  
  try {
    // Extrair S, A, D, M do inspect link
    // Formato: steam://rungame/730/76561202255233023/+csgo_econ_action_preview S{owner}A{asset}D{inspect}M{listing}
    const sMatch = inspectLink.match(/S(\d+)/);
    const aMatch = inspectLink.match(/A(\d+)/);
    const dMatch = inspectLink.match(/D(\d+)/);
    const mMatch = inspectLink.match(/M(\d+)/);
    
    if (!sMatch || !aMatch || !dMatch) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Inspect link inválido',
          float: null
        })
      };
    }
    
    const s = sMatch[1];
    const a = aMatch[1];
    const d = dMatch[1];
    const m = mMatch ? mMatch[1] : '0';
    
    console.log(`Buscando float: S=${s} A=${a} D=${d} M=${m}`);
    
    // Chamar API PriceEmpire
    const apiUrl = `https://api.pricempire.com/v3/inspect?S=${s}&A=${a}&D=${d}&M=${m}`;
    
    const data = await new Promise((resolve, reject) => {
      https.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      }, (res) => {
        let body = '';
        
        res.on('data', chunk => body += chunk);
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (e) {
            reject(new Error('Resposta inválida da API'));
          }
        });
      }).on('error', reject);
    });
    
    console.log('PriceEmpire response:', data);
    
    // Extrair float da resposta
    const floatValue = data?.floatvalue || data?.float || data?.wear || null;
    
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
    console.error('Erro:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        float: null
      })
    };
  }
};
