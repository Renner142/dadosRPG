// =======================================================
// 1. INICIALIZAÇÃO E VARIÁVEIS GLOBAIS
// =======================================================
const supabaseClient = window.supabase.createClient(
  'https://eglmqjoqmnipcfnhdcyl.supabase.co',
  'sb_publishable_1mVT1wJ14LpEb7xYEoQmvA_fYna-o-Y'
);

let personagemAtual = null;

// =======================================================
// 2. NAVEGAÇÃO DE TELAS E SELEÇÃO DE PERSONAGEM
// =======================================================
// =======================================================
// 1. VARIÁVEIS GLOBAIS DE CONTROLADORES DE CAMPANHA
// =======================================================
let campanhaAtual = 'ordem-paranormal';
let tabelaRolls = 'rolls';
let tabelaStatus = 'status_players';

function selecionarCampanha(nomeCampanha) {
  campanhaAtual = nomeCampanha;
  console.log("Campanha selecionada:", nomeCampanha);

  // Limpa classes de tema anteriores do body
  document.body.classList.remove("tema-a-realidade", "tema-ordem-paranormal");

  // Define as tabelas e adiciona a classe do tema no body
  if (nomeCampanha === "a-realidade") {
    tabelaRolls = "rolls_arl";
    tabelaStatus = "status_players_arl";
    document.body.classList.add("tema-a-realidade");
  } else {
    tabelaRolls = "rolls";
    tabelaStatus = "status_players";
    document.body.classList.add("tema-ordem-paranormal");
  }

  // Filtra os cards de personagem exibidos na tela (código original mantido)
  const cards = document.querySelectorAll("#screen-character .char-select-card");
  cards.forEach(card => {
    const campanhaDoCard = card.getAttribute("data-campanha");
    if (campanhaDoCard === nomeCampanha) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  });

  // Troca de tela (código original mantido)
  const screenCampaign = document.getElementById("screen-campaign");
  const screenCharacter = document.getElementById("screen-character");
  if (screenCampaign) screenCampaign.classList.remove("active");
  if (screenCharacter) screenCharacter.classList.add("active");
}

function selecionarPersonagem(idPersonagem) {
  personagemAtual = idPersonagem;

  renderizarMesa();

  // 🔄 Reinicia o histórico e reconecta o Realtime na tabela certa
  carregarHistorico();
  carregarStatusIniciais();
  ligarRealtimeDeDados();   // <- Liga o Realtime de rolagens
  ligarRealtimeDeStatus();  // <- Liga o Realtime de PV/SAN/PE

  const screenCharacter = document.getElementById("screen-character");
  const screenGameboard = document.getElementById("screen-gameboard");

  if (screenCharacter) screenCharacter.classList.remove("active");
  if (screenGameboard) screenGameboard.classList.add("active");
}

function rolarDadoLocal() {
  const nomeTeste = document.getElementById("local-nome-teste").value.trim() || "Teste Geral";
  const qtdDados = parseInt(document.getElementById("local-qtd-dados").value) || 1;
  const facesDado = parseInt(document.getElementById("local-faces-dado").value) || 20;
  const tipoCalculo = document.getElementById("local-tipo-calculo").value;
  const modificador = parseInt(document.getElementById("local-modificador").value) || 0;

  let resultados = [];
  for (let i = 0; i < qtdDados; i++) {
    resultados.push(Math.floor(Math.random() * facesDado) + 1);
  }

  let total = 0;
  if (tipoCalculo === "maior") {
    total = Math.max(...resultados) + modificador;
  } else {
    total = resultados.reduce((a, b) => a + b, 0) + modificador;
  }

  const modTexto = modificador >= 0 ? `+${modificador}` : `${modificador}`;
  const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const novaRolagem = {
    nomeTeste,
    detalhes: `${qtdDados}d${facesDado} (${modTexto}) [${tipoCalculo.toUpperCase()}]`,
    resultados: `[${resultados.join(", ")}]`,
    total,
    hora
  };

  // Salva no localStorage
  let historicoLocal = JSON.parse(localStorage.getItem("historico_local_rpg") || "[]");
  historicoLocal.unshift(novaRolagem); // Adiciona no início da lista
  localStorage.setItem("historico_local_rpg", JSON.stringify(historicoLocal));

  // Atualiza a tela
  renderizarHistoricoLocal(historicoLocal);
}

