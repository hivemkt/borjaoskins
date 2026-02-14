const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { raffle_id, buyer_name, buyer_phone, numbers, total_amount } = JSON.parse(event.body);

       
        if (!raffle_id || !buyer_name || !buyer_phone || !numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Dados inválidos' })
            };
        }

        
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY 
        );

       
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        const { data: existingSales, error: fetchError } = await supabase
            .from('raffle_sales')
            .select('numbers')
            .eq('raffle_id', raffle_id)
            .or(`payment_status.eq.approved,and(payment_status.eq.reserved,created_at.gte.${twoMinutesAgo})`);

        if (fetchError) {
            console.error('Erro ao buscar vendas:', fetchError);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Erro ao verificar números' })
            };
        }

        
        const numerosJaVendidos = new Set();
        if (existingSales && existingSales.length > 0) {
            existingSales.forEach(sale => {
                if (sale.numbers && Array.isArray(sale.numbers)) {
                    sale.numbers.forEach(num => numerosJaVendidos.add(num));
                }
            });
        }

        const conflictingNumbers = numbers.filter(num => numerosJaVendidos.has(num));

        if (conflictingNumbers.length > 0) {
            return {
                statusCode: 409, // Conflict
                body: JSON.stringify({
                    error: 'Números já reservados',
                    conflicting_numbers: conflictingNumbers
                })
            };
        }

        // ===== CRIAR VENDA COM STATUS "reserved" =====
        const saleData = {
            raffle_id,
            buyer_name,
            buyer_phone,
            numbers: numbers.sort((a, b) => a - b), 
            total_amount,
            payment_status: 'reserved',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: newSale, error: insertError } = await supabase
            .from('raffle_sales')
            .insert(saleData)
            .select()
            .single();

        if (insertError) {
            console.error('Erro ao inserir venda:', insertError);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Erro ao reservar números' })
            };
        }

        console.log('✅ Venda reservada:', newSale.id);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                sale: newSale
            })
        };

    } catch (error) {
        console.error('Erro geral:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Erro interno do servidor' })
        };
    }
};
