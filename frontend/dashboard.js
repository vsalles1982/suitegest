// dashboard.js — Indicadores de vendas (Bloco 5)

(function () {
  'use strict';

  var DASHBOARD_URL = 'http://localhost:3000/reports/dashboard';

  var message = document.getElementById('dashboard-message');
  var content = document.getElementById('dashboard-content');
  var totalVendidoEl = document.getElementById('total-vendido');
  var ticketMedioEl = document.getElementById('ticket-medio');
  var totalComandasEl = document.getElementById('total-comandas');
  var topItemsBody = document.getElementById('top-items-body');
  var byMethodBody = document.getElementById('by-method-body');

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
      totalCell.textContent = item.totalFormatted || formatPrice(item.total);
      totalCell.className = 'price-cell';
      row.appendChild(totalCell);

      topItemsBody.appendChild(row);
    });
  }

  function formatPercent(entry, totalValue) {
    if (entry.percentageFormatted) {
      return entry.percentageFormatted;
    }
    if (entry.percentFormatted) {
      return entry.percentFormatted;
    }
    if (entry.percent !== undefined && entry.percent !== null) {
      return toNumber(entry.percent).toLocaleString('pt-BR') + '%';
    }
    if (entry.percentage !== undefined && entry.percentage !== null) {
      return toNumber(entry.percentage).toLocaleString('pt-BR') + '%';
    }
    if (totalValue > 0 && entry.total !== undefined && entry.total !== null) {
      return ((toNumber(entry.total) / totalValue) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
    }
    return '—';
  }

  function renderByMethod(byMethod, totalValue) {
    while (byMethodBody.firstChild) {
      byMethodBody.removeChild(byMethodBody.firstChild);
    }

    (byMethod || []).forEach(function (entry) {
      var row = document.createElement('tr');

      var labelCell = document.createElement('td');
      labelCell.textContent = entry.label || entry.method;
      row.appendChild(labelCell);

      var totalCell = document.createElement('td');
      totalCell.textContent = entry.totalFormatted || formatPrice(entry.total);
      totalCell.className = 'price-cell';
      row.appendChild(totalCell);

      var percentCell = document.createElement('td');
      percentCell.textContent = formatPercent(entry, totalValue);
      row.appendChild(percentCell);

      byMethodBody.appendChild(row);
    });
  }

  function renderDashboard(data) {
    var dashboard = (data && data.dashboard) ? data.dashboard : data;

    totalVendidoEl.textContent = dashboard.totalFormatted || formatPrice(dashboard.total);
    ticketMedioEl.textContent = dashboard.averageTicketFormatted || formatPrice(dashboard.averageTicket);
    totalComandasEl.textContent = dashboard.ordersCount !== undefined && dashboard.ordersCount !== null
      ? String(dashboard.ordersCount)
      : '—';

    renderTopItems(dashboard.topItems);
    renderByMethod(dashboard.byMethod, toNumber(dashboard.total));

    hideMessage();
    content.hidden = false;
  }

  function loadDashboard() {
    showMessage('Carregando dashboard…');
    content.hidden = true;

    fetch(DASHBOARD_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        renderDashboard(data);
      })
      .catch(function () {
        content.hidden = true;
        showMessage('Erro ao carregar dashboard. Verifique se o backend está online.');
      });
  }

  loadDashboard();
})();
