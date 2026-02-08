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
    const decodedLink = decodeURIComponent(inspectLink);
    console.log('🔓 Link decodificado:', decodedLink);
    
    // Extrair parâmetros S, A, D, M
    const sMatch = decodedLink.match(/S(\d+)/);
    const aMatch = decodedLink.match(/A(\d+)/);
    const dMatch = decodedLink.match(/D(\d+)/);
    const mMatch = decodedLink.match(/M(\d+)/);
    
    if (!sMatch || !aMatch || !dMatch) {
      console.log('⚠️ Parâmetros S, A ou D não encontrados');
      return {
        statusCode: 400,
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
    
    console.log(`📊 Parâmetros extraídos: S=${s}, A=${a}, D=${d}, M=${m}`);
    
    // Chamar API PriceEmpire
    const apiUrl = `https://api.pricempire.com/v3/inspect?s=${s}&a=${a}&d=${d}&m=${m}`;
    console.log('🌐 Chamando API:', apiUrl);
    
    const data = await new Promise((resolve, reject) => {
      https.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      }, (res) => {
        let body = '';
        
        console.log('📡 Status HTTP:', res.statusCode);
        
        res.on('data', chunk => body += chunk);
        
        res.on('end', () => {
          console.log('📄 Response body (primeiros 500 chars):', body.substring(0, 500));
          
          if (res.statusCode !== 200) {
            reject(new Error(`API retornou status ${res.statusCode}: ${body}`));
            return;
          }
          
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (e) {
            console.error('❌ Erro ao parsear JSON:', e.message);
            reject(new Error('Resposta da API não é JSON válido'));
          }
        });
      }).on('error', (err) => {
        console.error('❌ Erro na requisição HTTP:', err.message);
        reject(err);
      });
    });
    
    console.log('✅ Dados recebidos da API:', JSON.stringify(data).substring(0, 300));
    
    // Extrair float da resposta (tentar diferentes campos)
    const floatValue = data?.floatvalue || data?.paintwear || data?.float || null;
    
    console.log('🎯 Float extraído:', floatValue);
    
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
    console.error('Stack:', error.stack);
    
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
