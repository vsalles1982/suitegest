// mesas.js — Carrega e renderiza a grade de mesas do salão (Fase 6)

(function () {
  'use strict';

  var TABLES_URL = 'http://localhost:3000/tables';

  var grid = document.getElementById('tables-grid');
  var message = document.getElementById('tables-message');
  var addButton = document.getElementById('add-table-button');

  // Status do backend (EN) -> rótulo em português. Mantém compatibilidade
  // com rótulos legados em português (livre/ocupada/reservada).
  var STATUS_LABELS = {
    free: 'Livre',
    occupied: 'Ocupada',
    closed: 'Fechada',
    livre: 'Livre',
    ocupada: 'Ocupada',
    reservada: 'Reservada'
  };

  var STATUS_CLASSES = {
    free: 'table-status table-status-free',
    occupied: 'table-status table-status-occupied',
    closed: 'table-status table-status-closed',
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

  function normalizeList(data) {
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.tables)) {
      return data.tables;
    }
    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    if (data && Array.isArray(data.items)) {
      return data.items;
    }
    return [];
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
      card.dataset.id = String(getField(table, ['id']));
      card.dataset.status = status;

      card.addEventListener('click', function () {
        if (status === 'occupied' || status === 'ocupada') {
          window.location.href = 'comanda.html?id=' + getField(table, ['id']);
        } else if (status === 'free' || status === 'livre') {
          // Mesa livre: pedir o item a adicionar (a abertura da comanda
          // via POST /orders entra em etapa posterior da Fase 7).
          prompt('Informe o item a adicionar à Mesa ' + getField(table, ['number', 'numero', 'id']) + ':');
        }
      });

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
      detail.textContent = (status === 'occupied' || status === 'ocupada')
        ? 'Em atendimento'
        : status === 'closed'
          ? 'Fechada para limpeza/manutenção'
          : status === 'reservada'
            ? 'Aguardando clientes'
            : 'Disponível para abertura de comanda';
      card.appendChild(detail);

      // Mesa fechada: oferece liberar para o status "free".
      if (status === 'closed') {
        var releaseButton = document.createElement('button');
        releaseButton.type = 'button';
        releaseButton.className = 'release-button';
        releaseButton.textContent = 'Liberar Mesa';
        releaseButton.addEventListener('click', function (event) {
          event.stopPropagation();

          fetch(TABLES_URL + '/' + getField(table, ['id']) + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'free' })
          })
            .then(function (response) {
              if (response.status === 200) {
                loadTables();
                return null;
              }
              return response.json().catch(function () { return null; }).then(function (data) {
                alert((data && data.error) || ('Erro ao liberar mesa (HTTP ' + response.status + ').'));
                return null;
              });
            })
            .catch(function () {
              alert('Erro ao liberar mesa. Verifique se o backend está online.');
            });
        });
        card.appendChild(releaseButton);
      }

      grid.appendChild(card);
    });
  }

  function loadTables() {
    showMessage('Carregando mesas…');

    fetch(TABLES_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        renderTables(normalizeList(data));
      })
      .catch(function () {
        while (grid.firstChild) {
          grid.removeChild(grid.firstChild);
        }
        showMessage('Erro ao carregar mesas. Verifique se o backend está online.');
      });
  }

  if (addButton) {
    addButton.addEventListener('click', function () {
      var input = prompt('Informe o número da mesa:');
      if (input === null) {
        return;
      }

      var number = Number(input);

      fetch(TABLES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: number })
      })
        .then(function (response) {
          if (response.status === 201) {
            loadTables();
            return null;
          }
          if (response.status === 409) {
            alert('Mesa já cadastrada');
            return null;
          }
          if (response.status === 400) {
            alert('Número inválido');
            return null;
          }
          return response.json().catch(function () { return null; }).then(function (data) {
            alert((data && data.error) || ('Erro ao cadastrar mesa (HTTP ' + response.status + ').'));
            return null;
          });
        })
        .catch(function () {
          alert('Erro ao cadastrar mesa. Verifique se o backend está online.');
        });
    });
  }

  loadTables();
})();
