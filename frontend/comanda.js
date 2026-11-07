// comanda.js — Renderiza os itens de uma comanda (Fase 7, dados mockados)
//
// TODO(Fase 7): substituir MOCK_ORDER por fetch para
// GET http://localhost:3000/orders/:id, mantendo renderOrder() inalterado.

(function () {
  'use strict';

  // Dados mockados apenas para visualizar o layout. Shape planejado:
  // { id, tableNumber, status, items: [{ productName, quantity, unitPrice }] }
  // unitPrice em centavos (inteiro), mesmo contrato de price dos produtos.
  var MOCK_ORDER = {
    id: 1,
    tableNumber: 1,
    status: 'open',
    items: [
      { productName: 'Pizza Margherita', quantity: 1, unitPrice: 4500 },
      { productName: 'Refrigerante 2L', quantity: 2, unitPrice: 1200 },
      { productName: 'Borda Recheada', quantity: 1, unitPrice: 800 }
    ]
  };

  var itemsBody = document.getElementById('order-items-body');
  var message = document.getElementById('order-message');
  var tableNumberEl = document.getElementById('order-table-number');
  var statusEl = document.getElementById('order-status');
  var totalEl = document.getElementById('order-total');
  var totalCellEl = document.getElementById('order-total-cell');

  var STATUS_LABELS = {
    open: 'Aberta',
    closed: 'Fechada',
    aberta: 'Aberta',
    fechada: 'Fechada'
  };

  function getField(item, fields) {
    for (var i = 0; i < fields.length; i++) {
      if (item && item[fields[i]] !== null && item[fields[i]] !== undefined && item[fields[i]] !== '') {
        return item[fields[i]];
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

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function hideMessage() {
    message.hidden = true;
  }

  function renderOrder(order) {
    while (itemsBody.firstChild) {
      itemsBody.removeChild(itemsBody.firstChild);
    }

    var items = (order && order.items) || [];

    tableNumberEl.textContent = order ? String(getField(order, ['tableNumber', 'table_number', 'mesa'])) : '—';
    var status = order ? String(getField(order, ['status'])).toLowerCase() : '';
    statusEl.textContent = STATUS_LABELS[status] || (order ? getField(order, ['status']) : '—');

    if (items.length === 0) {
      totalEl.textContent = '—';
      totalCellEl.textContent = '—';
      showMessage('Nenhum item na comanda');
      return;
    }

    hideMessage();

    var totalCents = 0;

    items.forEach(function (item) {
      var quantity = toNumber(getField(item, ['quantity', 'quantidade', 'qty']));
      var unitPrice = toNumber(getField(item, ['unitPrice', 'precoUnitario', 'price']));
      var subtotal = getField(item, ['subtotal']) === '—' ? quantity * unitPrice : toNumber(getField(item, ['subtotal']));
      totalCents += subtotal;

      var row = document.createElement('tr');

      var productCell = document.createElement('td');
      productCell.textContent = getField(item, ['productName', 'product', 'name', 'nome', 'produto']);
      row.appendChild(productCell);

      var quantityCell = document.createElement('td');
      quantityCell.textContent = quantity;
      row.appendChild(quantityCell);

      var unitPriceCell = document.createElement('td');
      unitPriceCell.textContent = formatPrice(unitPrice);
      unitPriceCell.className = 'price-cell';
      row.appendChild(unitPriceCell);

      var subtotalCell = document.createElement('td');
      subtotalCell.textContent = formatPrice(subtotal);
      subtotalCell.className = 'price-cell';
      row.appendChild(subtotalCell);

      itemsBody.appendChild(row);
    });

    var formattedTotal = formatPrice(totalCents);
    totalEl.textContent = formattedTotal;
    totalCellEl.textContent = formattedTotal;
  }

  function loadOrder() {
    // Por enquanto usa dados mockados; na Fase 7, buscar do backend aqui.
    renderOrder(MOCK_ORDER);
  }

  loadOrder();
})();
