const axios = require('axios');

exports.handler = async (event) => {
  let inspectLink = event.queryStringParameters.url;
  // Sua chave inserida diretamente para evitar erros de configuração
  const API_KEY = 'ecf6cc14-827a-4819-822a-f05a785ffff5'; 

  if (!inspectLink) {
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: "Link de inspeção ausente" }) 
    };
  }

  try {
    // 1. Decodifica o link recebido do frontend
    const cleanLink = decodeURIComponent(inspectLink).trim();

    // 2. Chamada para o Pricempire (Endpoint de Float)
    // O Pricempire exige a chave na URL ou nos parâmetros
    const response = await axios.get(`https://api.pricempire.com/v1/csgo/float`, {
      params: {
        api_key: API_KEY,
        url: cleanLink
      },
      timeout: 15000 // Aumentei para 15s porque bots de inspeção podem demorar
    });

    // 3. Retorno dos dados
    if (response.data && response.data.iteminfo) {
      return {
        statusCode: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" 
        },
        body: JSON.stringify({
          float: response.data.iteminfo.floatvalue,
          paintindex: response.data.iteminfo.paintindex
        })
      };
    } else {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ error: "Item não encontrado no banco do Pricempire" }) 
      };
    }

  } catch (error) {
    console.error("Erro na API Pricempire:", error.response?.data || error.message);
    
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        error: "Erro no servidor de Float", 
        details: error.response?.data || error.message 
      })
    };
  }
};