function carregarHistoricoLocal() {
  const historicoLocal = JSON.parse(localStorage.getItem("historico_local_rpg") || "[]");
  renderizarHistoricoLocal(historicoLocal);
}

function renderizarHistoricoLocal(lista) {
  const ul = document.getElementById("local-historico-list");
  if (!ul) return;

  if (lista.length === 0) {
    ul.innerHTML = `<li class="empty-msg">Nenhuma rolagem feita ainda.</li>`;
    return;
  }

  ul.innerHTML = lista.map(item => `
    <li style="border-bottom: 1px solid #333; padding: 6px 0; font-size: 13px;">
      <strong style="color: #ff9f43;">${item.nomeTeste}</strong> 
      <small style="color: #888;">${item.detalhes}</small> - 
      <span style="color: #2ed573; font-weight: bold;">➡️ ${item.total}</span>
      <small style="color: #555; display: block;">${item.resultados} às ${item.hora}</small>
    </li>
  `).join("");
}

function voltarParaCampanhas() {
  const screenCampaign = document.getElementById("screen-campaign");
  const screenCharacter = document.getElementById("screen-character");
  
  if (screenCharacter) screenCharacter.classList.remove("active");
  if (screenCampaign) screenCampaign.classList.add("active");
}

function trocarPersonagem() {
  const screenGameboard = document.getElementById("screen-gameboard");
  const screenCharacter = document.getElementById("screen-character");
  
  if (screenGameboard) screenGameboard.classList.remove("active");
  if (screenCharacter) screenCharacter.classList.add("active");
}


function renderizarMesa() {
  const featuredSlot = document.getElementById("featured-slot");
  const alliesGrid = document.getElementById("allies-grid");
  const storage = document.getElementById("players-storage");
  const tituloModo = document.getElementById("titulo-modo-jogo");
  const dashboard = document.querySelector(".dashboard-layout");

  if (!featuredSlot || !alliesGrid) return;

  // 1. Resgata todos os cards de jogadores
  const todosOsPlayers = Array.from(document.querySelectorAll(".player"));

  // 2. Devolve para o storage oculto antes de organizar
  if (storage) {
    todosOsPlayers.forEach(p => storage.appendChild(p));
  }

  featuredSlot.innerHTML = "";
  alliesGrid.innerHTML = "";

  // 🎯 NOVO: Filtra os jogadores, pegando APENAS os da campanha atual!
  // (Se o card não tiver data-campanha no HTML, considera por padrão 'ordem-paranormal')
  const playersDaCampanha = todosOsPlayers.filter(p => {
    const campDoPlayer = p.getAttribute("data-campanha") || "ordem-paranormal";
    return campDoPlayer === campanhaAtual;
  });

  const idAtualNormalizado = (personagemAtual || "").toString().trim().toLowerCase();

  // ==========================================
  // VISÃO DO MESTRE (LADO ESQUERDO, CENTRO, LADO DIREITO)
  // ==========================================
  if (idAtualNormalizado === "mestre") {
    if (dashboard) dashboard.classList.add("modo-mestre");
    if (tituloModo) tituloModo.innerText = `Visão Geral (Mestre - ${campanhaAtual === "a-realidade" ? "A Realidade" : "Ordem Paranormal"})`;
    
    featuredSlot.style.display = "flex";

    // Divide os jogadores da campanha atual igualmente entre Esquerda (featuredSlot) e Direita (alliesGrid)
    const metade = Math.ceil(playersDaCampanha.length / 2);

    playersDaCampanha.forEach((player, index) => {
      if (index < metade) {
        featuredSlot.appendChild(player); // Vai para o lado Esquerdo
      } else {
        alliesGrid.appendChild(player);   // Vai para o lado Direito
      }
    });

  // ==========================================
  // VISÃO NORMAL DO JOGADOR
  // ==========================================
  } else {
    if (dashboard) dashboard.classList.remove("modo-mestre");
    featuredSlot.style.display = "block";

    playersDaCampanha.forEach(p => {
      const pId = (p.getAttribute("data-player") || "").toString().trim().toLowerCase();

      if (pId === idAtualNormalizado) {
        featuredSlot.appendChild(p); // Card ativo no topo da esquerda
        if (tituloModo) {
          const nomeEl = p.querySelector("h2");
          tituloModo.innerText = `Jogando como: ${nomeEl ? nomeEl.innerText : pId}`;
        }
      } else {
        alliesGrid.appendChild(p);   // Outros aliados da MESMA campanha na direita
      }
    });
  }

  // Re-vincula os eventos dos inputs e botões
  if (typeof inicializarEventosDeDigitacao === "function") inicializarEventosDeDigitacao();
  if (typeof inicializarBotoesDeRolagem === "function") inicializarBotoesDeRolagem();
}

