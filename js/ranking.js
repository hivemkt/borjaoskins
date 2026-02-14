const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_KEY = window.ENV.SUPABASE_KEY;
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ADMIN_PASSWORD_HASH = window.ENV.ADMIN_HASH;

// PATENTES DO CS:GO
const PATENTES = {
    1: { nome: 'Global Elite', emoji: '🌐', cor: '#FFD700' },
    2: { nome: 'Supremo', emoji: '👑', cor: '#FF4500' },
    3: { nome: 'Águia', emoji: '🦅', cor: '#FF6347' },
    4: { nome: 'Xerife', emoji: '⭐', cor: '#FFA500' },
    5: { nome: 'Xerife', emoji: '⭐', cor: '#FFA500' },
    6: { nome: 'Xerife', emoji: '⭐', cor: '#FFA500' },
    7: { nome: 'AK', emoji: '🔫', cor: '#32CD32' },
    8: { nome: 'AK', emoji: '🔫', cor: '#32CD32' },
    9: { nome: 'AK', emoji: '🔫', cor: '#32CD32' },
    10: { nome: 'AK', emoji: '🔫', cor: '#32CD32' },
    11: { nome: 'Ouro', emoji: '🥇', cor: '#FFD700' },
    12: { nome: 'Ouro', emoji: '🥇', cor: '#FFD700' },
    13: { nome: 'Ouro', emoji: '🥇', cor: '#FFD700' },
    14: { nome: 'Ouro', emoji: '🥇', cor: '#FFD700' },
    15: { nome: 'Ouro', emoji: '🥇', cor: '#FFD700' }
};

function getPatente(position) {
    if (PATENTES[position]) {
        return PATENTES[position];
    }
    return { nome: 'Prata', emoji: '🥈', cor: '#C0C0C0' };
}

async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAdminPassword(password) {
    const hash = await hashPassword(password);
    return hash === ADMIN_PASSWORD_HASH;
}

async function loadRanking() {
    try {
        const { data: ranking, error } = await supabaseClient
            .from('ranking_points')
            .select('*')
            .order('total_points', { ascending: false })
            .limit(100);

        if (error) throw error;

        if (!ranking || ranking.length === 0) {
            showEmpty('Nenhum comprador ainda. Seja o primeiro!');
            return;
        }

        const totalCompetitors = ranking.length;
        const totalPoints = ranking.reduce((sum, r) => sum + parseFloat(r.total_points || 0), 0);
        const totalNumbers = ranking.reduce((sum, r) => sum + parseInt(r.total_numbers || 0), 0);

        document.getElementById('totalCompetitors').textContent = totalCompetitors;
        document.getElementById('totalNumbers').textContent = totalNumbers;
        document.getElementById('totalPoints').textContent = Math.round(totalPoints);

        // AGRUPAR POR PONTUAÇÃO
        const grouped = [];
        
        for (let i = 0; i < ranking.length; i++) {
            const currentPoints = Math.round(parseFloat(ranking[i].total_points || 0));
            
            // Se for o primeiro ou pontos diferentes do anterior
            if (i === 0 || currentPoints !== Math.round(parseFloat(ranking[i-1].total_points || 0))) {
                grouped.push({
                    position: grouped.length + 1, // POSIÇÃO SEQUENCIAL
                    points: currentPoints,
                    players: [ranking[i]]
                });
            } else {
                // Mesma pontuação = adiciona ao grupo anterior
                grouped[grouped.length - 1].players.push(ranking[i]);
            }
        }

        const container = document.getElementById('rankingContainer');
        container.innerHTML = '';
        
        grouped.forEach((group, groupIndex) => {
            const position = group.position;
            const points = group.points;
            const players = group.players;
            
            // Medal ou posição
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
            
            // Patente
            const patente = getPatente(position);
            
            // Nomes dos jogadores (separados por vírgula se múltiplos)
            const names = players.map(p => {
                const nameParts = (p.buyer_name || 'Anônimo').split(' ');
                const firstName = nameParts[0] || 'Anônimo';
                const lastName = nameParts[1] || '';
                return lastName ? `${firstName} ${lastName}` : firstName;
            }).join(', ');
            
            // Total de cotas do grupo
            const totalNumbers = players.reduce((sum, p) => sum + parseInt(p.total_numbers || 0), 0);
            
            const item = document.createElement('div');
            item.className = 'ranking-item';
            item.style.animationDelay = `${groupIndex * 0.1}s`;
            
            // Borda destacada ATÉ posição 15 (não 16)
            if (position > 15) {
                item.classList.add('ranking-item-inactive');
            }
            
            // TOP 1 menor
            if (position === 1) {
                item.classList.add('ranking-item-top1');
            }
            
            item.innerHTML = `
                ${medal ? `<div class="ranking-medal">${medal}</div>` : `<div class="ranking-position">${position}º</div>`}
                <div class="ranking-info-box">
                    <div class="ranking-name">${names}</div>
                    <div class="ranking-patente" style="color: ${patente.cor};">
                        ${patente.emoji} ${patente.nome}
                    </div>
                </div>
                <div class="ranking-points">
                    <div class="ranking-points-value">${points}</div>
                    <div class="ranking-points-label">pontos</div>
                </div>
            `;
            
            container.appendChild(item);
        });

        document.getElementById('loadingMessage').style.display = 'none';
        container.style.display = 'block';

    } catch (error) {
        console.error('❌ Erro ao carregar ranking:', error);
        showEmpty('Erro ao carregar ranking.');
    }
}

