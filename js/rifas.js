(function() {
    const SUPABASE_URL = window.ENV.SUPABASE_URL;
    const SUPABASE_KEY = window.ENV.SUPABASE_KEY;
    const MERCADOPAGO_PUBLIC_KEY = window.ENV.MP_PUBLIC_KEY;
    const CLIENT_EMAIL = 'dproartes@gmail.com';
    const ADMIN_PASSWORD_HASH = window.ENV.ADMIN_HASH;
    
    delete window.ENV;
    Object.freeze(window);

    let supabaseClient = null;
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch(error) {
        console.error('Erro ao conectar');
    }

    let currentRaffle = null;
    let selectedNumbers = new Set();
    let soldNumbers = new Set();

    async function init() {
        if (!supabaseClient) {
            document.getElementById('loadingMessage').textContent = 'Erro: Supabase não configurado.';
            return;
        }
        await loadRaffle();
        if (currentRaffle) {
            await loadSoldNumbers();
            renderNumbers();
            updateCheckout();
            setInterval(async () => {
                await loadSoldNumbers();
                renderNumbers();
            }, 10000);
        }
    }

    async function loadRaffle() {
        try {
            const {data, error} = await supabaseClient
                .from('raffles')
                .select('*')
                .eq('active', true)
                .maybeSingle();
            
            if (error) throw error;
            
            if (!data) {
                document.getElementById('loadingMessage').innerHTML = 
                    '<div style="text-align:center;padding:80px 20px;">' +
                    '<div style="font-size:80px;margin-bottom:30px;">🎰</div>' +
                    '<h2 style="font-family:\'Orbitron\',sans-serif;font-size:42px;color:var(--purple);margin-bottom:20px;">No Momento<br>Sem Rifas</h2>' +
                    '<p style="color:rgba(255,255,255,0.7);font-size:18px;">Não há nenhuma rifa ativa no momento.<br>Aguarde novas rifas em breve!</p>' +
                    '</div>';
                return;
            }
            
            currentRaffle = data;
            displayRaffle();
        } catch(error) {
            document.getElementById('loadingMessage').innerHTML = 
                `<div style="text-align:center;padding:60px 20px;">` +
                `<div style="font-size:64px;margin-bottom:20px;color:#ff4444;">⚠️</div>` +
                `<h2 style="font-size:24px;color:#ff4444;">Erro ao Carregar Rifa</h2>` +
                `<p style="color:rgba(255,255,255,0.6);font-size:14px;">${error.message || 'Erro desconhecido'}</p>` +
                `</div>`;
        }
    }

    function displayRaffle() {
        if (!currentRaffle) return;
        
        document.getElementById('raffleImage').src = currentRaffle.image_url;
        document.getElementById('raffleTitle').textContent = currentRaffle.title;
        document.getElementById('raffleDescription').textContent = currentRaffle.description;
        document.getElementById('pricePerNumber').textContent = `R$ ${currentRaffle.price_per_number.toFixed(2)}`;
        document.getElementById('totalNumbersDisplay').textContent = currentRaffle.total_numbers || 100;
        
        if (currentRaffle.promo_enabled) {
            document.getElementById('promoSection').style.display = 'block';
            document.getElementById('promoText').textContent = 
                `${currentRaffle.promo_discount}% OFF comprando ${currentRaffle.promo_min_numbers}+ números!`;
        }
        
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('raffleContent').style.display = 'block';
    }

    async function loadSoldNumbers() {
        if (!currentRaffle || !currentRaffle.id) return;
        
        try {
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
            const {data, error} = await supabaseClient
                .from('raffle_sales')
                .select('numbers, payment_status, created_at')
                .eq('raffle_id', currentRaffle.id)
                .or(`payment_status.eq.approved,and(payment_status.eq.reserved,created_at.gte.${twoMinutesAgo})`);
            
            if (error) throw error;
            
            soldNumbers.clear();
            if (data && data.length > 0) {
                data.forEach(sale => {
                    if (sale.numbers && Array.isArray(sale.numbers)) {
                        sale.numbers.forEach(num => soldNumbers.add(num));
                    }
                });
            }
            
            document.getElementById('soldCount').textContent = soldNumbers.size;
        } catch(error) {
            console.error('Erro ao carregar números vendidos:', error);
        }
    }

    function renderNumbers() {
        const grid = document.getElementById('numbersGrid');
        grid.innerHTML = '';
        const totalNumbers = currentRaffle.total_numbers || 100;
        
        for (let i = 1; i <= totalNumbers; i++) {
            const box = document.createElement('div');
            box.className = 'number-box';
            box.textContent = i;
            box.dataset.number = i;
            
            if (soldNumbers.has(i)) {
                box.classList.add('sold');
            } else {
                box.addEventListener('click', () => toggleNumber(i));
            }
            
            grid.appendChild(box);
        }
    }

    function toggleNumber(number) {
        if (selectedNumbers.has(number)) {
            selectedNumbers.delete(number);
        } else {
            selectedNumbers.add(number);
        }
        updateNumbersDisplay();
        updateCheckout();
    }

    function updateNumbersDisplay() {
        document.querySelectorAll('.number-box').forEach(box => {
            const num = parseInt(box.dataset.number);
            if (selectedNumbers.has(num)) {
                box.classList.add('selected');
            } else {
                box.classList.remove('selected');
            }
        });
    }

    function updateCheckout() {
        if (!currentRaffle) return;
        
        const count = selectedNumbers.size;
        document.getElementById('selectedCount').textContent = count;
        
        let total = count * currentRaffle.price_per_number;
        
        if (currentRaffle.promo_enabled && count >= currentRaffle.promo_min_numbers) {
            total = total * (1 - currentRaffle.promo_discount / 100);
        }
        
        if (currentRaffle.max_per_person && currentRaffle.max_per_person > 0) {
            const limit = currentRaffle.max_per_person;
            const checkoutBtn = document.getElementById('checkoutBtn');
            
            if (count > limit) {
                checkoutBtn.disabled = true;
                checkoutBtn.textContent = `❌ Limite: ${limit} números por pessoa`;
                checkoutBtn.style.background = 'linear-gradient(135deg, #ff4444, #cc0000)';
                return;
            } else if (count > 0) {
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = `Finalizar Compra via PIX (${count}/${limit} cotas)`;
                checkoutBtn.style.background = 'linear-gradient(135deg, var(--purple), #6b1fa0)';
            }
        } else {
            document.getElementById('checkoutBtn').textContent = 'Finalizar Compra via PIX';
            document.getElementById('checkoutBtn').style.background = 'linear-gradient(135deg, var(--purple), #6b1fa0)';
        }
        
        document.getElementById('totalPrice').textContent = `R$ ${total.toFixed(2)}`;
        document.getElementById('checkoutBtn').disabled = count === 0;
    }

    window.initCheckout = async function() {
        if (selectedNumbers.size === 0) return;
        
        const name = prompt('Digite seu nome e sobrenome:');
        if (!name || name.trim() === '') return;
        
        let phone = prompt('Digite seu WhatsApp (com DDD):\nExemplo: 11987654321');
        if (!phone || phone.trim() === '') return;
        
        phone = phone.replace(/\D/g, '');
        
        if (phone.length < 10 || phone.length > 11) {
            alert('Telefone inválido!\n\nDigite o WhatsApp com DDD (10 ou 11 números).\nExemplo: 11987654321');
            return;
        }
        
        const ddd = parseInt(phone.substring(0, 2));
        if (ddd < 11 || ddd > 99) {
            alert('DDD inválido!\n\nDigite um DDD válido (11 a 99).\nExemplo: 11987654321');
            return;
        }
        
        try {
            if (currentRaffle.max_per_person && currentRaffle.max_per_person > 0) {
                const {data: previousSales, error: salesError} = await supabaseClient
                    .from('raffle_sales')
                    .select('numbers')
                    .eq('raffle_id', currentRaffle.id)
                    .eq('buyer_phone', phone)
                    .eq('payment_status', 'approved');
                
                if (salesError) throw salesError;
                
                let totalBought = 0;
                if (previousSales && previousSales.length > 0) {
                    previousSales.forEach(sale => {
                        totalBought += sale.numbers.length;
                    });
                }
                
                const totalAfterPurchase = totalBought + selectedNumbers.size;
                
                if (totalAfterPurchase > currentRaffle.max_per_person) {
                    const remaining = currentRaffle.max_per_person - totalBought;
                    alert(`Limite de cotas por pessoa atingido!\n\n` +
                          `Você já comprou: ${totalBought} cota(s)\n` +
                          `Tentando comprar: ${selectedNumbers.size} cota(s)\n` +
                          `Limite máximo: ${currentRaffle.max_per_person} cota(s)\n\n` +
                          `Você pode comprar no máximo mais ${remaining} cota(s).`);
                    return;
                }
            }
            
            const totalText = document.getElementById('totalPrice').textContent;
            const totalAmount = parseFloat(totalText.replace('R$ ', '').replace(',', '.'));
            const numbersArray = Array.from(selectedNumbers);
            
            const {data: saleData, error: saleError} = await supabaseClient
                .from('raffle_sales')
                .insert({
                    raffle_id: currentRaffle.id,
                    buyer_name: name.trim(),
                    buyer_phone: phone,
                    numbers: numbersArray,
                    total_amount: totalAmount,
                    payment_status: 'reserved',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (saleError) throw saleError;
            
            await generatePixPayment(saleData, totalAmount, numbersArray);
        } catch(error) {
            alert('Erro ao processar compra: ' + (error.message || 'Tente novamente.'));
        }
    };

    async function generatePixPayment(saleData, amount, numbers) {
        try {
            document.getElementById('pixModal').style.display = 'flex';
            document.getElementById('pixModal').classList.add('active');
            document.getElementById('pixLoading').style.display = 'block';
            document.getElementById('pixContent').style.display = 'none';
            
            const paymentData = {
                transaction_amount: amount,
                description: `Rifa ${currentRaffle.title} - Números: ${numbers.join(', ')}`,
                payment_method_id: 'pix',
                payer: {
                    email: CLIENT_EMAIL,
                    first_name: saleData.buyer_name.split(' ')[0],
                    last_name: saleData.buyer_name.split(' ').slice(1).join(' ') || saleData.buyer_name
                },
                notification_url: window.location.origin + '/.netlify/functions/webhook',
                external_reference: saleData.id
            };
            
            const response = await fetch('/.netlify/functions/create-pix', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(paymentData)
            });
            
            const pixData = await response.json();
            
            if (!response.ok || pixData.error) {
                throw new Error(pixData.error || pixData.message || 'Erro ao gerar PIX');
            }
            
            if (pixData.qr_code_base64 && pixData.qr_code) {
                await supabaseClient
                    .from('raffle_sales')
                    .update({payment_id: pixData.id})
                    .eq('id', saleData.id);
                
                displayPixQRCode(pixData.qr_code_base64, pixData.qr_code, pixData.id, saleData.id);
                startPaymentCheck(pixData.id, saleData.id);
            } else {
                throw new Error('QR Code não encontrado na resposta');
            }
        } catch(error) {
            document.getElementById('pixModal').classList.remove('active');
            document.getElementById('pixModal').style.display = 'none';
            alert('Erro ao gerar pagamento PIX.\n\nDetalhes: ' + error.message);
        }
    }

    function displayPixQRCode(qrCodeBase64, pixCodeString, paymentId, saleId) {
        document.getElementById('pixLoading').style.display = 'none';
        document.getElementById('pixContent').style.display = 'block';
        
        const qrContainer = document.getElementById('qrCodeContainer');
        qrContainer.innerHTML = `<img src="data:image/png;base64,${qrCodeBase64}" alt="QR Code PIX" style="max-width:300px;">`;
        
        document.getElementById('pixCode').textContent = pixCodeString;
        window.currentPixCode = pixCodeString;
    }

    window.copyPixCode = function() {
        if (window.currentPixCode) {
            navigator.clipboard.writeText(window.currentPixCode)
                .then(() => alert('Código PIX copiado!'))
                .catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = window.currentPixCode;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    alert('Código PIX copiado!');
                });
        }
    };

    window.closePixModal = function() {
        document.getElementById('pixModal').classList.remove('active');
        document.getElementById('pixModal').style.display = 'none';
        if (window.paymentCheckInterval) {
            clearInterval(window.paymentCheckInterval);
        }
        location.reload();
    };

    async function startPaymentCheck(paymentId, saleId) {
        let attempts = 0;
        const maxAttempts = 60;
        
        window.paymentCheckInterval = setInterval(async () => {
            attempts++;
            
            if (attempts >= maxAttempts) {
                clearInterval(window.paymentCheckInterval);
                alert('Tempo expirado.\n\nSe você já pagou, seus números serão liberados automaticamente em breve.');
                closePixModal();
                return;
            }
            
            try {
                const {data, error} = await supabaseClient
                    .from('raffle_sales')
                    .select('payment_status')
                    .eq('id', saleId)
                    .single();
                
                if (data && data.payment_status === 'approved') {
                    clearInterval(window.paymentCheckInterval);
                    alert('Pagamento confirmado! Seus números foram reservados com sucesso!');
                    closePixModal();
                    location.reload();
                }
            } catch(error) {
                console.error('Erro ao verificar pagamento:', error);
            }
        }, 15000);
    }

    async function hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    window.openAdminPanel = async function() {
        const password = prompt('Digite a senha do administrador:');
        if (!password) return;
        
        const hash = await hashPassword(password);
        if (hash !== ADMIN_PASSWORD_HASH) {
            alert('Senha incorreta!');
            return;
        }
        
        document.getElementById('adminPanel').classList.add('active');
        loadAdminData();
    };

    window.closeAdminPanel = function() {
        document.getElementById('adminPanel').classList.remove('active');
    };

    async function loadAdminData() {
        if (!currentRaffle) {
            document.getElementById('noRaffleWarning').style.display = 'block';
            document.getElementById('btnSaveRaffle').style.display = 'none';
            document.getElementById('btnFinishRaffle').style.display = 'none';
            document.getElementById('btnCreateRaffle').style.display = 'inline-block';
            document.getElementById('salesList').innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.4);">Nenhuma venda ainda</p>';
            return;
        }
        
        document.getElementById('noRaffleWarning').style.display = 'none';
        document.getElementById('btnSaveRaffle').style.display = 'inline-block';
        document.getElementById('btnFinishRaffle').style.display = 'inline-block';
        document.getElementById('btnCreateRaffle').style.display = 'none';
        
        document.getElementById('adminTitle').value = currentRaffle.title || '';
        document.getElementById('adminDescription').value = currentRaffle.description || '';
        document.getElementById('adminImage').value = currentRaffle.image_url || '';
        document.getElementById('adminPrice').value = currentRaffle.price_per_number || '';
        document.getElementById('adminTotalNumbers').value = currentRaffle.total_numbers || 100;
        document.getElementById('adminMaxPerPerson').value = currentRaffle.max_per_person || 0;
        document.getElementById('adminPromoEnabled').checked = currentRaffle.promo_enabled || false;
        document.getElementById('adminPromoDiscount').value = currentRaffle.promo_discount || '';
        document.getElementById('adminPromoMinNumbers').value = currentRaffle.promo_min_numbers || '';
        
        if (currentRaffle.image_url) {
            document.getElementById('previewImg').src = currentRaffle.image_url;
            document.getElementById('imagePreview').style.display = 'block';
        }
        
        togglePromoFields();
        await loadSales();
        updateAdminStats();
    }

    function togglePromoFields() {
        const enabled = document.getElementById('adminPromoEnabled').checked;
        document.getElementById('promoFields').style.display = enabled ? 'block' : 'none';
    }

    document.getElementById('adminPromoEnabled').addEventListener('change', togglePromoFields);

    window.handleImageUpload = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            document.getElementById('adminImage').value = base64;
            document.getElementById('previewImg').src = base64;
            document.getElementById('imagePreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    };

    window.createNewRaffle = async function() {
        try {
            const title = document.getElementById('adminTitle').value;
            const description = document.getElementById('adminDescription').value;
            const imageUrl = document.getElementById('adminImage').value;
            const price = parseFloat(document.getElementById('adminPrice').value);
            
            if (!title || !description || !imageUrl || !price) {
                alert('Preencha todos os campos obrigatórios:\n- Título\n- Descrição\n- Imagem\n- Preço');
                return;
            }
            
            if (price <= 0) {
                alert('O preço deve ser maior que zero!');
                return;
            }
            
            await supabaseClient
                .from('raffles')
                .update({active: false})
                .eq('active', true);
            
            const newRaffle = {
                title: title,
                description: description,
                image_url: imageUrl,
                price_per_number: price,
                total_numbers: parseInt(document.getElementById('adminTotalNumbers').value) || 100,
                max_per_person: parseInt(document.getElementById('adminMaxPerPerson').value) || 0,
                promo_enabled: document.getElementById('adminPromoEnabled').checked,
                promo_discount: parseInt(document.getElementById('adminPromoDiscount').value) || 0,
                promo_min_numbers: parseInt(document.getElementById('adminPromoMinNumbers').value) || 0,
                active: true,
                created_at: new Date().toISOString()
            };
            
            const {data, error} = await supabaseClient
                .from('raffles')
                .insert(newRaffle)
                .select()
                .single();
            
            if (error) throw error;
            
            alert('Nova rifa criada com sucesso!\n\nA página será recarregada.');
            location.reload();
        } catch(error) {
            alert('Erro ao criar rifa: ' + error.message);
        }
    };

    window.saveRaffleConfig = async function() {
        if (!currentRaffle || !currentRaffle.id) {
            alert('Erro: Nenhuma rifa carregada para editar.');
            return;
        }
        
        try {
            const updates = {
                title: document.getElementById('adminTitle').value,
                description: document.getElementById('adminDescription').value,
                image_url: document.getElementById('adminImage').value,
                price_per_number: parseFloat(document.getElementById('adminPrice').value),
                total_numbers: parseInt(document.getElementById('adminTotalNumbers').value) || 100,
                max_per_person: parseInt(document.getElementById('adminMaxPerPerson').value) || 0,
                promo_enabled: document.getElementById('adminPromoEnabled').checked,
                promo_discount: parseInt(document.getElementById('adminPromoDiscount').value) || 0,
                promo_min_numbers: parseInt(document.getElementById('adminPromoMinNumbers').value) || 0
            };
            
            const {error} = await supabaseClient
                .from('raffles')
                .update(updates)
                .eq('id', currentRaffle.id);
            
            if (error) throw error;
            
            alert('Configurações salvas com sucesso!');
            location.reload();
        } catch(error) {
            alert('Erro ao salvar configurações: ' + error.message);
        }
    };

    window.finishRaffle = async function() {
        if (!currentRaffle || !currentRaffle.id) {
            alert('Erro: Nenhuma rifa carregada.');
            return;
        }
        
        if (!confirm('Tem certeza que deseja FINALIZAR esta rifa?\n\nEsta ação irá:\n- Desativar a rifa\n- Não será mais possível vender números\n- Você poderá criar uma nova rifa\n\nConfirmar?')) {
            return;
        }
        
        try {
            const {error} = await supabaseClient
                .from('raffles')
                .update({active: false})
                .eq('id', currentRaffle.id);
            
            if (error) throw error;
            
            alert('Rifa finalizada com sucesso!\n\nAgora você pode criar uma nova rifa no painel admin.');
            location.reload();
        } catch(error) {
            alert('Erro ao finalizar rifa: ' + error.message);
        }
    };

    window.exportSales = async function() {
        try {
            const {data, error} = await supabaseClient
                .from('raffle_sales')
                .select('*')
                .eq('raffle_id', currentRaffle.id)
                .eq('payment_status', 'approved')
                .order('created_at', {ascending: true});
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                alert('Nenhuma venda aprovada para exportar.');
                return;
            }
            
            const numberToName = {};
            data.forEach(sale => {
                const nameParts = sale.buyer_name.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts[1] || '';
                const shortName = lastName ? `${firstName} ${lastName}` : firstName;
                
                sale.numbers.forEach(num => {
                    numberToName[num] = shortName;
                });
            });
            
            const sortedNumbers = Object.keys(numberToName).map(n => parseInt(n)).sort((a, b) => a - b);
            
            let txtContent = `LISTA DE NÚMEROS - ${currentRaffle.title}\n`;
            txtContent += `Data de Exportação: ${new Date().toLocaleString('pt-BR')}\n`;
            txtContent += `Total de Números Vendidos: ${sortedNumbers.length}\n`;
            txtContent += `\n${'='.repeat(80)}\n\n`;
            
            sortedNumbers.forEach(num => {
                txtContent += `${num} - ${numberToName[num]}\n`;
            });
            
            txtContent += `\n${'='.repeat(80)}\n\n`;
            txtContent += `RESUMO DE COMPRADORES:\n\n`;
            
            data.forEach(sale => {
                const nameParts = sale.buyer_name.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts[1] || '';
                const shortName = lastName ? `${firstName} ${lastName}` : firstName;
                
                txtContent += `${shortName}: ${sale.numbers.length} número(s) - ${sale.numbers.sort((a, b) => a - b).join(', ')}\n`;
            });
            
            const blob = new Blob([txtContent], {type: 'text/plain;charset=utf-8'});
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `numeros-rifa-${currentRaffle.title.replace(/\s+/g, '-')}-${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            alert('Lista de números exportada com sucesso!');
        } catch(error) {
            alert('Erro ao exportar vendas: ' + error.message);
        }
    };

    async function loadSales() {
        try {
            const {data, error} = await supabaseClient
                .from('raffle_sales')
                .select('*')
                .eq('raffle_id', currentRaffle.id)
                .order('created_at', {ascending: false});
            
            if (error) throw error;
            
            const salesList = document.getElementById('salesList');
            
            if (data.length === 0) {
                salesList.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.4);">Nenhuma venda ainda</p>';
                return;
            }
            
            salesList.innerHTML = data.map(sale => `
                <div class="sale-item">
                    <div class="sale-header">
                        <span>${sale.buyer_name}</span>
                        <span>${sale.payment_status === 'approved' ? '✅ Pago' : '⏳ Pendente'}</span>
                    </div>
                    <div>📱 ${sale.buyer_phone}</div>
                    <div>💰 R$ ${sale.total_amount.toFixed(2)}</div>
                    <div class="numbers-sold">
                        ${sale.numbers.map(n => `<span class="number-badge">${n}</span>`).join('')}
                    </div>
                    ${sale.payment_status !== 'approved' ? `
                        <div style="display:flex;gap:10px;margin-top:10px;">
                            <button class="btn-approve-manual" onclick="approveSaleManually('${sale.id}')" style="flex:1;">✅ Aprovar</button>
                            <button class="btn-remove-pending" onclick="removePendingSale('${sale.id}')" style="flex:1;">🗑️ Remover</button>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        } catch(error) {
            console.error('Erro ao carregar vendas:', error);
        }
    }

    function updateAdminStats() {
        const approvedSales = Array.from(document.querySelectorAll('.sale-item'))
            .filter(item => item.textContent.includes('✅ Pago'));
        
        const totalSold = approvedSales.reduce((sum, item) => {
            const amount = parseFloat(item.querySelector('div:nth-child(3)').textContent.replace('💰 R$ ', ''));
            return sum + amount;
        }, 0);
        
        document.getElementById('adminTotalSold').textContent = `R$ ${totalSold.toFixed(2)}`;
        document.getElementById('adminNumbersSold').textContent = `${soldNumbers.size}/${currentRaffle.total_numbers || 100}`;
        document.getElementById('adminBuyersCount').textContent = approvedSales.length;
    }

    window.approveSaleManually = async function(saleId) {
        if (!confirm('Aprovar este pagamento manualmente?\n\nOs números serão liberados para o cliente.')) {
            return;
        }
        
        try {
            const {data, error} = await supabaseClient
                .from('raffle_sales')
                .update({payment_status: 'approved'})
                .eq('id', saleId)
                .select();
            
            if (error) throw error;
            
            alert('Pagamento aprovado com sucesso!\n\nOs números foram liberados para o cliente.');
            await loadSoldNumbers();
            await loadSales();
            updateAdminStats();
        } catch(error) {
            alert('Erro ao aprovar: ' + (error.message || 'Tente novamente.'));
        }
    };

    window.removePendingSale = async function(saleId) {
        if (!confirm('Tem certeza que deseja remover esta venda pendente?\n\nOs números serão liberados novamente.')) {
            return;
        }
        
        try {
            const {error} = await supabaseClient
                .from('raffle_sales')
                .delete()
                .eq('id', saleId);
            
            if (error) throw error;
            
            alert('Venda pendente removida com sucesso!\n\nOs números foram liberados.');
            await loadSoldNumbers();
            await loadSales();
            updateAdminStats();
        } catch(error) {
            alert('Erro ao remover venda: ' + (error.message || 'Tente novamente.'));
        }
    };

    window.drawWinner = async function() {
        if (soldNumbers.size === 0) {
            alert('Nenhum número foi vendido ainda!');
            return;
        }
        
        const numbersArray = Array.from(soldNumbers);
        const winnerNumber = numbersArray[Math.floor(Math.random() * numbersArray.length)];
        
        const {data, error} = await supabaseClient
            .from('raffle_sales')
            .select('*')
            .eq('raffle_id', currentRaffle.id)
            .eq('payment_status', 'approved');
        
        if (error) {
            console.error('Erro:', error);
            return;
        }
        
        const winner = data.find(sale => sale.numbers.includes(winnerNumber));
        
        document.getElementById('winnerResult').style.display = 'block';
        document.getElementById('winnerText').innerHTML = 
            `<strong>Número sorteado:</strong> ${winnerNumber}<br>` +
            `<strong>Vencedor:</strong> ${winner.buyer_name}<br>` +
            `<strong>WhatsApp:</strong> ${winner.buyer_phone}`;
    };

    init();
})();