// =======================================================
// 3. CONTROLE DE HISTÓRICO DE DADOS (GERAL E PESSOAL)
// =======================================================
function formatarHora(dateString) {
  const d = dateString ? new Date(dateString) : new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function montarTextoHistorico(roll) {
  // 🔍 LOG 1: Inspeciona o objeto completo recebido pela função
  console.log("🔍 [montarTextoHistorico] Objeto recebido:", roll);

  if (!roll) return "";

  const resultados = Array.isArray(roll.results) ? roll.results : (roll.resultados || []);
  const hora = formatarHora(roll.created_at);
  const nome = roll.nome_rolagem || roll.nome || "Dados";
  const mod = roll.modificador || 0;
  
  const textoMod = mod > 0 
    ? ` <span style="color: #2ed573; font-weight: bold;">+${mod}</span>` 
    : mod < 0 
      ? ` <span style="color: #ff4757; font-weight: bold;">${mod}</span>` 
      : "";

  const modoTag = roll.tipo_calculo === "maior" 
    ? `<span style="color: #ff4757; font-weight: bold; font-size: 10px; background: rgba(255,71,87,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,71,87,0.3); display: inline-block;">MAIOR</span>` 
    : `<span style="color: #2ed573; font-weight: bold; font-size: 10px; background: rgba(46,213,115,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(46,213,115,0.3); display: inline-block;">SOMA</span>`;
  
  // Imagem do avatar com fallback seguro
  const avatarUrl = (roll.avatar_url && roll.avatar_url.trim() !== "") 
    ? roll.avatar_url 
    : 'https://placehold.co/40x40';

  return `
    <div style="display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 8px 0; border-bottom: 1px solid #2a2a2a;">
      <img src="${avatarUrl}" alt="${roll.player || ''}" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; border: 1px solid #444; flex-shrink: 0; margin-top: 2px;" onerror="this.src='https://placehold.co/40x40';">
      
      <div style="display: flex; flex-direction: column; width: 100%; gap: 3px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="color: #aaa; font-size: 11px; font-weight: bold; text-transform: uppercase;">${roll.player || 'Jogador'}</span>
          <span style="color: #555; font-size: 11px;">${hora}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <strong style="color: #ff9f43; font-size: 14px;">${nome}</strong> 
          <span style="color: #888; font-size: 11px;">(${roll.qtd || 1}d${roll.faces || 20})${textoMod}</span> 
          ${modoTag}
        </div>
        
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
          <span style="color: #666; font-size: 12px;">➔</span>
          <strong style="color: #00ffff; font-size: 16px; text-shadow: 0 0 6px rgba(0,255,255,0.5);">${roll.total ?? 0}</strong>
          <span style="color: #666; font-size: 11px;">[${resultados.join(", ")}]</span>
        </div>
      </div>
    </div>
  `;
}

function adicionarRolagemNaInterface(roll) {
  if (!roll || !roll.id) return;

  const listaGeral = document.getElementById("historico-geral-list");
  const listaPessoal = document.getElementById("historico-pessoal-list");

  // 🛡️ TRAVA ANTI-DUPLICAÇÃO:
  // Se o item com esse ID já foi inserido no HTML, ignora!
  const jaExisteGeral = listaGeral ? listaGeral.querySelector(`[data-id="${roll.id}"]`) : null;
  if (jaExisteGeral) return;

  const htmlConteudo = montarTextoHistorico(roll);

  // 1. Histórico Geral da Mesa
  if (listaGeral) {
    const liGeral = document.createElement("li");
    liGeral.style.listStyle = "none";
    liGeral.setAttribute("data-id", roll.id); // Guardamos o ID no elemento HTML
    liGeral.innerHTML = htmlConteudo;
    listaGeral.prepend(liGeral);

    if (listaGeral.children.length > 30) {
      listaGeral.removeChild(listaGeral.lastChild);
    }
  }

  // 2. Histórico Pessoal do Jogador Ativo
  const jogadorRolagem = (roll.player || "").toLowerCase();
  const jogadorAtivo = (personagemAtual || "").toLowerCase();

  if (personagemAtual && personagemAtual !== "mestre" && jogadorRolagem === jogadorAtivo && listaPessoal) {
    const emptyMsg = listaPessoal.querySelector(".empty-msg");
    if (emptyMsg) emptyMsg.remove();

    const liPessoal = document.createElement("li");
    liPessoal.style.listStyle = "none";
    liPessoal.setAttribute("data-id", roll.id);
    liPessoal.innerHTML = htmlConteudo;
    listaPessoal.prepend(liPessoal);

    if (listaPessoal.children.length > 20) {
      listaPessoal.removeChild(listaPessoal.lastChild);
    }
  }
}

// Busca os status iniciais na tabela dinâmica
async function carregarStatusIniciais() {
  const { data, error } = await supabaseClient
    .from(tabelaStatus)
    .select("*");

  if (error) {
    console.error("Erro ao buscar status:", error);
    return;
  }

  if (!data) return;

  data.forEach(status => {
    const playerEl = document.querySelector(`.player[data-player="${status.player.toLowerCase().trim()}"]`);
    if (!playerEl) return;

    const mapeamento = [
      { tipoHtml: "pv", bancoPrefixo: "pv" },
      { tipoHtml: "sanidade", bancoPrefixo: "sanidade" },
      { tipoHtml: "pe", bancoPrefixo: "pe" }
    ];

    mapeamento.forEach(({ tipoHtml, bancoPrefixo }) => {
      const row = playerEl.querySelector(`.status-row[data-status="${tipoHtml}"]`);
      if (row) {
        const inputAtual = row.querySelector(".status-atual");
        const inputMax = row.querySelector(".status-max");

        if (inputAtual && inputMax) {
          inputAtual.value = status[`${bancoPrefixo}_atual`] ?? 0;
          inputMax.value = status[`${bancoPrefixo}_max`] ?? 0;
          renderizarBarraVisual(row);
        }
      }
    });
  });
}

let rollsChannel = null;

function ligarRealtimeDeDados() {
  const tabelaAlvo = (typeof tabelaRolls !== "undefined") ? tabelaRolls : "rolls";

  if (rollsChannel) {
    supabaseClient.removeChannel(rollsChannel);
    rollsChannel = null;
  }

  rollsChannel = supabaseClient.channel("rolls-channel-" + tabelaAlvo);

  rollsChannel
    .on(
      "postgres_changes",
      { 
        event: "INSERT", 
        schema: "public", 
        table: tabelaAlvo 
      },
      (payload) => {
        // Só tenta adicionar via Realtime se o payload.new REALMENTE trouxer dados
        // (evita duplicar com o clique do botão local)
        if (payload.new && Object.keys(payload.new).length > 0) {
          if (typeof adicionarRolagemNaInterface === "function") {
            adicionarRolagemNaInterface(payload.new);
          }
        }
      }
    )
    .subscribe();
}

async function carregarHistorico() {
  const tabelaAlvo = (typeof tabelaRolls !== "undefined") ? tabelaRolls : "rolls";

  console.log("📜 [carregarHistorico] Buscando histórico na tabela:", tabelaAlvo);

  const { data, error } = await supabaseClient
    .from(tabelaAlvo)
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(`❌ [carregarHistorico] Erro ao carregar histórico da tabela ${tabelaAlvo}:`, error);
    return;
  }

  // 🔍 LOG 3: Mostra todos os registros encontrados no banco
  console.log(`✅ [carregarHistorico] Total de registros retornados de (${tabelaAlvo}):`, data ? data.length : 0);
  if (data && data.length > 0) {
    console.log(`🔍 [carregarHistorico] Primeiro registro da tabela ${tabelaAlvo}:`, data[0]);
    console.log(`🔑 [carregarHistorico] Nomes das colunas da tabela:`, Object.keys(data[0]));
  }

  const listaGeral = document.getElementById("historico-geral-list");
  const listaPessoal = document.getElementById("historico-pessoal-list");

  if (listaGeral) listaGeral.innerHTML = "";
  if (listaPessoal) listaPessoal.innerHTML = '<li class="empty-msg">Nenhuma rolagem pessoal ainda.</li>';

  if (data) {
    data.forEach(roll => {
      adicionarRolagemNaInterface(roll);
    });
  }
}

