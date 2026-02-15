(function() {
    const SUPABASE_URL = window.ENV.SUPABASE_URL;
    const SUPABASE_KEY = window.ENV.SUPABASE_KEY;
    const MERCADOPAGO_PUBLIC_KEY = window.ENV.MP_PUBLIC_KEY;
    const CLIENT_EMAIL = 'dproartes@gmail.com';
    const ADMIN_PASSWORD_HASH = window.ENV.ADMIN_HASH;

  let supabaseClient = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

async function init() {
    console.log('🔵 Iniciando... Tentativa', initAttempts + 1);
    
    if (!supabaseClient && !initSupabase()) {
        if (initAttempts < MAX_INIT_ATTEMPTS) {
            initAttempts++;
            console.log('⏳ Aguardando libraries...');
            setTimeout(init, 500);
            return;
        }
        
        console.error('❌ Falha após', MAX_INIT_ATTEMPTS, 'tentativas');
        showError('Erro de Conexão', 'Não foi possível conectar. Recarregue a página.');
        return;
    }
    
    console.log('🔍 Carregando rifa...');
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        await loadRaffleWithAbort(controller.signal);
        clearTimeout(timeoutId);
        
        if (!currentRaffle) {
            console.log('⚠️ Sem rifas');
            return;
        }
        
        console.log('✅ Rifa:', currentRaffle.title);
        console.log('📊 Carregando números...');
        
        loadSoldNumbers().then(() => {
            renderNumbers();
            updateCheckout();
            console.log('✅ Pronto!');
        });
        
        setInterval(async () => {
            try {
                await loadSoldNumbers();
                renderNumbers();
            } catch (error) {
                console.error('⚠️ Erro ao atualizar:', error);
            }
        }, 15000);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('❌ Timeout');
            showError('Conexão Lenta', 'A rifa está demorando. Verifique sua internet.');
        } else {
            console.error('❌ Erro:', error);
            showError('Erro ao Carregar', 'Não foi possível carregar a rifa.');
        }
    }
}

    let currentRaffle = null;
    let selectedNumbers = new Set();
    let soldNumbers = new Set();

    async function init() {
        console.log('🔵 Inicializando rifa...');
        
        if (!supabaseClient) {
            console.error('❌ Supabase não configurado');
            document.getElementById('loadingMessage').innerHTML = 
                '<div style="text-align:center;padding:60px 20px;">' +
                '<div style="font-size:64px;margin-bottom:20px;color:#ff4444;">⚠️</div>' +
                '<h2 style="font-size:24px;color:#ff4444;margin-bottom:15px;">Erro de Conexão</h2>' +
                '<p style="color:rgba(255,255,255,0.7);margin-bottom:20px;">Não foi possível conectar ao servidor.</p>' +
                '<button onclick="location.reload()" style="background: var(--purple); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600;">🔄 Tentar Novamente</button>' +
                '</div>';
            return;
        }
        
        try {
            const loadPromise = loadRaffle();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );
            
            await Promise.race([loadPromise, timeoutPromise]);
            
            console.log('✅ Rifa carregada');
            
            if (currentRaffle) {
                console.log('📊 Carregando números vendidos...');
                await loadSoldNumbers();
                renderNumbers();
                updateCheckout();
                
                setInterval(async () => {
                    try {
                        await loadSoldNumbers();
                        renderNumbers();
                    } catch (error) {
                        console.error('Erro ao atualizar números:', error);
                    }
                }, 10000);
            }
        } catch (error) {
            console.error('❌ Erro ao inicializar:', error);
            
            document.getElementById('loadingMessage').innerHTML = 
                '<div style="text-align:center;padding:60px 20px;">' +
                '<div style="font-size:64px;margin-bottom:20px;color:#ff4444;">⚠️</div>' +
                '<h2 style="font-size:24px;color:#ff4444;margin-bottom:15px;">Erro ao Carregar</h2>' +
                '<p style="color:rgba(255,255,255,0.7);margin-bottom:10px;">Não foi possível carregar a rifa.</p>' +
                '<p style="color:rgba(255,255,255,0.5);font-size:14px;margin-bottom:20px;">Verifique sua conexão com a internet.</p>' +
                '<button onclick="location.reload()" style="background: var(--purple); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600;">🔄 Tentar Novamente</button>' +
                '</div>';
        }
    }

    async function loadRaffle() {
        console.log('🔍 Buscando rifa ativa...');
        
        try {
            const {data, error} = await supabaseClient
                .from('raffles')
                .select('*')
                .eq('active', true)
                .maybeSingle();
            
            if (error) {
                console.error('❌ Erro do Supabase:', error);
                throw error;
            }
            
            if (!data) {
                console.log('⚠️ Nenhuma rifa ativa');
                document.getElementById('loadingMessage').innerHTML = 
                    '<div style="text-align:center;padding:80px 20px;">' +
                    '<div style="font-size:80px;margin-bottom:30px;">🎰</div>' +
                    '<h2 style="font-family:\'Orbitron\',sans-serif;font-size:42px;color:var(--purple);margin-bottom:20px;">No Momento<br>Sem Rifas</h2>' +
                    '<p style="color:rgba(255,255,255,0.7);font-size:18px;margin-bottom:25px;">Não há nenhuma rifa ativa no momento.<br>Aguarde novas rifas em breve!</p>' +
                    '<a href="rifas-menu.html" style="display:inline-block;background:var(--purple);color:white;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:600;">← Voltar ao Menu</a>' +
                    '</div>';
                return;
            }
            
            console.log('✅ Rifa encontrada:', data.title);
            currentRaffle = data;
            displayRaffle();
            
        } catch(error) {
            console.error('❌ Erro ao carregar rifa:', error);
            document.getElementById('loadingMessage').innerHTML = 
                `<div style="text-align:center;padding:60px 20px;">` +
                `<div style="font-size:64px;margin-bottom:20px;color:#ff4444;">⚠️</div>` +
                `<h2 style="font-size:24px;color:#ff4444;margin-bottom:15px;">Erro ao Carregar Rifa</h2>` +
                `<p style="color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:20px;">${error.message || 'Erro desconhecido'}</p>` +
                `<button onclick="location.reload()" style="background: var(--purple); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600;">🔄 Tentar Novamente</button>` +
                `</div>`;
            throw error;
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
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            const {data, error} = await supabaseClient
                .from('raffle_sales')
                .select('numbers, payment_status, created_at')
                .eq('raffle_id', currentRaffle.id)
                .or(`payment_status.eq.approved,and(payment_status.eq.reserved,created_at.gte.${fifteenMinutesAgo})`);
            
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
        if (!currentRaffle) return;
        
        const grid = document.getElementById('numbersGrid');
        grid.innerHTML = '';
        
        for (let i = 1; i <= currentRaffle.total_numbers; i++) {
            const box = document.createElement('div');
            box.className = 'number-box';
            box.dataset.number = i;
            box.textContent = String(i).padStart(2, '0');
            
            if (soldNumbers.has(i)) {
                box.classList.add('sold');
            } else if (selectedNumbers.has(i)) {
                box.classList.add('selected');
            } else {
                box.onclick = () => toggleNumber(i);
            }
            
            grid.appendChild(box);
        }
    }

    function toggleNumber(number) {
        if (soldNumbers.has(number)) return;
        
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
        
        document.getElementById('dadosModal').style.display = 'flex';
        document.getElementById('dadosModal').classList.add('active');
        
        document.getElementById('inputNome').value = '';
        document.getElementById('inputTelefone').value = '';
        
        setTimeout(() => {
            document.getElementById('inputNome').focus();
        }, 300);
    };

    window.closeDadosModal = function() {
        document.getElementById('dadosModal').classList.remove('active');
        document.getElementById('dadosModal').style.display = 'none';
    };

    window.processarCompra = async function() {
        const nome = document.getElementById('inputNome').value.trim();
        const telefone = document.getElementById('inputTelefone').value.trim();
        
        if (!nome || nome.split(' ').length < 2) {
            alert('❌ Por favor, digite seu nome e sobrenome completos');
            document.getElementById('inputNome').focus();
            return;
        }
        
        if (!telefone || telefone.length < 10) {
            alert('❌ Por favor, digite um telefone válido com DDD\nExemplo: 11987654321');
            document.getElementById('inputTelefone').focus();
            return;
        }
        
        const phone = telefone.replace(/\D/g, '');
        if (phone.length < 10 || phone.length > 11) {
            alert('❌ Telefone inválido! Digite apenas números com DDD\nExemplo: 11987654321');
            return;
        }
        
        closeDadosModal();
        
        document.getElementById('loadingModal').style.display = 'flex';
        document.getElementById('loadingModal').classList.add('active');
        
        try {
            const numbersArray = Array.from(selectedNumbers);
            
            console.log('🔍 Verificando disponibilidade dos números...');
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            const {data: checkSales, error: checkError} = await supabaseClient
                .from('raffle_sales')
                .select('numbers')
                .eq('raffle_id', currentRaffle.id)
                .or(`payment_status.eq.approved,and(payment_status.eq.reserved,created_at.gte.${fifteenMinutesAgo})`);
            
            if (checkError) throw checkError;
            
            const numerosJaReservados = new Set();
            if (checkSales) {
                checkSales.forEach(sale => {
                    if (sale.numbers && Array.isArray(sale.numbers)) {
                        sale.numbers.forEach(num => numerosJaReservados.add(num));
                    }
                });
            }
            
            const conflitos = numbersArray.filter(num => numerosJaReservados.has(num));
            
            if (conflitos.length > 0) {
                document.getElementById('loadingModal').classList.remove('active');
                document.getElementById('loadingModal').style.display = 'none';
                
                alert(`❌ NÚMEROS JÁ RESERVADOS!\n\nOs seguintes números foram reservados:\n\n${conflitos.join(', ')}\n\nPor favor, escolha outros números.`);
                
                await loadSoldNumbers();
                renderNumbers();
                return;
            }
            
            console.log('✅ Números disponíveis! Prosseguindo...');
            
            const totalText = document.getElementById('totalPrice').textContent;
            const totalAmount = parseFloat(totalText.replace('R$ ', '').replace(',', '.'));
            
            const reserveResponse = await fetch('/.netlify/functions/reserve-numbers', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    raffle_id: currentRaffle.id,
                    buyer_name: nome,
                    buyer_phone: phone,
                    numbers: numbersArray,
                    total_amount: totalAmount
                })
            });

            const reserveData = await reserveResponse.json();

            if (!reserveResponse.ok) {
                if (reserveResponse.status === 409) {
                    document.getElementById('loadingModal').classList.remove('active');
                    document.getElementById('loadingModal').style.display = 'none';
                    
                    alert(`❌ Números já reservados!\n\nNúmeros: ${reserveData.conflicting_numbers.join(', ')}\n\nEscolha outros números.`);
                          
                    await loadSoldNumbers();
                    renderNumbers();
                    return;
                }
                throw new Error(reserveData.error || 'Erro ao reservar');
            }

            const saleData = reserveData.sale;
            
            document.getElementById('loadingModal').classList.remove('active');
            document.getElementById('loadingModal').style.display = 'none';
            
            await generatePixPayment(saleData, totalAmount, numbersArray);
            
        } catch (error) {
            document.getElementById('loadingModal').classList.remove('active');
            document.getElementById('loadingModal').style.display = 'none';
            
            console.error('Erro:', error);
            alert('❌ Erro: ' + error.message);
        }
    };

    async function generatePixPayment(saleData, totalAmount, numbersArray) {
        try {
            document.getElementById('pixModal').style.display = 'flex';
            document.getElementById('pixModal').classList.add('active');
            document.getElementById('pixLoading').style.display = 'block';
            document.getElementById('pixContent').style.display = 'none';

            const createPixResponse = await fetch('/.netlify/functions/create-pix', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    sale_id: saleData.id,
                    amount: totalAmount,
                    buyer_email: CLIENT_EMAIL,
                    buyer_name: saleData.buyer_name
                })
            });

            if (!createPixResponse.ok) {
                const errorData = await createPixResponse.json();
                throw new Error(errorData.error || 'Erro ao gerar PIX');
            }

            const pixData = await createPixResponse.json();

            document.getElementById('pixLoading').style.display = 'none';
            document.getElementById('pixContent').style.display = 'block';

            const qrContainer = document.getElementById('qrCodeContainer');
            qrContainer.innerHTML = `<img src="data:image/png;base64,${pixData.qr_code_base64}" style="width: 250px; height: 250px;">`;
            
            document.getElementById('pixCode').textContent = pixData.qr_code;

            window.currentPixCode = pixData.qr_code;
            window.currentPaymentId = pixData.payment_id;

            startPaymentCheck(saleData.id, numbersArray);

        } catch (error) {
            console.error('Erro ao gerar PIX:', error);
            alert('❌ Erro ao gerar pagamento PIX: ' + error.message);
            document.getElementById('pixModal').classList.remove('active');
            document.getElementById('pixModal').style.display = 'none';
        }
    }

    window.copyPixCode = function() {
        if (!window.currentPixCode) return;
        
        navigator.clipboard.writeText(window.currentPixCode).then(() => {
            alert('✅ Código PIX copiado!');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = window.currentPixCode;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('✅ Código PIX copiado!');
        });
    };

    function startPaymentCheck(saleId, numbersArray) {
        let attempts = 0;
        const maxAttempts = 60;

        const checkInterval = setInterval(async () => {
            attempts++;

            if (attempts > maxAttempts) {
                clearInterval(checkInterval);
                return;
            }

            try {
                const {data: sale, error} = await supabaseClient
                    .from('raffle_sales')
                    .select('payment_status')
                    .eq('id', saleId)
                    .single();

                if (error) throw error;

                if (sale.payment_status === 'approved') {
                    clearInterval(checkInterval);
                    
                    document.getElementById('pixModal').classList.remove('active');
                    document.getElementById('pixModal').style.display = 'none';
                    
                    showConfirmationModal(numbersArray);
                    
                    selectedNumbers.clear();
                    await loadSoldNumbers();
                    renderNumbers();
                    updateCheckout();
                }
            } catch (error) {
                console.error('Erro ao verificar pagamento:', error);
            }
        }, 15000);
    }

    function showConfirmationModal(numbersArray) {
        const modal = document.getElementById('confirmationModal');
        const numbersContainer = document.getElementById('confirmationNumbers');
        
        numbersContainer.innerHTML = '';
        numbersArray.forEach(num => {
            const numberBox = document.createElement('div');
            numberBox.style.cssText = `
                background: linear-gradient(135deg, var(--purple), #6b1fa0);
                border: 3px solid #00ff88;
                border-radius: 12px;
                padding: 15px 20px;
                font-size: 32px;
                font-weight: 700;
                color: white;
                box-shadow: 0 5px 20px rgba(148, 49, 206, 0.5);
            `;
            numberBox.textContent = String(num).padStart(2, '0');
            numbersContainer.appendChild(numberBox);
        });
        
        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    window.closeConfirmationModal = function() {
        document.getElementById('confirmationModal').classList.remove('active');
        document.getElementById('confirmationModal').style.display = 'none';
        window.location.reload();
    };

    window.closePixModal = function(keepReserved = false) {
        document.getElementById('pixModal').classList.remove('active');
        document.getElementById('pixModal').style.display = 'none';
        
        if (!keepReserved) {
            selectedNumbers.clear();
            renderNumbers();
            updateCheckout();
        }
    };

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
            alert('❌ Senha incorreta');
            return;
        }

        document.getElementById('adminPanel').classList.add('active');
        await loadAdminData();
    };

    window.closeAdminPanel = function() {
        document.getElementById('adminPanel').classList.remove('active');
    };

    async function loadAdminData() {
        if (!currentRaffle) {
            document.getElementById('noRaffleWarning').style.display = 'block';
            document.getElementById('btnSaveRaffle').style.display = 'none';
            document.getElementById('btnCreateRaffle').style.display = 'inline-block';
            document.getElementById('btnFinishRaffle').style.display = 'none';
            return;
        }

        document.getElementById('noRaffleWarning').style.display = 'none';
        document.getElementById('btnSaveRaffle').style.display = 'inline-block';
        document.getElementById('btnCreateRaffle').style.display = 'none';
        document.getElementById('btnFinishRaffle').style.display = 'inline-block';

        document.getElementById('adminTitle').value = currentRaffle.title || '';
        document.getElementById('adminDescription').value = currentRaffle.description || '';
        document.getElementById('adminImage').value = currentRaffle.image_url || '';
        document.getElementById('adminPrice').value = currentRaffle.price_per_number || '';
        document.getElementById('adminTotalNumbers').value = currentRaffle.total_numbers || 100;
        document.getElementById('adminMaxPerPerson').value = currentRaffle.max_per_person || 0;
        document.getElementById('adminPromoEnabled').checked = currentRaffle.promo_enabled || false;
        document.getElementById('adminPromoDiscount').value = currentRaffle.promo_discount || '';
        document.getElementById('adminPromoMinNumbers').value = currentRaffle.promo_min_numbers || '';

        togglePromoFields();
        await loadSalesData();
        await loadPendingSales();
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

    window.saveRaffleConfig = async function() {
        if (!currentRaffle) return;

        try {
            const title = document.getElementById('adminTitle').value;
            const description = document.getElementById('adminDescription').value;
            const imageUrl = document.getElementById('adminImage').value;
            const price = parseFloat(document.getElementById('adminPrice').value);
            const totalNumbers = parseInt(document.getElementById('adminTotalNumbers').value);
            const maxPerPerson = parseInt(document.getElementById('adminMaxPerPerson').value) || 0;
            const promoEnabled = document.getElementById('adminPromoEnabled').checked;
            const promoDiscount = parseFloat(document.getElementById('adminPromoDiscount').value) || 0;
            const promoMinNumbers = parseInt(document.getElementById('adminPromoMinNumbers').value) || 0;

            if (!title || !imageUrl || !price || !totalNumbers) {
                alert('❌ Preencha todos os campos obrigatórios!');
                return;
            }

            const {error} = await supabaseClient
                .from('raffles')
                .update({
                    title,
                    description,
                    image_url: imageUrl,
                    price_per_number: price,
                    total_numbers: totalNumbers,
                    max_per_person: maxPerPerson,
                    promo_enabled: promoEnabled,
                    promo_discount: promoDiscount,
                    promo_min_numbers: promoMinNumbers
                })
                .eq('id', currentRaffle.id);

            if (error) throw error;

            alert('✅ Configurações salvas!');
            await loadRaffle();
            await loadSoldNumbers();
            renderNumbers();

        } catch (error) {
            console.error('Erro:', error);
            alert('❌ Erro ao salvar: ' + error.message);
        }
    };

    window.createNewRaffle = async function() {
        try {
            const title = document.getElementById('adminTitle').value;
            const description = document.getElementById('adminDescription').value;
            const imageUrl = document.getElementById('adminImage').value;
            const price = parseFloat(document.getElementById('adminPrice').value);
            const totalNumbers = parseInt(document.getElementById('adminTotalNumbers').value);
            const maxPerPerson = parseInt(document.getElementById('adminMaxPerPerson').value) || 0;
            const promoEnabled = document.getElementById('adminPromoEnabled').checked;
            const promoDiscount = parseFloat(document.getElementById('adminPromoDiscount').value) || 0;
            const promoMinNumbers = parseInt(document.getElementById('adminPromoMinNumbers').value) || 0;

            if (!title || !imageUrl || !price || !totalNumbers) {
                alert('❌ Preencha todos os campos obrigatórios!');
                return;
            }

            const {error} = await supabaseClient
                .from('raffles')
                .insert({
                    title,
                    description,
                    image_url: imageUrl,
                    price_per_number: price,
                    total_numbers: totalNumbers,
                    max_per_person: maxPerPerson,
                    promo_enabled: promoEnabled,
                    promo_discount: promoDiscount,
                    promo_min_numbers: promoMinNumbers,
                    active: true
                });

            if (error) throw error;

            alert('✅ Rifa criada com sucesso!');
            window.location.reload();

        } catch (error) {
            console.error('Erro:', error);
            alert('❌ Erro ao criar rifa: ' + error.message);
        }
    };

    window.finishRaffle = async function() {
        if (!currentRaffle) return;

        if (!confirm('⚠️ Tem certeza que deseja finalizar esta rifa?\n\nEla será desativada e uma nova rifa poderá ser criada.')) {
            return;
        }

        try {
            const {error} = await supabaseClient
                .from('raffles')
                .update({ active: false })
                .eq('id', currentRaffle.id);

            if (error) throw error;

            alert('✅ Rifa finalizada!');
            window.location.reload();

        } catch (error) {
            console.error('Erro:', error);
            alert('❌ Erro ao finalizar: ' + error.message);
        }
    };

    async function loadSalesData() {
        if (!currentRaffle) return;

        try {
            const {data: sales, error} = await supabaseClient
                .from('raffle_sales')
                .select('*')
                .eq('raffle_id', currentRaffle.id)
                .eq('payment_status', 'approved')
                .order('created_at', {ascending: false});

            if (error) throw error;

            let totalSold = 0;
            let numbersSold = 0;
            const uniqueBuyers = new Set();

            if (sales && sales.length > 0) {
                sales.forEach(sale => {
                    totalSold += parseFloat(sale.total_amount || 0);
                    numbersSold += (sale.numbers ? sale.numbers.length : 0);
                    uniqueBuyers.add(sale.buyer_phone);
                });

                document.getElementById('adminTotalSold').textContent = `R$ ${totalSold.toFixed(2)}`;
                document.getElementById('adminNumbersSold').textContent = `${numbersSold}/${currentRaffle.total_numbers}`;
                document.getElementById('adminBuyersCount').textContent = uniqueBuyers.size;

                const salesList = document.getElementById('salesList');
                salesList.innerHTML = '';

                sales.forEach(sale => {
                    const saleItem = document.createElement('div');
                    saleItem.style.cssText = 'background: rgba(0,255,136,0.05); border: 2px solid rgba(0,255,136,0.3); border-radius: 10px; padding: 15px; margin-bottom: 10px;';

                    saleItem.innerHTML = `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <strong style="font-size: 16px;">${sale.buyer_name}</strong>
                            <span style="color: #00ff88; font-weight: 600;">✅ Aprovado</span>
                        </div>
                        <div style="font-size: 14px; color: rgba(255,255,255,0.7);">
                            📱 ${sale.buyer_phone}<br>
                            🎫 Números: ${sale.numbers ? sale.numbers.join(', ') : 'N/A'}<br>
                            💰 R$ ${(sale.total_amount || 0).toFixed(2)}<br>
                            📅 ${new Date(sale.created_at).toLocaleString('pt-BR')}
                        </div>
                    `;

                    salesList.appendChild(saleItem);
                });
            } else {
                document.getElementById('adminTotalSold').textContent = 'R$ 0,00';
                document.getElementById('adminNumbersSold').textContent = `0/${currentRaffle.total_numbers}`;
                document.getElementById('adminBuyersCount').textContent = '0';
                document.getElementById('salesList').innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.4);">Nenhuma venda aprovada ainda</p>';
            }

        } catch (error) {
            console.error('Erro ao carregar vendas:', error);
        }
    }

    window.exportSales = async function() {
        if (!currentRaffle) return;

        try {
            const {data: sales, error} = await supabaseClient
                .from('raffle_sales')
                .select('*')
                .eq('raffle_id', currentRaffle.id)
                .eq('payment_status', 'approved')
                .order('created_at', {ascending: false});

            if (error) throw error;

            if (!sales || sales.length === 0) {
                alert('Nenhuma venda aprovada para exportar');
                return;
            }

            let csv = 'Nome,Telefone,Números,Valor,Data\n';
            sales.forEach(sale => {
                const numbers = sale.numbers ? sale.numbers.join(' ') : '';
                const date = new Date(sale.created_at).toLocaleString('pt-BR');
                csv += `"${sale.buyer_name}","${sale.buyer_phone}","${numbers}","R$ ${(sale.total_amount || 0).toFixed(2)}","${date}"\n`;
            });

            const blob = new Blob([csv], {type: 'text/csv'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vendas_${currentRaffle.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;
            a.click();

        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao exportar: ' + error.message);
        }
    };

    window.drawWinner = async function() {
        if (!currentRaffle) return;

        try {
            const {data: sales, error} = await supabaseClient
                .from('raffle_sales')
                .select('*')
                .eq('raffle_id', currentRaffle.id)
                .eq('payment_status', 'approved');

            if (error) throw error;

            if (!sales || sales.length === 0) {
                alert('Nenhuma venda aprovada ainda!');
                return;
            }

            const allNumbers = [];
            sales.forEach(sale => {
                if (sale.numbers && Array.isArray(sale.numbers)) {
                    sale.numbers.forEach(num => {
                        allNumbers.push({number: num, buyer: sale.buyer_name, phone: sale.buyer_phone});
                    });
                }
            });

            if (allNumbers.length === 0) {
                alert('Nenhum número vendido!');
                return;
            }

            const winnerIndex = Math.floor(Math.random() * allNumbers.length);
            const winner = allNumbers[winnerIndex];

            document.getElementById('winnerText').innerHTML = `
                <strong>Número sorteado: ${winner.number}</strong><br>
                <strong>Ganhador: ${winner.buyer}</strong><br>
                Telefone: ${winner.phone}
            `;
            document.getElementById('winnerResult').style.display = 'block';

        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao sortear: ' + error.message);
        }
    };

    window.verificarDuplicados = async function() {
        const btn = document.getElementById('btnVerificar');
        const result = document.getElementById('duplicadosResult');
        
        if (!currentRaffle) {
            result.innerHTML = '<p style="color: #ff4444;">❌ Nenhuma rifa ativa</p>';
            return;
        }
        
        btn.disabled = true;
        btn.textContent = '⏳ Verificando...';
        result.innerHTML = '<p>Carregando...</p>';
        
        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            
            const {data: sales, error} = await supabaseClient
                .from('raffle_sales')
                .select('id, buyer_name, buyer_phone, numbers, payment_status, created_at')
                .eq('raffle_id', currentRaffle.id)
                .or(`payment_status.eq.approved,and(payment_status.eq.reserved,created_at.gte.${fifteenMinutesAgo})`)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            
            if (!sales || sales.length === 0) {
                result.innerHTML = '<p style="color: #00ff88;">✅ Nenhuma venda encontrada</p>';
                btn.disabled = false;
                btn.textContent = '🔍 Verificar Números Duplicados';
                return;
            }
            
            const numerosPorVenda = new Map();
            const todosNumeros = [];
            
            sales.forEach(sale => {
                if (sale.numbers && Array.isArray(sale.numbers)) {
                    numerosPorVenda.set(sale.id, { ...sale, numeros: sale.numbers });
                    sale.numbers.forEach(num => {
                        todosNumeros.push({ numero: num, saleId: sale.id });
                    });
                }
            });
            
            const contagem = {};
            todosNumeros.forEach(item => {
                if (!contagem[item.numero]) contagem[item.numero] = [];
                contagem[item.numero].push(item.saleId);
            });
            
            const duplicados = {};
            Object.keys(contagem).forEach(numero => {
                if (contagem[numero].length > 1) duplicados[numero] = contagem[numero];
            });
            
            if (Object.keys(duplicados).length === 0) {
                result.innerHTML = '<p style="color: #00ff88; font-size: 18px; font-weight: 600;">✅ NENHUM NÚMERO DUPLICADO!</p><p style="color: rgba(255,255,255,0.6); margin-top: 10px;">Todas as vendas estão corretas.</p>';
                btn.disabled = false;
                btn.textContent = '🔍 Verificar Números Duplicados';
                return;
            }
            
            let html = '<div style="background: rgba(255,68,68,0.1); border: 2px solid #ff4444; border-radius: 10px; padding: 20px; margin-bottom: 20px;">';
            html += '<h3 style="color: #ff4444; margin-bottom: 15px;">⚠️ NÚMEROS DUPLICADOS ENCONTRADOS!</h3>';
            
            Object.keys(duplicados).forEach(numero => {
                const saleIds = duplicados[numero];
                html += `<div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; margin-bottom: 10px;">`;
                html += `<strong style="color: #ff4444;">Número ${numero}</strong> aparece em ${saleIds.length} vendas:<br>`;
                
                saleIds.forEach((saleId, index) => {
                    const venda = numerosPorVenda.get(saleId);
                    const data = new Date(venda.created_at).toLocaleString('pt-BR');
                    html += `<span style="font-size: 13px; color: rgba(255,255,255,0.7);">
                        ${index + 1}. ${venda.buyer_name} (${venda.buyer_phone}) - ${data} - ${venda.payment_status}
                    </span><br>`;
                });
                
                html += `</div>`;
            });
            
            html += '</div>';
            html += `<button class="btn-primary" onclick="realocarNumerosDuplicados()" style="background: linear-gradient(135deg, #00ff88, #00dd77); color: black; font-size: 18px; padding: 15px 30px;">🔄 REALOCAR NÚMEROS DUPLICADOS AUTOMATICAMENTE</button>`;
            html += `<p style="margin-top: 15px; font-size: 13px; color: rgba(255,255,255,0.5);">⚠️ A realocação manterá a PRIMEIRA compra de cada número (mais antiga) e realocará as compras posteriores para números disponíveis.</p>`;
            
            result.innerHTML = html;
            btn.disabled = false;
            btn.textContent = '🔍 Verificar Números Duplicados';
            
        } catch (error) {
            console.error('Erro ao verificar duplicados:', error);
            result.innerHTML = `<p style="color: #ff4444;">❌ Erro: ${error.message}</p>`;
            btn.disabled = false;
            btn.textContent = '🔍 Verificar Números Duplicados';
        }
    };

    window.realocarNumerosDuplicados = async function() {
        if (!confirm('⚠️ ATENÇÃO!\n\nEsta ação vai REALOCAR números duplicados automaticamente.\n\nA primeira compra de cada número será mantida.\nAs compras posteriores receberão novos números disponíveis.\n\nDeseja continuar?')) {
            return;
        }
        
        const result = document.getElementById('duplicadosResult');
        result.innerHTML = '<p style="color: #ffa500;">⏳ Realocando números... Aguarde...</p>';
        
        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            
            const {data: sales, error: salesError} = await supabaseClient
                .from('raffle_sales')
                .select('id, buyer_name, numbers, payment_status, created_at')
                .eq('raffle_id', currentRaffle.id)
                .or(`payment_status.eq.approved,and(payment_status.eq.reserved,created_at.gte.${fifteenMinutesAgo})`)
                .order('created_at', { ascending: true });
            
            if (salesError) throw salesError;
            
            const numerosAlocados = new Set();
            const vendasParaAtualizar = [];
            
            sales.forEach(sale => {
                const numerosNovos = [];
                const numerosDuplicados = [];
                
                if (sale.numbers && Array.isArray(sale.numbers)) {
                    sale.numbers.forEach(num => {
                        if (numerosAlocados.has(num)) {
                            numerosDuplicados.push(num);
                        } else {
                            numerosAlocados.add(num);
                            numerosNovos.push(num);
                        }
                    });
                }
                
                if (numerosDuplicados.length > 0) {
                    vendasParaAtualizar.push({
                        id: sale.id,
                        buyer_name: sale.buyer_name,
                        numerosOriginais: sale.numbers,
                        numerosManter: numerosNovos,
                        numerosRealocar: numerosDuplicados.length
                    });
                }
            });
            
            if (vendasParaAtualizar.length === 0) {
                result.innerHTML = '<p style="color: #00ff88;">✅ Nenhuma realocação necessária!</p>';
                return;
            }
            
            const todosNumeros = Array.from({length: currentRaffle.total_numbers}, (_, i) => i + 1);
            const numerosDisponiveis = todosNumeros.filter(n => !numerosAlocados.has(n));
            
            if (numerosDisponiveis.length < vendasParaAtualizar.reduce((sum, v) => sum + v.numerosRealocar, 0)) {
                result.innerHTML = '<p style="color: #ff4444;">❌ ERRO: Não há números disponíveis suficientes para realocar!</p>';
                return;
            }
            
            let indiceDisponivel = 0;
            const atualizacoes = [];
            
            for (const venda of vendasParaAtualizar) {
                const novosNumeros = [...venda.numerosManter];
                
                for (let i = 0; i < venda.numerosRealocar; i++) {
                    const novoNum = numerosDisponiveis[indiceDisponivel++];
                    novosNumeros.push(novoNum);
                    numerosAlocados.add(novoNum);
                }
                
                const {error: updateError} = await supabaseClient
                    .from('raffle_sales')
                    .update({ numbers: novosNumeros.sort((a, b) => a - b) })
                    .eq('id', venda.id);
                
                if (updateError) throw updateError;
                
                atualizacoes.push({
                    buyer: venda.buyer_name,
                    original: venda.numerosOriginais.join(', '),
                    novo: novosNumeros.sort((a, b) => a - b).join(', ')
                });
            }
            
            let html = '<div style="background: rgba(0,255,136,0.1); border: 2px solid #00ff88; border-radius: 10px; padding: 20px;">';
            html += `<h3 style="color: #00ff88; margin-bottom: 15px;">✅ REALOCAÇÃO CONCLUÍDA!</h3>`;
            html += `<p style="margin-bottom: 15px;">${atualizacoes.length} vendas foram atualizadas:</p>`;
            
            atualizacoes.forEach((atualizacao, index) => {
                html += `<div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; margin-bottom: 8px; font-size: 13px;">`;
                html += `<strong>${index + 1}. ${atualizacao.buyer}</strong><br>`;
                html += `<span style="color: #ff4444;">Antes: ${atualizacao.original}</span><br>`;
                html += `<span style="color: #00ff88;">Depois: ${atualizacao.novo}</span>`;
                html += `</div>`;
            });
            
            html += '<p style="margin-top: 15px; color: rgba(255,255,255,0.7);">✅ Os números foram atualizados no banco de dados!</p>';
            html += '</div>';
            
            result.innerHTML = html;
            
            await loadSoldNumbers();
            renderNumbers();
            
        } catch (error) {
            console.error('Erro ao realocar:', error);
            result.innerHTML = `<p style="color: #ff4444;">❌ Erro ao realocar: ${error.message}</p>`;
        }
    };

    async function loadPendingSales() {
        if (!currentRaffle) return;

        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            
            const {data: pendingSales, error} = await supabaseClient
                .from('raffle_sales')
                .select('*')
                .eq('raffle_id', currentRaffle.id)
                .eq('payment_status', 'reserved')
                .gte('created_at', fifteenMinutesAgo)
                .order('created_at', {ascending: false});

            if (error) throw error;

            const container = document.getElementById('pendingSalesList');

            if (!pendingSales || pendingSales.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.4);">Nenhuma venda pendente</p>';
                return;
            }

            container.innerHTML = '';

            pendingSales.forEach(sale => {
                const createdDate = new Date(sale.created_at);
                const now = new Date();
                const diffMinutes = Math.floor((now - createdDate) / 1000 / 60);
                const remainingMinutes = 15 - diffMinutes;

                const saleItem = document.createElement('div');
                saleItem.style.cssText = 'background: rgba(255,165,0,0.1); border: 2px solid rgba(255,165,0,0.5); border-radius: 10px; padding: 15px; margin-bottom: 10px;';

                const statusColor = remainingMinutes > 10 ? '#00ff88' : remainingMinutes > 5 ? '#ffa500' : '#ff4444';

                saleItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div>
                            <strong style="font-size: 16px;">${sale.buyer_name}</strong><br>
                            <span style="font-size: 14px; color: rgba(255,255,255,0.7);">📱 ${sale.buyer_phone}</span>
                        </div>
                        <div style="text-align: right;">
                            <div style="color: ${statusColor}; font-weight: 600; font-size: 14px;">
                                ⏱️ ${remainingMinutes > 0 ? `${remainingMinutes} min restantes` : 'EXPIRADO'}
                            </div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 3px;">
                                ${createdDate.toLocaleString('pt-BR')}
                            </div>
                        </div>
                    </div>
                    <div style="margin-bottom: 12px; font-size: 14px; color: rgba(255,255,255,0.7);">
                        🎫 Números: <strong style="color: white;">${sale.numbers ? sale.numbers.join(', ') : 'N/A'}</strong><br>
                        💰 Valor: <strong style="color: #00ff88;">R$ ${(sale.total_amount || 0).toFixed(2)}</strong>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="approveManually('${sale.id}')" style="flex: 1; background: linear-gradient(135deg, #00ff88, #00dd77); color: black; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px;">
                            ✅ Aprovar Manualmente
                        </button>
                        <button onclick="cancelSale('${sale.id}')" style="flex: 1; background: linear-gradient(135deg, #ff4444, #cc0000); color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px;">
                            ❌ Cancelar Venda
                        </button>
                    </div>
                `;

                container.appendChild(saleItem);
            });

        } catch (error) {
            console.error('Erro ao carregar vendas pendentes:', error);
        }
    }

    window.approveManually = async function(saleId) {
        if (!confirm('Tem certeza que deseja aprovar esta venda MANUALMENTE? Esta ação confirma o pagamento e libera os números.')) {
            return;
        }

        try {
            const {error} = await supabaseClient
                .from('raffle_sales')
                .update({ payment_status: 'approved' })
                .eq('id', saleId);

            if (error) throw error;

            alert('✅ Venda aprovada com sucesso!');
            await loadSalesData();
            await loadPendingSales();
            await loadSoldNumbers();
            renderNumbers();

        } catch (error) {
            console.error('Erro ao aprovar:', error);
            alert('❌ Erro ao aprovar venda: ' + error.message);
        }
    };

    window.cancelSale = async function(saleId) {
        if (!confirm('Tem certeza que deseja CANCELAR esta venda? Os números voltarão a ficar disponíveis.')) {
            return;
        }

        try {
            const {error} = await supabaseClient
                .from('raffle_sales')
                .update({ payment_status: 'cancelled' })
                .eq('id', saleId);

            if (error) throw error;

            alert('✅ Venda cancelada!');
            await loadSalesData();
            await loadPendingSales();
            await loadSoldNumbers();
            renderNumbers();

        } catch (error) {
            console.error('Erro ao cancelar:', error);
            alert('❌ Erro ao cancelar venda: ' + error.message);
        }
    };

    const inputNome = document.getElementById('inputNome');
    const inputTelefone = document.getElementById('inputTelefone');

    if (inputNome) {
        inputNome.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                inputTelefone.focus();
            }
        });
    }

    if (inputTelefone) {
        inputTelefone.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                processarCompra();
            }
        });
    }

    init();
})();
