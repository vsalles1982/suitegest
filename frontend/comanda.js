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
  var closeButton = document.getElementById('close-order-button');
  var addItemButton = document.getElementById('add-item-button');
  var addItemModal = document.getElementById('add-item-modal');
  var addItemForm = document.getElementById('add-item-form');
  var productSelect = document.getElementById('productId');
  var productsMessage = document.getElementById('products-message');
  var cancelAddItemButton = document.getElementById('cancel-add-item');

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

  function renderOrder(order) {
    while (itemsBody.firstChild) {
      itemsBody.removeChild(itemsBody.firstChild);
    }

    var items = getItems(order);

    tableNumberEl.textContent = order ? String(getTableNumber(order)) : '—';
    var status = order ? String(getField(order, ['status'])).toLowerCase() : '';
    statusEl.textContent = STATUS_LABELS[status] || (order ? getField(order, ['status']) : '—');

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

  if (closeButton) {
    closeButton.addEventListener('click', function () {
      if (!orderId) {
        alert('Comanda não informada');
        return;
      }

      fetch(ORDERS_URL + '/' + orderId + '/close', {
        method: 'POST'
      })
        .then(function (response) {
          if (response.status === 200) {
            window.location.href = 'mesas.html';
            return null;
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

  loadOrder();
})();
