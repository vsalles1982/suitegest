// cardapio.js — Carrega e renderiza os produtos do Cardápio

(function () {
  'use strict';

  var PRODUCTS_URL = 'http://localhost:3000/products';

  var message = document.getElementById('products-message');
  var tableWrapper = document.getElementById('products-table-wrapper');
  var tableBody = document.getElementById('products-body');

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function hideMessage() {
    message.hidden = true;
  }

  function formatPrice(price) {
    if (price === null || price === undefined || price === '') {
      return '—';
    }

    var value = typeof price === 'number' ? price : Number(price);
    if (!Number.isNaN(value)) {
      return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    }

    return String(price);
  }

  function getField(product, fields) {
    for (var i = 0; i < fields.length; i++) {
      if (product && product[fields[i]] !== null && product[fields[i]] !== undefined && product[fields[i]] !== '') {
        return product[fields[i]];
      }
    }
    return '—';
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

  function renderProducts(products) {
    // Limpa linhas anteriores (renderização via textContent, sem innerHTML).
    while (tableBody.firstChild) {
      tableBody.removeChild(tableBody.firstChild);
    }

    products.forEach(function (product) {
      var row = document.createElement('tr');

      var values = [
        getField(product, ['name', 'nome', 'title', 'titulo']),
        getField(product, ['category', 'categoria']),
        formatPrice(getField(product, ['price', 'preco', 'valor']) === '—' ? '' : getField(product, ['price', 'preco', 'valor'])),
        getField(product, ['description', 'descricao'])
      ];

      values.forEach(function (value, index) {
        var cell = document.createElement('td');
        cell.textContent = value;
        if (index === 2) {
          cell.className = 'price-cell';
        }
        row.appendChild(cell);
      });

      tableBody.appendChild(row);
    });

    hideMessage();
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

        if (products.length === 0) {
          tableWrapper.hidden = true;
          showMessage('Nenhum produto cadastrado');
          return;
        }

        renderProducts(products);
      })
      .catch(function () {
        tableWrapper.hidden = true;
        showMessage('Erro ao carregar produtos. Verifique se o backend está online.');
      });
  }

  loadProducts();
})();