function inicializarBotoesDeRolagem() {
  document.querySelectorAll(".player").forEach(player => {
    const btnAntigo = player.querySelector(".roll-btn");
    if (!btnAntigo) return;

    // 1. CLONA O BOTÃO para remover qualquer addEventListener antigo preso nele
    const btn = btnAntigo.cloneNode(true);
    btnAntigo.parentNode.replaceChild(btn, btnAntigo);

    // 2. Adiciona APENAS UM ouvinte de clique no botão limpo
    btn.addEventListener("click", async () => {
      // Bloqueia cliques duplos rápidos enquanto processa
      if (btn.disabled) return;
      btn.disabled = true;

      try {
        const qtdEl = player.querySelector(".qtd-dados") || player.querySelector(".qtd");
        const facesEl = player.querySelector(".faces-dado") || player.querySelector(".faces");
        
        const qtd = parseInt(qtdEl ? qtdEl.value : 1) || 1;
        const faces = parseInt(facesEl ? facesEl.value : 20) || 20;
        const nomeRolagem = player.querySelector(".nome-rolagem") ? player.querySelector(".nome-rolagem").value.trim() : "";
        const tipoCalculo = player.querySelector(".tipo-calculo") ? player.querySelector(".tipo-calculo").value : "maior";

        const modTexto = player.querySelector(".modificador") ? player.querySelector(".modificador").value.replace("+", "").trim() : "";
        const modificador = parseInt(modTexto) || 0;

        // 🔍 PROCURA O AVATAR EM VÁRIOS SELETORES POSSÍVEIS
        const imgEl = player.querySelector(".avatar-quadrado img") || 
                      player.querySelector(".avatar img") || 
                      player.querySelector("img.avatar") ||
                      player.querySelector("img");

        let avatarUrl = imgEl ? imgEl.src : "";

        // Se a imagem for inválida, vazia ou o via.placeholder quebrado, usa placehold.co
        if (!avatarUrl || avatarUrl.includes("via.placeholder.com") || avatarUrl.endsWith("/")) {
          avatarUrl = "https://placehold.co/40x40";
        }

        let resultados = [];
        for (let i = 0; i < qtd; i++) {
          resultados.push(Math.floor(Math.random() * faces) + 1);
        }

        let baseCalculo = (tipoCalculo === "maior") ? Math.max(...resultados) : resultados.reduce((a, b) => a + b, 0);
        const totalFinal = baseCalculo + modificador;
        const playerId = (player.dataset.player || "").trim().toLowerCase();

        // Tabela dinâmica (rolls ou rolls_arl)
        const tabelaAlvo = (typeof tabelaRolls !== "undefined") ? tabelaRolls : "rolls";

        const dadosParaSalvar = {
          player: playerId,
          qtd,
          faces,
          results: resultados,
          total: totalFinal,
          nome_rolagem: nomeRolagem,
          tipo_calculo: tipoCalculo,
          modificador: modificador,
          avatar_url: avatarUrl
        };

        console.log(`💾 [Salvar Rolagem] Salvando na tabela "${tabelaAlvo}":`, dadosParaSalvar);

        // Salva no Supabase e pede o retorno dos dados salvos (.select())
        const { data, error } = await supabaseClient.from(tabelaAlvo).insert(dadosParaSalvar).select();

        if (error) {
          console.error(`❌ [Salvar Rolagem] Erro no Supabase (${tabelaAlvo}):`, error);
        } else {
          console.log(`✅ [Salvar Rolagem] Sucesso! Registro inserido:`, data);
          
          // 🚀 SOLUÇÃO DIRETA:
          // Usa os dados que acabaram de ser salvos e insere na interface local imediatamente!
          if (data && data[0] && typeof adicionarRolagemNaInterface === "function") {
            adicionarRolagemNaInterface(data[0]);
          }
        }

      } catch (err) {
        console.error("❌ Erro interno ao processar rolagem:", err);
      } finally {
        // Reativa o botão após 300ms para evitar duplo clique acidental
        setTimeout(() => {
          btn.disabled = false;
        }, 300);
      }
    });
  });
}

