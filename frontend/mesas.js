// mesas.js — Carrega e renderiza a grade de mesas do salão (Fase 6)

(function () {
  'use strict';

  var TABLES_URL = 'http://localhost:3000/tables';
  var EMPLOYEES_URL = 'http://localhost:3000/employees';
  var PRODUCTS_URL = 'http://localhost:3000/products';
  var ORDERS_URL = 'http://localhost:3000/orders';

  var grid = document.getElementById('tables-grid');
  var message = document.getElementById('tables-message');
  var addButton = document.getElementById('add-table-button');

  var employees = [];

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

  function getEmployeeId(table) {
    var value = getField(table, ['employeeId', 'employee_id', 'waiterId', 'garcomId', 'assignedEmployeeId', 'employee']);
    if (value !== '—' && typeof value === 'object') {
      return getField(value, ['id']);
    }
    return value;
  }

  function assignEmployee(table, employeeId) {
    fetch(TABLES_URL + '/' + getField(table, ['id']) + '/employee', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: employeeId ? Number(employeeId) : null })
    })
      .then(function (response) {
        if (response.status === 200) {
          showToast('Garçom atribuído à mesa', 'success');
          loadTables();
          return null;
        }
        return response.json().catch(function () { return null; }).then(function (data) {
          showToast((data && data.error) || ('Erro ao atribuir garçom (HTTP ' + response.status + ').'), 'error');
          return null;
        });
      })
      .catch(function () {
        showToast('Erro ao atribuir garçom. Verifique se o backend está online.', 'error');
      });
  }

  function createEmployeeSelect(table) {
    var wrapper = document.createElement('div');
    wrapper.className = 'form-field table-employee-field';

    var label = document.createElement('label');
    label.textContent = 'Garçom';
    wrapper.appendChild(label);

    var select = document.createElement('select');
    select.className = 'employee-select';

    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione um garçom';
    select.appendChild(placeholder);

    employees.forEach(function (employee) {
      var option = document.createElement('option');
      option.value = getField(employee, ['id']);
      option.textContent = getField(employee, ['name', 'nome']);
      if (String(getEmployeeId(table)) === String(getField(employee, ['id']))) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    select.addEventListener('click', function (event) {
      event.stopPropagation();
    });
    select.addEventListener('change', function (event) {
      event.stopPropagation();
      assignEmployee(table, select.value);
    });

    wrapper.appendChild(select);
    return wrapper;
  }

  function loadEmployees() {
    return fetch(EMPLOYEES_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (Array.isArray(data)) {
          employees = data;
        } else if (data && Array.isArray(data.employees)) {
          employees = data.employees;
        } else if (data && Array.isArray(data.data)) {
          employees = data.data;
        } else {
          employees = [];
        }
      })
      .catch(function () {
        employees = [];
      });
  }

  function loadProductsForSelect() {
    return fetch(PRODUCTS_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        return normalizeList(data);
      });
  }

  function openOrderModal(table) {
    var tableNumber = getField(table, ['number', 'numero', 'id']);
    var tableId = getField(table, ['id']);

    loadProductsForSelect()
      .then(function (products) {
        if (products.length === 0) {
          showToast('Nenhum produto cadastrado. Cadastre um produto antes de abrir a comanda.', 'error');
          return null;
        }

        var options = products.map(function (product) {
          return {
            value: String(getField(product, ['id'])),
            label: getField(product, ['name', 'nome'])
          };
        });

        return openModal({
          title: 'Abrir comanda da Mesa ' + tableNumber,
          description: 'Escolha o produto e a quantidade para iniciar o atendimento.',
          fields: [
            {
              name: 'productId',
              label: 'Produto',
              type: 'select',
              required: true,
              options: options
            },
            {
              name: 'quantity',
              label: 'Quantidade',
              type: 'number',
              required: true,
              min: 1,
              step: 1,
              value: 1
            }
          ],
          submitLabel: 'Abrir comanda'
        }).then(function (values) {
          if (!values) {
            return null;
          }

          return fetch(ORDERS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tableId: Number(tableId),
              items: [{ productId: Number(values.productId), quantity: Number(values.quantity) }]
            })
          })
            .then(function (response) {
              if (response.status === 201) {
                return response.json();
              }
              return response.json().catch(function () { return null; }).then(function (data) {
                showToast((data && data.error) || ('Erro ao abrir comanda (HTTP ' + response.status + ').'), 'error');
                return null;
              });
            })
            .then(function (order) {
              if (order && order.id) {
                window.location.href = 'comanda.html?id=' + order.id;
              } else {
                loadTables();
              }
            })
            .catch(function () {
              showToast('Erro ao abrir comanda. Verifique se o backend está online.', 'error');
            });
        });
      })
      .catch(function () {
        showToast('Erro ao carregar produtos. Verifique se o backend está online.', 'error');
      });
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
          // Mesa livre: abrir a comanda escolhendo produto e quantidade.
          openOrderModal(table);
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

      card.appendChild(createEmployeeSelect(table));

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
                showToast('Mesa liberada', 'success');
                loadTables();
                return null;
              }
              return response.json().catch(function () { return null; }).then(function (data) {
                showToast((data && data.error) || ('Erro ao liberar mesa (HTTP ' + response.status + ').'), 'error');
                return null;
              });
            })
            .catch(function () {
              showToast('Erro ao liberar mesa. Verifique se o backend está online.', 'error');
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
      openModal({
        title: 'Adicionar mesa',
        description: 'Informe o número da mesa. Cada mesa tem um número único.',
        fields: [
          {
            name: 'number',
            label: 'Número da mesa',
            type: 'number',
            required: true,
            min: 1,
            step: 1,
            placeholder: 'Ex.: 12'
          }
        ],
        submitLabel: 'Cadastrar mesa'
      }).then(function (values) {
        if (!values) {
          return;
        }

        var number = Number(values.number);
        if (!Number.isInteger(number) || number < 1) {
          showToast('Informe um número inteiro maior ou igual a 1.', 'error');
          return;
        }

        fetch(TABLES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: number })
        })
          .then(function (response) {
            if (response.status === 201) {
              showToast('Mesa cadastrada', 'success');
              loadTables();
              return null;
            }
            if (response.status === 409) {
              showToast('Mesa já cadastrada', 'error');
              return null;
            }
            if (response.status === 400) {
              showToast('Número inválido', 'error');
              return null;
            }
            return response.json().catch(function () { return null; }).then(function (data) {
              showToast((data && data.error) || ('Erro ao cadastrar mesa (HTTP ' + response.status + ').'), 'error');
              return null;
            });
          })
          .catch(function () {
            showToast('Erro ao cadastrar mesa. Verifique se o backend está online.', 'error');
          });
      });
    });
  }

  loadEmployees().then(loadTables);
})();
