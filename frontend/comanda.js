// comanda.js — Carrega e renderiza os itens de uma comanda (Fase 7)

(function () {
  'use strict';

  var ORDERS_URL = 'http://localhost:3000/orders';
  var PRODUCTS_URL = 'http://localhost:3000/products';

  var params = new URLSearchParams(window.location.search);
  var orderId = params.get('id');

  var itemsBody = document.getElementById('order-items-body');
  var message = document.getElementById('order-message');
  var tableNumberEl = document.getElementById('order-table-number');
  var statusEl = document.getElementById('order-status');
  var totalEl = document.getElementById('order-total');
  var totalCellEl = document.getElementById('order-total-cell');
  var paymentEl = document.getElementById('order-payment');
  var closeButton = document.getElementById('close-order-button');
  var addItemButton = document.getElementById('add-item-button');
  var addItemModal = document.getElementById('add-item-modal');
  var addItemForm = document.getElementById('add-item-form');
  var productSelect = document.getElementById('productId');
  var productsMessage = document.getElementById('products-message');
  var cancelAddItemButton = document.getElementById('cancel-add-item');
  var paymentModal = document.getElementById('payment-modal');
  var paymentForm = document.getElementById('payment-form');
  var paymentMethodSelect = document.getElementById('payment-method');
  var cancelPaymentButton = document.getElementById('cancel-payment');
  var printReceiptButton = document.getElementById('print-receipt-button');

  var lastOrder = null;

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

  function getItems(order) {
    if (!order) {
      return [];
    }
    if (Array.isArray(order.items)) {
      return order.items;
    }
    if (Array.isArray(order.orderItems)) {
      return order.orderItems;
    }
    if (Array.isArray(order.order_items)) {
      return order.order_items;
    }
    return [];
  }

  function getTableNumber(order) {
    if (order && order.table && typeof order.table === 'object') {
      return getField(order.table, ['number', 'numero', 'id']);
    }
    return getField(order, ['tableNumber', 'table_number', 'tableId', 'table_id', 'mesa']);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderOrder(order) {
    lastOrder = order || null;

    while (itemsBody.firstChild) {
      itemsBody.removeChild(itemsBody.firstChild);
    }

    var items = getItems(order);

    tableNumberEl.textContent = order ? String(getTableNumber(order)) : '—';
    var status = order ? String(getField(order, ['status'])).toLowerCase() : '';
    statusEl.textContent = STATUS_LABELS[status] || (order ? getField(order, ['status']) : '—');
    paymentEl.textContent = (order && order.payment && order.payment.methodLabel)
      ? 'Pago com ' + order.payment.methodLabel
      : '—';
    if (printReceiptButton) {
      printReceiptButton.hidden = !(order && order.payment);
    }

    if (items.length === 0) {
      var emptyTotal = getField(order, ['total', 'totalFormatted']);
      totalEl.textContent = emptyTotal === '—' ? '—' : (order.totalFormatted || formatPrice(emptyTotal));
      totalCellEl.textContent = totalEl.textContent;
      showMessage('Nenhum item na comanda');
      return;
    }

    hideMessage();

    var totalCents = 0;

    items.forEach(function (item) {
      var quantity = toNumber(getField(item, ['quantity', 'quantidade', 'qty']));
      var unitPrice = toNumber(getField(item, ['unitPrice', 'unit_price', 'precoUnitario', 'price']));
      var subtotal = getField(item, ['subtotal']) === '—' ? quantity * unitPrice : toNumber(getField(item, ['subtotal']));
      totalCents += subtotal;

      var row = document.createElement('tr');

      var productCell = document.createElement('td');
      productCell.textContent = getField(item, ['productName', 'product_name', 'product', 'name', 'nome', 'produto']);
      row.appendChild(productCell);

      var quantityCell = document.createElement('td');
      quantityCell.textContent = quantity;
      row.appendChild(quantityCell);

      var unitPriceCell = document.createElement('td');
      unitPriceCell.textContent = item.unitPriceFormatted || item.priceFormatted || formatPrice(unitPrice);
      unitPriceCell.className = 'price-cell';
      row.appendChild(unitPriceCell);

      var subtotalCell = document.createElement('td');
      subtotalCell.textContent = item.subtotalFormatted || formatPrice(subtotal);
      subtotalCell.className = 'price-cell';
      row.appendChild(subtotalCell);

      itemsBody.appendChild(row);
    });

    var serverTotal = getField(order, ['total']);
    var formattedTotal = order && order.totalFormatted
      ? order.totalFormatted
      : formatPrice(serverTotal === '—' ? totalCents : serverTotal);
    totalEl.textContent = formattedTotal;
    totalCellEl.textContent = formattedTotal;
  }

  function clearOrder() {
    while (itemsBody.firstChild) {
      itemsBody.removeChild(itemsBody.firstChild);
    }
    tableNumberEl.textContent = '—';
    statusEl.textContent = '—';
    totalEl.textContent = '—';
    totalCellEl.textContent = '—';
    paymentEl.textContent = '—';
    lastOrder = null;
    if (printReceiptButton) {
      printReceiptButton.hidden = true;
    }
  }

  function normalizeProducts(data) {
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.products)) {
      return data.products;
    }
    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    if (data && Array.isArray(data.items)) {
      return data.items;
    }
    return [];
  }

  function showProductsMessage(text) {
    if (!productsMessage) {
      return;
    }
    productsMessage.textContent = text;
    productsMessage.hidden = !text;
  }

  function loadProducts() {
    if (!productSelect) {
      return;
    }

    showProductsMessage('');
    productSelect.disabled = true;
    while (productSelect.firstChild) {
      productSelect.removeChild(productSelect.firstChild);
    }
    var loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = 'Carregando produtos…';
    productSelect.appendChild(loadingOption);

    fetch(PRODUCTS_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        var products = normalizeProducts(data);
        while (productSelect.firstChild) {
          productSelect.removeChild(productSelect.firstChild);
        }

        if (products.length === 0) {
          var emptyOption = document.createElement('option');
          emptyOption.value = '';
          emptyOption.textContent = 'Nenhum produto cadastrado';
          productSelect.appendChild(emptyOption);
          productSelect.disabled = true;
          showProductsMessage('Nenhum produto cadastrado');
          return;
        }

        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Selecione um produto';
        productSelect.appendChild(placeholder);

        products.forEach(function (product) {
          var option = document.createElement('option');
          option.value = getField(product, ['id', 'productId']);
          var priceLabel = product.priceFormatted
            ? ' — ' + product.priceFormatted
            : (getField(product, ['price']) === '—' ? '' : ' — ' + formatPrice(product.price));
          option.textContent = getField(product, ['name', 'nome']) + priceLabel;
          productSelect.appendChild(option);
        });

        productSelect.disabled = false;
      })
      .catch(function () {
        while (productSelect.firstChild) {
          productSelect.removeChild(productSelect.firstChild);
        }
        var errorOption = document.createElement('option');
        errorOption.value = '';
        errorOption.textContent = 'Erro ao carregar produtos';
        productSelect.appendChild(errorOption);
        productSelect.disabled = true;
        showProductsMessage('Erro ao carregar produtos. Verifique se o backend está online.');
      });
  }

  function openAddItemModal() {
    addItemModal.hidden = false;
    loadProducts();
  }

  function closeAddItemModal() {
    addItemModal.hidden = true;
    if (addItemForm) {
      addItemForm.reset();
    }
  }

  function loadOrder() {
    if (!orderId) {
      clearOrder();
      showMessage('Comanda não informada');
      return;
    }

    showMessage('Carregando comanda…');

    fetch(ORDERS_URL + '/' + orderId)
      .then(function (response) {
        if (response.status === 404) {
          throw new Error('Comanda não encontrada');
        }
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        renderOrder(data && data.order ? data.order : data);
      })
      .catch(function (error) {
        clearOrder();
        showMessage(error.message === 'Comanda não encontrada'
          ? 'Comanda não encontrada'
          : 'Erro ao carregar comanda. Verifique se o backend está online.');
      });
  }

  function openPaymentModal() {
    paymentModal.hidden = false;
  }

  function closePaymentModal() {
    paymentModal.hidden = true;
    if (paymentForm) {
      paymentForm.reset();
    }
  }

  if (closeButton && paymentModal) {
    closeButton.addEventListener('click', function () {
      if (!orderId) {
        alert('Comanda não informada');
        return;
      }
      openPaymentModal();
    });
  }

  if (cancelPaymentButton && paymentModal) {
    cancelPaymentButton.addEventListener('click', closePaymentModal);
  }

  if (paymentModal) {
    paymentModal.addEventListener('click', function (event) {
      if (event.target === paymentModal) {
        closePaymentModal();
      }
    });
  }

  if (paymentForm) {
    paymentForm.addEventListener('submit', function (event) {
      event.preventDefault();

      if (!orderId) {
        alert('Comanda não informada');
        return;
      }

      var paymentMethod = paymentMethodSelect.value;

      fetch(ORDERS_URL + '/' + orderId + '/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: paymentMethod })
      })
        .then(function (response) {
          if (response.status === 200) {
            return response.json().catch(function () { return null; }).then(function (data) {
              closePaymentModal();
              // Atualiza a tela com a comanda fechada (inclui payment) e
              // exibe o botão "Imprimir Cupom" (ver renderOrder).
              renderOrder(data && data.order ? data.order : data);
              return null;
            });
          }
          return response.json().catch(function () { return null; }).then(function (data) {
            alert((data && data.error) || ('Erro ao fechar comanda (HTTP ' + response.status + ').'));
            return null;
          });
        })
        .catch(function () {
          alert('Erro ao fechar comanda. Verifique se o backend está online.');
        });
    });
  }

  if (addItemButton && addItemModal) {
    addItemButton.addEventListener('click', openAddItemModal);
  }

  if (cancelAddItemButton && addItemModal) {
    cancelAddItemButton.addEventListener('click', closeAddItemModal);
  }

  if (addItemModal) {
    addItemModal.addEventListener('click', function (event) {
      if (event.target === addItemModal) {
        closeAddItemModal();
      }
    });
  }

  if (addItemForm) {
    addItemForm.addEventListener('submit', function (event) {
      event.preventDefault();

      if (!orderId) {
        alert('Comanda não informada');
        return;
      }

      var productId = Number(document.getElementById('productId').value);
      var quantity = Number(document.getElementById('quantity').value);

      fetch(ORDERS_URL + '/' + orderId + '/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: productId, quantity: quantity })
      })
        .then(function (response) {
          if (response.status === 201) {
            closeAddItemModal();
            loadOrder();
            return null;
          }
          return response.json().catch(function () { return null; }).then(function (data) {
            alert((data && data.error) || ('Erro ao adicionar item (HTTP ' + response.status + ').'));
            return null;
          });
        })
        .catch(function () {
          alert('Erro ao adicionar item. Verifique se o backend está online.');
        });
    });
  }

  function buildReceiptHtml(order) {
    var items = getItems(order);
    var lines = items.map(function (item) {
      var quantity = toNumber(getField(item, ['quantity', 'quantidade', 'qty']));
      var name = getField(item, ['productName', 'product_name', 'product', 'name', 'nome', 'produto']);
      var subtotal = getField(item, ['subtotal']) === '—'
        ? formatPrice(quantity * toNumber(getField(item, ['unitPrice', 'unit_price', 'precoUnitario', 'price'])))
        : (item.subtotalFormatted || formatPrice(item.subtotal));
      return '<tr><td>' + escapeHtml(name) + '</td><td>' + quantity + '</td><td>' + escapeHtml(subtotal) + '</td></tr>';
    }).join('');

    var paymentLabel = (order && order.payment)
      ? (order.payment.methodLabel || order.payment.method || '')
      : '';
    var total = (order && order.totalFormatted) ? order.totalFormatted : formatPrice(order && order.total);

    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" />' +
      '<title>Cupom — Comanda ' + escapeHtml(orderId) + '</title>' +
      '<style>body{font-family:monospace;max-width:400px;margin:20px auto;color:#111}' +
      'h1{font-size:18px;text-align:center}table{width:100%;border-collapse:collapse}' +
      'td,th{padding:4px 0;text-align:left}th{border-bottom:1px solid #111}' +
      '.total{font-weight:bold;text-align:right;margin-top:8px}' +
      '.center{text-align:center}</style></head><body>' +
      '<h1>SuiteSimulaFuncoes</h1>' +
      '<p class="center">Cupom não fiscal</p>' +
      '<p>Comanda: ' + escapeHtml(orderId) + ' &middot; Mesa: ' + escapeHtml(getTableNumber(order)) + '</p>' +
      '<table><thead><tr><th>Produto</th><th>Qtd</th><th>Subtotal</th></tr></thead>' +
      '<tbody>' + lines + '</tbody></table>' +
      '<p class="total">Total: ' + escapeHtml(total) + '</p>' +
      (paymentLabel ? '<p>Pagamento: ' + escapeHtml(paymentLabel) + '</p>' : '') +
      '<p class="center">Obrigado pela preferência!</p>' +
      '</body></html>';
  }

  if (printReceiptButton) {
    printReceiptButton.addEventListener('click', function () {
      var receiptWindow = window.open('', '_blank');
      if (!receiptWindow) {
        alert('Permita pop-ups para imprimir o cupom.');
        return;
      }
      receiptWindow.document.write(buildReceiptHtml(lastOrder || {}));
      receiptWindow.document.close();
      receiptWindow.print();
    });
  }

  loadOrder();
})();