// =======================================================
// 4. BARRAS DE STATUS COM SUPABASE REALTIME
// =======================================================
function renderizarBarraVisual(row) {
  const atualInput = row.querySelector(".status-atual");
  const maxInput = row.querySelector(".status-max");
  const barFill = row.querySelector(".bar-fill");

  if (!atualInput || !maxInput || !barFill) return;

  let atual = parseInt(atualInput.value) || 0;
  let max = parseInt(maxInput.value) || 0;

  if (max <= 0) {
    barFill.style.width = "0%";
    return;
  }
  
  if (atual < 0) atual = 0;

  let porcentagem = (atual / max) * 100;
  if (porcentagem > 100) porcentagem = 100;

  barFill.style.width = `${porcentagem}%`;
}


function inicializarEventosDeDigitacao() {
  let timeouts = {};

  document.querySelectorAll(".player").forEach(player => {
    const playerId = (player.dataset.player || "").trim().toLowerCase();

    player.querySelectorAll(".status-inputs input").forEach(input => {
      input.addEventListener("input", () => {
        const row = input.closest(".status-row");
        if (!row) return;

        const tipoStatus = row.dataset.status;

        renderizarBarraVisual(row);
        notificarAlteracaoStatus(player, tipoStatus);

        const atual = parseInt(row.querySelector(".status-atual").value) || 0;
        const max = parseInt(row.querySelector(".status-max").value) || 0;

        let dadosAtualizacao = {
          player: playerId,
          updated_at: new Date()
        };
        dadosAtualizacao[`${tipoStatus}_atual`] = atual;
        dadosAtualizacao[`${tipoStatus}_max`] = max;

        // Usa a tabela da campanha ativa (status_players ou status_players_arl)
        const tabelaAlvo = (typeof tabelaStatus !== "undefined") ? tabelaStatus : "status_players";

        clearTimeout(timeouts[playerId + "_" + tipoStatus]);
        timeouts[playerId + "_" + tipoStatus] = setTimeout(async () => {
          const { error } = await supabaseClient
            .from(tabelaAlvo)
            .upsert(dadosAtualizacao, { onConflict: 'player' });

        }, 400);
      });
    });
  });
}

