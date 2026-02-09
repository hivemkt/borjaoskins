const CONFIG = {
    supabase: {
        url: window.ENV?.SUPABASE_URL || process.env.SUPABASE_URL,
        key: window.ENV?.SUPABASE_KEY || process.env.SUPABASE_KEY
    },

    mercadoPago: {
        accessToken: window.ENV?.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN,
        publicKey: window.ENV?.MP_PUBLIC_KEY || process.env.MP_PUBLIC_KEY
    },

    admin: {
        passwordHash: window.ENV?.ADMIN_HASH || process.env.ADMIN_HASH,
        
        verifyPassword: async function(password) {
            const hash = await this.hashPassword(password);
            return hash === this.passwordHash;
        },
        
        hashPassword: async function(password) {
            const msgBuffer = new TextEncoder().encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        }
    },

    site: {
        nome: 'Borjão Skins',
        logo: 'images/logodb.png',
        whatsapp: window.ENV?.WHATSAPP || process.env.WHATSAPP,
        instagram: window.ENV?.INSTAGRAM || process.env.INSTAGRAM,
        email: window.ENV?.EMAIL || process.env.EMAIL
    },

    rifas: {
        maxNumerosPorPessoa: 10,
        precoBase: 5.00,
        totalNumerosPadrao: 100,
        tempoReserva: 2,
        autoRefresh: 10
    },

    analytics: {
        trackClicks: true,
        trackWhatsApp: true,
        trackEstoque: true
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
