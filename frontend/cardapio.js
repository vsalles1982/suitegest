// cardapio.js — Carrega e renderiza os produtos do Cardápio

(function () {
  'use strict';

  var PRODUCTS_URL = 'http://localhost:3000/products';
  var CATEGORIES_URL = 'http://localhost:3000/categories';

  var message = document.getElementById('products-message');
  var tableWrapper = document.getElementById('products-table-wrapper');
  var tableBody = document.getElementById('products-body');
  var form = document.getElementById('product-form');
  var categorySelect = document.getElementById('categoryId');
  var categoriesMessage = document.getElementById('categories-message');

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function hideMessage() {
    message.hidden = true;
  }

  function formatPrice(product) {
    // O backend retorna price em centavos (inteiro) + priceFormatted pronta.
    if (product && product.priceFormatted) {
      return product.priceFormatted;
    }

    var price = product ? product.price : product;
    if (price === null || price === undefined || price === '') {
      return '—';
    }

    var value = typeof price === 'number' ? price : Number(price);
    if (!Number.isNaN(value)) {
      // Inteiro = centavos (contrato atual do backend); decimal = reais (legado).
      var reais = Number.isInteger(value) ? value / 100 : value;
      return reais.toLocaleString('pt-BR', {
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

  function normalizeCategories(data) {
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.categories)) {
      return data.categories;
    }
    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    if (data && Array.isArray(data.items)) {
      return data.items;
    }
    return [];
  }

  function clearSelect() {
    while (categorySelect.firstChild) {
      categorySelect.removeChild(categorySelect.firstChild);
    }
  }

  function showCategoriesMessage(text) {
    if (!categoriesMessage) {
      return;
    }
    categoriesMessage.textContent = text;
    categoriesMessage.hidden = !text;
  }

  function loadCategories() {
    if (!categorySelect) {
      return;
    }

    showCategoriesMessage('');
    categorySelect.disabled = true;
    clearSelect();
    var loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = 'Carregando categorias…';
    categorySelect.appendChild(loadingOption);

    fetch(CATEGORIES_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        var categories = normalizeCategories(data);

        clearSelect();

        if (categories.length === 0) {
          var emptyOption = document.createElement('option');
          emptyOption.value = '';
          emptyOption.textContent = 'Nenhuma categoria cadastrada';
          categorySelect.appendChild(emptyOption);
          categorySelect.disabled = true;
          showCategoriesMessage('Nenhuma categoria cadastrada');
          return;
        }

        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Selecione uma categoria';
        categorySelect.appendChild(placeholder);

        categories.forEach(function (category) {
          var option = document.createElement('option');
          option.value = getField(category, ['id', 'categoryId']);
          option.textContent = getField(category, ['name', 'nome']);
          categorySelect.appendChild(option);
        });

        categorySelect.disabled = false;
      })
      .catch(function () {
        clearSelect();
        var errorOption = document.createElement('option');
        errorOption.value = '';
        errorOption.textContent = 'Erro ao carregar categorias';
        categorySelect.appendChild(errorOption);
        categorySelect.disabled = true;
        showCategoriesMessage('Erro ao carregar categorias. Verifique se o backend está online.');
      });
  }

  // Estoque mínimo padrão usado quando o produto não traz o mínimo.
  var DEFAULT_MIN_STOCK = 5;

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

  function adjustStock(product) {
    var current = getStock(product);
    var input = prompt(
      'Informe a nova quantidade em estoque de ' + getField(product, ['name', 'nome']) +
      (current === '—' ? ':' : ' (atual: ' + current + '):')
    );
    if (input === null) {
      return;
    }

    var stock = Number(input);
    if (!Number.isInteger(stock) || stock < 0) {
      alert('Quantidade inválida');
      return;
    }

    fetch(PRODUCTS_URL + '/' + getField(product, ['id']) + '/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: stock })
    })
      .then(function (response) {
        if (response.status === 200) {
          loadProducts();
          return null;
        }
        return response.json().catch(function () { return null; }).then(function (data) {
          alert((data && data.error) || ('Erro ao ajustar estoque (HTTP ' + response.status + ').'));
          return null;
        });
      })
      .catch(function () {
        alert('Erro ao ajustar estoque. Verifique se o backend está online.');
      });
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
        getField(product, ['categoryName', 'categoryId', 'category', 'categoria']),
        formatPrice(product)
      ];

      values.forEach(function (value, index) {
        var cell = document.createElement('td');
        cell.textContent = value;
        if (index === 2) {
          cell.className = 'price-cell';
        }
        row.appendChild(cell);
      });

      var stockCell = document.createElement('td');
      var stock = getStock(product);
      stockCell.textContent = stock === '—' ? '—' : String(stock);
      if (isLowStock(product)) {
        var badge = document.createElement('span');
        badge.className = 'low-stock-badge';
        badge.textContent = 'Estoque baixo';
        stockCell.appendChild(document.createTextNode(' '));
        stockCell.appendChild(badge);
      }
      row.appendChild(stockCell);

      var descriptionCell = document.createElement('td');
      descriptionCell.textContent = getField(product, ['description', 'descricao']);
      row.appendChild(descriptionCell);

      var actionsCell = document.createElement('td');
      var adjustButton = document.createElement('button');
      adjustButton.type = 'button';
      adjustButton.className = 'release-button';
      adjustButton.textContent = 'Ajustar Estoque';
      adjustButton.addEventListener('click', function () {
        adjustStock(product);
      });
      actionsCell.appendChild(adjustButton);
      row.appendChild(actionsCell);

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

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var name = document.getElementById('name').value.trim();
      var price = Number(document.getElementById('price').value);
      var categoryId = Number(document.getElementById('categoryId').value);

      fetch(PRODUCTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, price: price, categoryId: categoryId })
      })
        .then(function (response) {
          if (response.status === 201) {
            form.reset();
            loadProducts();
            return null;
          }
          return response.json().catch(function () { return null; }).then(function (data) {
            throw new Error((data && data.error) || ('Erro ao cadastrar produto (HTTP ' + response.status + ').'));
          });
        })
        .catch(function (error) {
          alert(error.message || 'Erro ao cadastrar produto. Verifique se o backend está online.');
        });
    });
  }

  loadCategories();
  loadProducts();
})();
