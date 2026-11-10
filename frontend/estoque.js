// estoque.js — Lista produtos e ajusta o estoque (Bloco 4)

(function () {
  'use strict';

  var PRODUCTS_URL = 'http://localhost:3000/products';

  // Estoque mínimo padrão usado quando o produto não traz o mínimo.
  var DEFAULT_MIN_STOCK = 5;

  var message = document.getElementById('stock-message');
  var tableWrapper = document.getElementById('stock-table-wrapper');
  var tableBody = document.getElementById('stock-body');
  var form = document.getElementById('stock-form');
  var productSelect = document.getElementById('productId');
  var productsMessage = document.getElementById('products-message');

  function getField(product, fields) {
    for (var i = 0; i < fields.length; i++) {
      if (product && product[fields[i]] !== null && product[fields[i]] !== undefined && product[fields[i]] !== '') {
        return product[fields[i]];
      }
    }
    return '—';
  }

  function getStock(product) {
    return getField(product, ['stock', 'estoque', 'stockQuantity', 'quantity', 'quantidade']);
  }

  function getMinStock(product) {
    var min = getField(product, ['minStock', 'minimumStock', 'estoqueMinimo', 'minQuantity', 'lowStockThreshold']);
    return min === '—' ? DEFAULT_MIN_STOCK : Number(min);
  }

  function isLowStock(product) {
    var stock = getStock(product);
    if (stock === '—') {
      return false;
    }
    return Number(stock) < getMinStock(product);
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function hideMessage() {
    message.hidden = true;
  }

  function showProductsMessage(text) {
    if (!productsMessage) {
      return;
    }
    productsMessage.textContent = text;
    productsMessage.hidden = !text;
  }

  function normalizeList(data) {
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

  function fillProductSelect(products) {
    while (productSelect.firstChild) {
      productSelect.removeChild(productSelect.firstChild);
    }

    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione um produto';
    productSelect.appendChild(placeholder);

    products.forEach(function (product) {
      var option = document.createElement('option');
      option.value = getField(product, ['id']);
      option.textContent = getField(product, ['name', 'nome']);
      productSelect.appendChild(option);
    });
  }

  function adjustStock(productId, stock) {
    return fetch(PRODUCTS_URL + '/' + productId + '/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: stock })
    })
      .then(function (response) {
        if (response.status === 200) {
          return null;
        }
        return response.json().catch(function () { return null; }).then(function (data) {
          throw new Error((data && data.error) || ('Erro ao ajustar estoque (HTTP ' + response.status + ').'));
        });
      });
  }

  function adjustStockPrompt(product) {
    var current = getStock(product);
    var name = getField(product, ['name', 'nome']);

    openModal({
      title: 'Ajustar estoque',
      description: 'Informe a nova quantidade em estoque de ' + name +
        (current === '—' ? '.' : ' (atual: ' + current + ').'),
      fields: [
        {
          name: 'stock',
          label: 'Nova quantidade em estoque',
          type: 'number',
          required: true,
          min: 0,
          step: 1,
          value: current === '—' ? 0 : current
        }
      ],
      submitLabel: 'Ajustar estoque'
    }).then(function (values) {
      if (!values) {
        return;
      }

      var stock = Number(values.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        showToast('Informe um valor inteiro maior ou igual a zero.', 'error');
        return;
      }

      adjustStock(getField(product, ['id']), stock)
        .then(function () {
          showToast('Estoque ajustado', 'success');
          loadProducts();
        })
        .catch(function (error) {
          showToast(error.message || 'Erro ao ajustar estoque. Verifique se o backend está online.', 'error');
        });
    });
  }

  function renderProducts(products) {
    while (tableBody.firstChild) {
      tableBody.removeChild(tableBody.firstChild);
    }

    if (!products || products.length === 0) {
      tableWrapper.hidden = true;
      showMessage('Nenhum produto cadastrado');
      return;
    }

    hideMessage();

    products.forEach(function (product) {
      var row = document.createElement('tr');

      var nameCell = document.createElement('td');
      nameCell.textContent = getField(product, ['name', 'nome']);
      row.appendChild(nameCell);

      var stockCell = document.createElement('td');
      var stock = getStock(product);
      stockCell.textContent = stock === '—' ? '—' : String(stock);
      row.appendChild(stockCell);

      var minCell = document.createElement('td');
      minCell.textContent = String(getMinStock(product));
      row.appendChild(minCell);

      var statusCell = document.createElement('td');
      if (isLowStock(product)) {
        var badge = document.createElement('span');
        badge.className = 'low-stock-badge';
        badge.textContent = 'Estoque baixo';
        statusCell.appendChild(badge);
      } else {
        statusCell.textContent = stock === '—' ? '—' : 'OK';
      }
      row.appendChild(statusCell);

      var actionsCell = document.createElement('td');
      var adjustButton = document.createElement('button');
      adjustButton.type = 'button';
      adjustButton.className = 'release-button';
      adjustButton.textContent = 'Ajustar Estoque';
      adjustButton.addEventListener('click', function () {
        adjustStockPrompt(product);
      });
      actionsCell.appendChild(adjustButton);
      row.appendChild(actionsCell);

      tableBody.appendChild(row);
    });

    tableWrapper.hidden = false;
  }

  function loadProducts() {
    showMessage('Carregando produtos…');
    tableWrapper.hidden = true;

    fetch(PRODUCTS_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        var products = normalizeList(data);
        fillProductSelect(products);
        productSelect.disabled = products.length === 0;
        showProductsMessage(products.length === 0 ? 'Nenhum produto cadastrado' : '');
        renderProducts(products);
      })
      .catch(function () {
        tableWrapper.hidden = true;
        showProductsMessage('Erro ao carregar produtos. Verifique se o backend está online.');
        showMessage('Erro ao carregar produtos. Verifique se o backend está online.');
      });
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var productId = Number(document.getElementById('productId').value);
      var stock = Number(document.getElementById('stock').value);

      if (!Number.isInteger(stock) || stock < 0) {
        showToast('Quantidade inválida', 'error');
        return;
      }

      adjustStock(productId, stock)
        .then(function () {
          form.reset();
          showToast('Estoque ajustado', 'success');
          loadProducts();
        })
        .catch(function (error) {
          showToast(error.message || 'Erro ao ajustar estoque. Verifique se o backend está online.', 'error');
        });
    });
  }

  loadProducts();
})();
