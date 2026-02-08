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
  
  console.log('📥 Inspect link recebido:', inspectLink);
  
  if (!inspectLink) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Inspect link obrigatório', float: null })
    };
  }
  
  try {
    // Decodificar URL
    let decodedLink = inspectLink;
    let previousLink = '';
    
    while (decodedLink !== previousLink) {
      previousLink = decodedLink;
      try {
        decodedLink = decodeURIComponent(decodedLink);
      } catch (e) {
        break;
      }
    }
    
    console.log('🔓 Link decodificado:', decodedLink);
    
    // Extrair parâmetros S, A, D, M
    const sMatch = decodedLink.match(/S(\d+)/);
    const aMatch = decodedLink.match(/A(\d+)/);
    const dMatch = decodedLink.match(/D(\d+)/);
    const mMatch = decodedLink.match(/M(\d+)/);
    
    if (!sMatch || !aMatch || !dMatch) {
      console.log('⚠️ Parâmetros não encontrados');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Inspect link inválido',
          float: null 
        })
      };
    }
    
    const s = sMatch[1];
    const a = aMatch[1];
    const d = dMatch[1];
    const m = mMatch ? mMatch[1] : '0';
    
    console.log(`📊 Parâmetros: S=${s}, A=${a}, D=${d}, M=${m}`);
    
    // Usar API CSGOFloat (gratuita e funciona sem key)
    const apiUrl = `https://api.csgofloat.com/?url=${encodeURIComponent(decodedLink)}`;
    console.log('🌐 Chamando CSGOFloat API');
    
    const data = await new Promise((resolve, reject) => {
      https.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      }, (res) => {
        let body = '';
        
        console.log('📡 Status:', res.statusCode);
        
        res.on('data', chunk => body += chunk);
        
        res.on('end', () => {
          console.log('📄 Response (200 chars):', body.substring(0, 200));
          
          if (res.statusCode !== 200) {
            reject(new Error(`API retornou status ${res.statusCode}: ${body}`));
            return;
          }
          
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (e) {
            console.error('❌ JSON inválido');
            reject(new Error('Resposta não é JSON válido'));
          }
        });
      }).on('error', (err) => {
        console.error('❌ Erro HTTP:', err.message);
        reject(err);
      });
    });
    
    console.log('✅ Dados recebidos');
    
    // Extrair float da resposta
    const floatValue = data?.iteminfo?.floatvalue || data?.floatvalue || data?.float || null;
    
    console.log('🎯 Float:', floatValue);
    
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
    console.error('💥 Erro:', error.message);
    
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
