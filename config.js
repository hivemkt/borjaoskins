// ================================================================
// CONFIGURAÇÕES CENTRALIZADAS - Borjão Skins
// ================================================================
// ⚠️ IMPORTANTE: Este arquivo contém informações sensíveis!
// NÃO compartilhe este arquivo publicamente
// ================================================================

const CONFIG = {
    // ===== SUPABASE =====
    supabase: {
        url: 'https://yyoyxanloloupwoczkhr.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5b3l4YW5sb2xvdXB3b2N6a2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODM2MjYsImV4cCI6MjA4NTI1OTYyNn0.yV9UszxZW0Ee5X6Zj8OLo1Q_uQfj99RJviaZIImiMAM'
    },

    // ===== MERCADO PAGO =====
    mercadoPago: {
        accessToken: 'SEU_ACCESS_TOKEN_AQUI', // ⚠️ CONFIGURE
        publicKey: 'SUA_PUBLIC_KEY_AQUI'      // ⚠️ CONFIGURE (se usar)
    },

    // ===== AUTENTICAÇÃO ADMIN =====
    admin: {
        username: 'admin',
        password: 'borjao777',
        
        // Múltiplos usuários (opcional)
        users: [
            { username: 'admin', password: 'borjao777', role: 'super_admin' },
            { username: 'borjao', password: 'borjao123', role: 'admin' },
            { username: 'vendedor', password: 'vendedor123', role: 'vendedor' }
        ]
    },

    // ===== CONFIGURAÇÕES DO SITE =====
    site: {
        nome: 'Borjão Skins',
        logo: 'images/logodb.png',
        whatsapp: '5511999999999', // ⚠️ CONFIGURE
        instagram: '@borjaoskins',  // ⚠️ CONFIGURE
        email: 'contato@borjaoskins.com' // ⚠️ CONFIGURE
    },

    // ===== CONFIGURAÇÕES DE RIFAS =====
    rifas: {
        maxNumerosPorPessoa: 10,
        precoBase: 5.00,
        totalNumerosPadrao: 100,
        tempoReserva: 2, // minutos
        autoRefresh: 10  // segundos
    },

    // ===== ANALYTICS & TRACKING =====
    analytics: {
        trackClicks: true,
        trackWhatsApp: true,
        trackEstoque: true
    },

    // ===== NOTIFICAÇÕES =====
    notifications: {
        webhookUrl: '', // ⚠️ CONFIGURE (Discord/Slack webhook)
        emailNotifications: false
    }
};

// Exportar configuração
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
