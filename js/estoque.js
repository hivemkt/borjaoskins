const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_KEY = window.ENV.SUPABASE_KEY;
const ADMIN_PASSWORD_HASH = window.ENV.ADMIN_HASH;
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const WHATSAPP_KEY = 'borjao_whatsapp';

let allItems = [];
let filteredItems = [];
let currentPage = 1;
let itemsPerPage = 12;

async function openAdmin() {
    const password = prompt('🔐 Digite a senha:');
    if (!password) return;
    
    const hash = await hashPassword(password);
    if (hash !== ADMIN_PASSWORD_HASH) {
        alert('❌ Senha incorreta!');
        return;
    }
    
    document.getElementById('adminPanel').classList.add('active');
    const whatsapp = localStorage.getItem(WHATSAPP_KEY) || '5511999999999';
    document.getElementById('whatsappNumber').value = whatsapp;
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function closeAdmin() {
    document.getElementById('adminPanel').classList.remove('active');
}

function saveWhatsapp() {
    const number = document.getElementById('whatsappNumber').value.trim();
    if (!number) {
        alert('❌ Digite um número válido!');
        return;
    }
    localStorage.setItem(WHATSAPP_KEY, number);
    alert('✅ Número do WhatsApp salvo!');
}

function extractSteamID(tradeUrl) {
    const match = tradeUrl.match(/partner=(\d+)/);
    if (match) {
        const partnerId = match[1];
        return (BigInt(partnerId) + BigInt('76561197960265728')).toString();
    }
    return null;
}

function calculateFloat(inspectLink) {
    if (!inspectLink) return null;
    
    try {
        const dMatch = inspectLink.match(/D(\d+)/);
        if (!dMatch) return null;
        
        const d = dMatch[1];
        const dNumber = parseFloat(d);
        const floatValue = dNumber / 10000000000000000;
        
        if (floatValue < 0 || floatValue > 1 || isNaN(floatValue) || !isFinite(floatValue)) {
            console.warn('Float fora do range:', floatValue.toFixed(10), 'D-value:', d);
            return null;
        }
        
        console.log('Float calculado:', floatValue.toFixed(6), 'D-value:', d);
        return floatValue;
    } catch (err) {
        console.error('Erro ao calcular float:', err);
        return null;
    }
}

async function loadInventoryAdmin() {
    const tradeUrl = document.getElementById('adminTradeUrl').value.trim();
    const btn = document.getElementById('btnLoadAdmin');
    const status = document.getElementById('adminStatus');

    if (!tradeUrl) {
        showAdminStatus('❌ Cole o Trade URL!', 'error');
        return;
    }

    const steamId = extractSteamID(tradeUrl);
    if (!steamId) {
        showAdminStatus('❌ Trade URL inválido!', 'error');
        return;
    }

    btn.disabled = true;
    showAdminStatus('⏳ Carregando inventário...', '');

    try {
        const response = await fetch(`/.netlify/functions/get-inventory?steamId=${steamId}`);
        
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Erro ao carregar');
        }

        const result = await response.json();
        const data = result.data;

        if (!data || !data.assets || data.assets.length === 0) {
            throw new Error('Nenhum item encontrado');
        }

        showAdminStatus('⏳ Processando itens...', '');

        const descMap = {};
        data.descriptions.forEach(desc => {
            descMap[`${desc.classid}_${desc.instanceid}`] = desc;
        });

        const tradableItems = [];
        
        for (const asset of data.assets) {
            const desc = descMap[`${asset.classid}_${asset.instanceid}`];
            if (!desc || desc.tradable !== 1) continue;

            const inspectLink = desc.actions?.[0]?.link || null;
            
            let fullInspectLink = null;
            let floatValue = null;
            
            if (inspectLink) {
                fullInspectLink = inspectLink
                    .replace('%owner_steamid%', steamId)
                    .replace('%assetid%', asset.assetid);
                
                floatValue = calculateFloat(fullInspectLink);
            }

            tradableItems.push({
                asset_id: asset.assetid,
                class_id: asset.classid,
                instance_id: asset.instanceid,
                owner_steam_id: steamId,
                name: desc.market_name || desc.name,
                type: desc.type || 'Unknown',
                weapon: desc.tags?.find(t => t.category === 'Weapon')?.localized_tag_name || 
                        desc.tags?.find(t => t.category === 'Type')?.localized_tag_name || 'Other',
                rarity: desc.tags?.find(t => t.category === 'Rarity')?.localized_tag_name || 'Normal',
                rarity_color: desc.name_color ? '#' + desc.name_color : '#b0b0b0',
                wear: desc.tags?.find(t => t.category === 'Exterior')?.localized_tag_name || 'N/A',
                float_value: floatValue,
                image_url: desc.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}` : null,
                inspect_link: inspectLink,
                tradable: true
            });
        }

        if (tradableItems.length === 0) {
            throw new Error('Nenhum item trocável encontrado');
        }

        showAdminStatus(`⏳ Salvando ${tradableItems.length} itens...`, '');

        await supabaseClient.from('inventory_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        const { error: insertError } = await supabaseClient.from('inventory_items').insert(tradableItems);

        if (insertError) {
            throw new Error(`Erro ao salvar: ${insertError.message}`);
        }

        showAdminStatus(`✅ ${tradableItems.length} itens salvos!`, 'success');
        
        setTimeout(() => {
            closeAdmin();
            loadPublicInventory();
        }, 1500);

    } catch (err) {
        console.error('Erro:', err);
        showAdminStatus(`❌ Erro: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
    }
}

function showAdminStatus(message, type) {
    const status = document.getElementById('adminStatus');
    status.textContent = message;
    status.style.display = 'block';
    status.className = 'admin-status';
    if (type === 'success') status.classList.add('status-success');
    if (type === 'error') status.classList.add('status-error');
}

async function loadPublicInventory() {
    try {
        const { data: items, error } = await supabaseClient
            .from('inventory_items')
            .select('*')
            .eq('tradable', true)
            .order('name', { ascending: true });

        if (error) throw error;

        if (!items || items.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            document.getElementById('navbar').style.display = 'none';
            document.getElementById('statsBar').style.display = 'none';
            return;
        }

        const grouped = {};
        items.forEach(item => {
            const key = `${item.name}_${item.float_value || 'noFloat'}`;
            if (!grouped[key]) {
                grouped[key] = { ...item, quantity: 1, items: [item] };
            } else {
                grouped[key].quantity++;
                grouped[key].items.push(item);
            }
        });

        allItems = Object.values(grouped);

        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('navbar').style.display = 'block';
        document.getElementById('statsBar').style.display = 'flex';

        const weapons = [...new Set(items.map(item => item.weapon))].sort();
        const weaponFilter = document.getElementById('weaponFilter');
        weaponFilter.innerHTML = '<option value="">Todas</option>';
        weapons.forEach(weapon => {
            weaponFilter.innerHTML += `<option value="${weapon}">${weapon}</option>`;
        });

        document.getElementById('totalItems').textContent = items.length;
        document.getElementById('uniqueItems').textContent = allItems.length;

        applyFilters();

    } catch (err) {
        console.error('❌ Erro:', err);
        document.getElementById('emptyState').style.display = 'block';
    }
}

function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const weaponFilter = document.getElementById('weaponFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    filteredItems = allItems.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(search);
        const matchWeapon = !weaponFilter || item.weapon === weaponFilter;
        return matchSearch && matchWeapon;
    });

    filteredItems.sort((a, b) => {
        switch(sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'float':
                const floatA = parseFloat(a.float_value) || 999;
                const floatB = parseFloat(b.float_value) || 999;
                return floatA - floatB;
            case 'rarity':
                return b.rarity_color.localeCompare(a.rarity_color);
            default:
                return 0;
        }
    });

    document.getElementById('filteredItems').textContent = filteredItems.length;
    currentPage = 1;
    renderPage();
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('weaponFilter').value = '';
    document.getElementById('sortBy').value = 'name';
    applyFilters();
}