function showEmpty(message) {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('rankingContainer').style.display = 'none';
    const emptyState = document.getElementById('emptyState');
    emptyState.querySelector('p').textContent = message;
    emptyState.style.display = 'block';
}

loadRanking();
setInterval(loadRanking, 10000);

// ===== ADMIN PANEL =====
async function openAdminPanel() {
    const password = prompt('🔐 Digite a senha do administrador:');
    if (!password) return;

    const isValid = await verifyAdminPassword(password);
    if (!isValid) {
        alert('❌ Senha incorreta!');
        return;
    }

    document.getElementById('adminPanel').classList.add('active');
    loadAdminData();
}

function closeAdminPanel() {
    document.getElementById('adminPanel').classList.remove('active');
}

async function loadAdminData() {
    try {
        const { data, error } = await supabaseClient
            .from('ranking_points')
            .select('*')
            .order('total_points', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('adminTableBody');
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum jogador no ranking</td></tr>';
            return;
        }

        data.forEach((player, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}º</td>
                <td>
                    <input type="text" value="${player.buyer_name}" id="name_${player.id}" />
                </td>
                <td>
                    <input type="text" value="${player.buyer_phone}" id="phone_${player.id}" />
                </td>
                <td>
                    <input type="number" value="${Math.round(player.total_points)}" id="points_${player.id}" style="width: 80px;" />
                </td>
                <td>
                    <input type="number" value="${player.total_numbers || 0}" id="numbers_${player.id}" style="width: 80px;" />
                </td>
                <td>
                    <button class="btn-save" onclick="savePlayer('${player.id}')">💾 Salvar</button>
                    <button class="btn-delete" onclick="deletePlayer('${player.id}', '${player.buyer_name}')">🗑️ Deletar</button>
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Erro ao carregar admin:', error);
        alert('Erro ao carregar dados: ' + error.message);
    }
}

async function savePlayer(id) {
    try {
        const name = document.getElementById(`name_${id}`).value;
        const phone = document.getElementById(`phone_${id}`).value;
        const points = parseFloat(document.getElementById(`points_${id}`).value);
        const numbers = parseInt(document.getElementById(`numbers_${id}`).value);

        if (!name || !phone || isNaN(points) || isNaN(numbers)) {
            alert('❌ Preencha todos os campos corretamente!');
            return;
        }

        const { error } = await supabaseClient
            .from('ranking_points')
            .update({
                buyer_name: name,
                buyer_phone: phone,
                total_points: points,
                total_numbers: numbers,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        alert('✅ Jogador atualizado com sucesso!');
        loadAdminData();
        loadRanking();

    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('❌ Erro ao salvar: ' + error.message);
    }
}

async function deletePlayer(id, name) {
    if (!confirm(`❌ Tem certeza que deseja deletar "${name}" do ranking?\n\nEsta ação NÃO pode ser desfeita!`)) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('ranking_points')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('✅ Jogador deletado com sucesso!');
        loadAdminData();
        loadRanking();

    } catch (error) {
        console.error('Erro ao deletar:', error);
        alert('❌ Erro ao deletar: ' + error.message);
    }
}

async function addPlayer() {
    try {
        const name = document.getElementById('newName').value;
        const phone = document.getElementById('newPhone').value;
        const points = parseFloat(document.getElementById('newPoints').value);
        const numbers = parseInt(document.getElementById('newNumbers').value) || 0;

        if (!name || !phone || isNaN(points)) {
            alert('❌ Preencha nome, telefone e pontos!');
            return;
        }

        const { data: existing } = await supabaseClient
            .from('ranking_points')
            .select('id')
            .eq('buyer_phone', phone)
            .single();

        if (existing) {
            alert('❌ Este telefone já existe no ranking!\n\nEdite o jogador existente ao invés de adicionar um novo.');
            return;
        }

        const { error } = await supabaseClient
            .from('ranking_points')
            .insert({
                buyer_name: name,
                buyer_phone: phone,
                total_points: points,
                total_purchases: 0,
                total_numbers: numbers,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (error) throw error;

        alert('✅ Jogador adicionado com sucesso!');
        
        document.getElementById('newName').value = '';
        document.getElementById('newPhone').value = '';
        document.getElementById('newPoints').value = '';
        document.getElementById('newNumbers').value = '';

        loadAdminData();
        loadRanking();

    } catch (error) {
        console.error('Erro ao adicionar:', error);
        alert('❌ Erro ao adicionar: ' + error.message);
    }
}