let statusChannel = null;

function ligarRealtimeDeStatus() {
  if (statusChannel) {
    supabaseClient.removeChannel(statusChannel);
  }

  statusChannel = supabaseClient.channel("status-realtime-" + tabelaStatus);

  statusChannel
    .on(
      "postgres_changes",
      { 
        event: "UPDATE", 
        schema: "public", 
        table: tabelaStatus // Escuta na tabela dinâmica
      },
      (payload) => {
        const status = payload.new;
        if (!status || !status.player) return;

        const nomePlayer = status.player.toLowerCase().trim();
        const playerEl = document.querySelector(`.player[data-player="${nomePlayer}"]`);
        if (!playerEl) return;

        const mapeamento = [
          { tipoHtml: "pv", bancoPrefixo: "pv" },
          { tipoHtml: "sanidade", bancoPrefixo: "sanidade" },
          { tipoHtml: "pe", bancoPrefixo: "pe" }
        ];

        mapeamento.forEach(({ tipoHtml, bancoPrefixo }) => {
          const row = playerEl.querySelector(`.status-row[data-status="${tipoHtml}"]`);
          if (!row) return;

          const inputAtual = row.querySelector(".status-atual");
          const inputMax = row.querySelector(".status-max");

          const valorNovo = status[`${bancoPrefixo}_atual`];
          const maxNovo = status[`${bancoPrefixo}_max`];

          let houveMudanca = false;

          if (inputAtual && valorNovo !== undefined && valorNovo !== null) {
            const numAtualAntigo = String(inputAtual.value).trim();
            const numAtualNovo = String(valorNovo).trim();

            if (numAtualAntigo !== numAtualNovo) {
              inputAtual.value = numAtualNovo;
              houveMudanca = true;
            }
          }

          if (inputMax && maxNovo !== undefined && maxNovo !== null) {
            const numMaxAntigo = String(inputMax.value).trim();
            const numMaxNovo = String(maxNovo).trim();

            if (numMaxAntigo !== numMaxNovo) {
              inputMax.value = numMaxNovo;
              houveMudanca = true;
            }
          }

          if (houveMudanca) {
            notificarAlteracaoStatus(playerEl, tipoHtml);
          }

          renderizarBarraVisual(row);
        });
      }
    )
    .subscribe();
}