function renderPage() {
    const perPage = document.getElementById('itemsPerPage').value;
    itemsPerPage = perPage === 'all' ? filteredItems.length : parseInt(perPage);

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filteredItems.slice(start, end);

    displayItems(pageItems);
    renderPagination();
}

function displayItems(items) {
    const grid = document.getElementById('itemsGrid');
    grid.innerHTML = '';

    const whatsapp = localStorage.getItem(WHATSAPP_KEY) || '5511999999999';

    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.animationDelay = `${index * 0.05}s`;

        let inspectBtn = '';
        if (item.inspect_link && item.owner_steam_id) {
            const link = item.inspect_link
                .replace('%owner_steamid%', item.owner_steam_id)
                .replace('%assetid%', item.asset_id);
            
            inspectBtn = `<a href="${link}" class="btn btn-inspect">🔍 Inspecionar</a>`;
        }

        const whatsappMsg = encodeURIComponent(`Olá! Tenho interesse na skin: ${item.name}`);
        const whatsappLink = `https://wa.me/${whatsapp}?text=${whatsappMsg}`;

        card.innerHTML = `
            ${item.quantity > 1 ? `<div class="quantity-badge">${item.quantity}x</div>` : ''}
            <div class="tradable-badge">✓ Trocável</div>
            <img src="${item.image_url}" alt="${item.name}" class="item-image" loading="lazy">
            <div class="item-name">${item.name}</div>
            <div class="item-rarity" style="background-color: ${item.rarity_color}">${item.rarity}</div>
            <div class="item-info">
                <div class="info-row">
                    <span class="info-label">Arma:</span>
                    <span class="info-value">${item.weapon}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Condição:</span>
                    <span class="info-value">${item.wear}</span>
                </div>
                ${item.float_value ? `
                <div class="info-row">
                    <span class="info-label">Float:</span>
                    <span class="float-value">${parseFloat(item.float_value).toFixed(6)}</span>
                </div>
                ` : ''}
            </div>
            <div class="item-actions">
                ${inspectBtn}
                <a href="${whatsappLink}" target="_blank" class="btn btn-whatsapp">
                    💬 Entrar em Contato
                </a>
            </div>
        `;

        grid.appendChild(card);
    });
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    pagination.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.textContent = '←';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        currentPage--;
        renderPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    pagination.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'page-btn' + (i === currentPage ? ' active' : '');
            pageBtn.textContent = i;
            pageBtn.onclick = () => {
                currentPage = i;
                renderPage();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            pagination.appendChild(pageBtn);
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '10px';
            pagination.appendChild(dots);
        }
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.textContent = '→';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        currentPage++;
        renderPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    pagination.appendChild(nextBtn);
}

document.getElementById('itemsPerPage').addEventListener('change', renderPage);

loadPublicInventory();
setInterval(loadPublicInventory, 30000);
