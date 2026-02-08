const cache = {};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // Pega o link de inspeção da URL (ex: /.netlify/functions/get-float?url=...)
  const inspect = event.queryStringParameters?.url;
  
  if (!inspect) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'URL obrigatória' })
    };
  }

  // 1. Verificação de Cache (evita gastar sua cota da API com itens repetidos)
  if (cache[inspect] && Date.now() - cache[inspect].time < 300000) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(cache[inspect].data)
    };
  }

  try {
    const api = `https://api.csfloat.com/?url=${encodeURIComponent(inspect)}`;

    // 2. Chamada para o CSFloat com a sua API Key
    const response = await fetch(api, {
      method: 'GET',
      headers: {
        // COLOQUE SUA CHAVE DENTRO DAS ASPAS ABAIXO
        'Authorization': '3A4HinEGqHrA552atJeocOQG8LKLl1zs' 
      }
    });

    // Verifica se a API do CSFloat aceitou a requisição
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CSFloat API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 3. Estruturação do resultado
    const result = {
      success: true,
      float: data?.iteminfo?.floatvalue || null,
      paintseed: data?.iteminfo?.paintseed || null,
      paintindex: data?.iteminfo?.paintindex || null
    };

    // Salva no cache temporário
    cache[inspect] = {
      time: Date.now(),
      data: result
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error('Erro na Function:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
