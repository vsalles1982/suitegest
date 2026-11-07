// mesas.js — Renderiza a grade de mesas do salão (Fase 6, dados mockados)
//
// TODO(Fase 6): substituir MOCK_TABLES por fetch para a rota do backend
// (ex.: GET http://localhost:3000/tables), mantendo renderTables() inalterado.

(function () {
  'use strict';

  // Dados mockados apenas para visualizar o layout. Shape planejado:
  // { id, number, status: 'livre' | 'ocupada' | 'reservada', capacity }
  var MOCK_TABLES = [
    { id: 1, number: 1, status: 'livre', capacity: 4 },
    { id: 2, number: 2, status: 'ocupada', capacity: 4 },
    { id: 3, number: 3, status: 'livre', capacity: 2 },
    { id: 4, number: 4, status: 'reservada', capacity: 6 },
    { id: 5, number: 5, status: 'ocupada', capacity: 2 },
    { id: 6, number: 6, status: 'livre', capacity: 6 },
    { id: 7, number: 7, status: 'livre', capacity: 4 },
    { id: 8, number: 8, status: 'ocupada', capacity: 8 }
  ];

  var grid = document.getElementById('tables-grid');
  var message = document.getElementById('tables-message');

  var STATUS_LABELS = {
    livre: 'Livre',
    ocupada: 'Ocupada',
    reservada: 'Reservada'
  };

  var STATUS_CLASSES = {
    livre: 'table-status table-status-free',
    ocupada: 'table-status table-status-occupied',
    reservada: 'table-status table-status-reserved'
  };

  function getField(table, fields) {
    for (var i = 0; i < fields.length; i++) {
      if (table && table[fields[i]] !== null && table[fields[i]] !== undefined && table[fields[i]] !== '') {
        return table[fields[i]];
      }
    }
    return '—';
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function hideMessage() {
    message.hidden = true;
  }

  function renderTables(tables) {
    while (grid.firstChild) {
      grid.removeChild(grid.firstChild);
    }

    if (!tables || tables.length === 0) {
      showMessage('Nenhuma mesa cadastrada');
      return;
    }

    hideMessage();

    tables.forEach(function (table) {
      var status = String(getField(table, ['status', 'situacao'])).toLowerCase();
      var statusLabel = STATUS_LABELS[status] || getField(table, ['status', 'situacao']);
      var capacity = getField(table, ['capacity', 'capacidade', 'seats']);

      var card = document.createElement('article');
      card.className = 'table-card';

      var title = document.createElement('h3');
      title.textContent = 'Mesa ' + getField(table, ['number', 'numero', 'id']);
      card.appendChild(title);

      var badge = document.createElement('span');
      badge.className = STATUS_CLASSES[status] || 'table-status';
      badge.textContent = statusLabel;
      card.appendChild(badge);

      var meta = document.createElement('p');
      meta.className = 'table-meta';
      meta.textContent = capacity === '—' ? 'Capacidade não informada' : 'Capacidade: ' + capacity + ' lugares';
      card.appendChild(meta);

      var detail = document.createElement('p');
      detail.className = 'table-detail';
      detail.textContent = status === 'ocupada'
        ? 'Em atendimento'
        : status === 'reservada'
          ? 'Aguardando clientes'
          : 'Disponível para abertura de comanda';
      card.appendChild(detail);

      grid.appendChild(card);
    });
  }

  function loadTables() {
    // Por enquanto usa dados mockados; na Fase 6, buscar do backend aqui.
    renderTables(MOCK_TABLES);
  }

  loadTables();
})();
