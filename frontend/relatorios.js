// relatorios.js — Carrega e renderiza o resumo de vendas (Bloco 2)

(function () {
  'use strict';

  var REPORTS_URL = 'http://localhost:3000/reports/summary';

  var message = document.getElementById('reports-message');
  var content = document.getElementById('reports-content');
  var totalVendidoEl = document.getElementById('total-vendido');
  var ticketMedioEl = document.getElementById('ticket-medio');
  var totalComandasEl = document.getElementById('total-comandas');
  var topItemsBody = document.getElementById('top-items-body');
  var byMethodBody = document.getElementById('by-method-body');

  function getField(data, fields) {
    for (var i = 0; i < fields.length; i++) {
      if (data && data[fields[i]] !== null && data[fields[i]] !== undefined && data[fields[i]] !== '') {
        return data[fields[i]];
      }
    }
    return '—';
  }

  function toNumber(value) {
    var number = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(number) ? 0 : number;
  }

  // Inteiro = centavos (contrato do backend); decimal = reais (legado).
  function formatPrice(value) {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    var number = toNumber(value);
    var reais = Number.isInteger(number) ? number / 100 : number;
    return reais.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  function formatMoney(data, valueFields, formattedFields) {
    var formatted = getField(data, formattedFields);
    if (formatted !== '—') {
      return formatted;
    }
    var value = getField(data, valueFields);
    return value === '—' ? '—' : formatPrice(value);
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function hideMessage() {
    message.hidden = true;
  }

  function renderTopItems(items) {
    while (topItemsBody.firstChild) {
      topItemsBody.removeChild(topItemsBody.firstChild);
    }

    (items || []).forEach(function (item) {
      var row = document.createElement('tr');

      var productCell = document.createElement('td');
      productCell.textContent = item.productName;
      row.appendChild(productCell);

      var quantityCell = document.createElement('td');
      quantityCell.textContent = item.quantity;
      row.appendChild(quantityCell);

      var totalCell = document.createElement('td');
      totalCell.textContent = item.totalFormatted;
      totalCell.className = 'price-cell';
      row.appendChild(totalCell);

      topItemsBody.appendChild(row);
    });
  }

  function renderByMethod(byMethod) {
    while (byMethodBody.firstChild) {
      byMethodBody.removeChild(byMethodBody.firstChild);
    }

    (byMethod || []).forEach(function (entry) {
      var row = document.createElement('tr');

      var labelCell = document.createElement('td');
      labelCell.textContent = entry.label;
      row.appendChild(labelCell);

      var totalCell = document.createElement('td');
      totalCell.textContent = entry.totalFormatted;
      totalCell.className = 'price-cell';
      row.appendChild(totalCell);

      byMethodBody.appendChild(row);
    });
  }

  function renderSummary(data) {
    var summary = (data && data.summary) ? data.summary : data;

    totalVendidoEl.textContent = summary.totalFormatted || '—';
    ticketMedioEl.textContent = formatMoney(
      summary,
      ['averageTicket', 'ticketMedio', 'ticketAverage', 'averageOrderValue'],
      ['averageTicketFormatted', 'ticketMedioFormatted', 'ticketAverageFormatted']
    );
    totalComandasEl.textContent = summary.ordersCount !== undefined && summary.ordersCount !== null
      ? String(summary.ordersCount)
      : '—';

    renderByMethod(summary.byMethod);
    renderTopItems(summary.topItems);

    hideMessage();
    content.hidden = false;
  }

  function loadSummary() {
    showMessage('Carregando relatórios…');
    content.hidden = true;

    fetch(REPORTS_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        renderSummary(data);
      })
      .catch(function () {
        content.hidden = true;
        showMessage('Erro ao carregar relatórios. Verifique se o backend está online.');
      });
  }

  loadSummary();
})();