// Relógios ativos para cada personagem
const relogiosPiscar = {};

function notificarAlteracaoStatus(playerElement, tipoStatus) {
  if (!playerElement) return;

  const playerId = playerElement.dataset.player || "player";
  const chaveRelogio = playerId; // Chave única por PLAYER para controlar a substituição

  let classePiscar = "";
  if (tipoStatus === "pv") classePiscar = "piscar-pv";
  else if (tipoStatus === "sanitude" || tipoStatus === "sanidade") classePiscar = "piscar-sanidade";
  else if (tipoStatus === "pe") classePiscar = "piscar-pe";

  if (!classePiscar) return;

  // 1. LIMPA qualquer brilho anterior (seja vermelho, azul ou amarelo)
  playerElement.classList.remove("piscar-pv", "piscar-sanidade", "piscar-pe");

  // 2. Se já havia um relógio rodando para este player, cancela ele!
  if (relogiosPiscar[chaveRelogio]) {
    clearTimeout(relogiosPiscar[chaveRelogio]);
  }

  // 3. Adiciona IMEDIATAMENTE a nova cor de status
  playerElement.classList.add(classePiscar);

  // 4. Inicia o novo cronômetro de 2 segundos para a NOVA cor
  relogiosPiscar[chaveRelogio] = setTimeout(() => {
    playerElement.classList.remove("piscar-pv", "piscar-sanidade", "piscar-pe");
    delete relogiosPiscar[chaveRelogio];
  }, 2000);
}



// =======================================================
// 6. ÁREA DE TESTES LOCAL (SE HOUVER NA TELA)
// =======================================================
function inicializarRolagemLocal() {
  const btnLocal = document.querySelector(".roll-btn-local");
  if (!btnLocal || btnLocal.dataset.bound) return;
  btnLocal.dataset.bound = "true";

  btnLocal.addEventListener("click", () => {
    const container = document.querySelector(".test-zone-container");
    if (!container) return;

    const qtd = parseInt(container.querySelector(".qtd-local")?.value || 1);
    const faces = parseInt(container.querySelector(".faces-local")?.value || 20);
    const nome = container.querySelector(".nome-rolagem-local")?.value.trim() || "Teste Local";
    const tipo = container.querySelector(".tipo-calculo-local")?.value || "maior";
    const mod = parseInt(container.querySelector(".modificador-local")?.value || 0);

    let resultados = [];
    for (let i = 0; i < qtd; i++) {
      resultados.push(Math.floor(Math.random() * faces) + 1);
    }

    let base = (tipo === "maior") ? Math.max(...resultados) : resultados.reduce((a, b) => a + b, 0);
    const total = base + mod;

    const ul = container.querySelector(".local-historico ul");
    if (ul) {
      const li = document.createElement("li");
      li.style.listStyle = "none";
      li.innerHTML = montarTextoHistorico({
        player: "Local",
        qtd,
        faces,
        results: resultados,
        total,
        nome_rolagem: nome,
        tipo_calculo: tipo,
        modificador: mod,
        created_at: new Date()
      });
      ul.prepend(li);
    }
  });
}

// =======================================================
// 7. CARREGADOR INICIAL
// =======================================================
window.addEventListener("DOMContentLoaded", () => {
  carregarHistorico();
  carregarStatusIniciais();
  inicializarEventosDeDigitacao();
  inicializarBotoesDeRolagem();
  inicializarRolagemLocal();
  ligarRealtimeDeStatus();
  ligarRealtimeDeDados();
});
