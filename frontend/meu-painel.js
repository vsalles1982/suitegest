// meu-painel.js — Mesas atribuídas ao garçom selecionado (Bloco 3)
// Simula o garçom logado por meio do <select> no topo da página.

(function () {
  'use strict';

  var EMPLOYEES_URL = 'http://localhost:3000/employees';
  var TABLES_URL = 'http://localhost:3000/tables';

  var grid = document.getElementById('tables-grid');
  var message = document.getElementById('panel-message');
  var employeeSelect = document.getElementById('employee-select');
  var employeeMessage = document.getElementById('employee-message');

  var STATUS_LABELS = {
    free: 'Livre',
    occupied: 'Ocupada',
    closed: 'Fechada'
  };

  var STATUS_CLASSES = {
    free: 'table-status table-status-free',
    occupied: 'table-status table-status-occupied',
    closed: 'table-status table-status-closed'
  };

  var allTables = [];

  function getField(item, fields) {
    for (var i = 0; i < fields.length; i++) {
      if (item && item[fields[i]] !== null && item[fields[i]] !== undefined && item[fields[i]] !== '') {
        return item[fields[i]];
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

  function normalizeList(data, key) {
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data[key])) {
      return data[key];
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

  function renderTables(tables) {
    while (grid.firstChild) {
      grid.removeChild(grid.firstChild);
    }

    if (!tables || tables.length === 0) {
      showMessage('Nenhuma mesa atribuída a este garçom');
      return;
    }

    hideMessage();

    tables.forEach(function (table) {
      var status = String(getField(table, ['status'])).toLowerCase();

      var card = document.createElement('article');
      card.className = 'table-card';

      var title = document.createElement('h3');
      title.textContent = 'Mesa ' + getField(table, ['number', 'numero', 'id']);
      card.appendChild(title);

      var badge = document.createElement('span');
      badge.className = STATUS_CLASSES[status] || 'table-status';
      badge.textContent = STATUS_LABELS[status] || getField(table, ['status']);
      card.appendChild(badge);

      var detail = document.createElement('p');
      detail.className = 'table-detail';
      detail.textContent = status === 'occupied'
        ? 'Em atendimento'
        : status === 'closed'
          ? 'Fechada para limpeza/manutenção'
          : 'Disponível para abertura de comanda';
      card.appendChild(detail);

      grid.appendChild(card);
    });
  }

  function filterTables() {
    var selectedId = employeeSelect.value;
    if (!selectedId) {
      renderTables([]);
      return;
    }
    var mine = allTables.filter(function (table) {
      return String(getEmployeeId(table)) === String(selectedId);
    });
    renderTables(mine);
  }

  function loadEmployees() {
    fetch(EMPLOYEES_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        var employees = normalizeList(data, 'employees');
        while (employeeSelect.firstChild) {
          employeeSelect.removeChild(employeeSelect.firstChild);
        }
        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Selecione um garçom';
        employeeSelect.appendChild(placeholder);

        if (employees.length === 0) {
          var emptyOption = document.createElement('option');
          emptyOption.value = '';
          emptyOption.textContent = 'Nenhum funcionário cadastrado';
          employeeSelect.appendChild(emptyOption);
          employeeSelect.disabled = true;
          employeeMessage.textContent = 'Nenhum funcionário cadastrado';
          employeeMessage.hidden = false;
          return;
        }

        employees.forEach(function (employee) {
          var option = document.createElement('option');
          option.value = getField(employee, ['id']);
          option.textContent = getField(employee, ['name', 'nome']);
          employeeSelect.appendChild(option);
        });

        employeeSelect.disabled = false;
        employeeMessage.hidden = true;
      })
      .catch(function () {
        employeeMessage.textContent = 'Erro ao carregar funcionários. Verifique se o backend está online.';
        employeeMessage.hidden = false;
      });
  }

  function loadTables() {
    fetch(TABLES_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        allTables = normalizeList(data, 'tables');
        filterTables();
      })
      .catch(function () {
        showMessage('Erro ao carregar mesas. Verifique se o backend está online.');
      });
  }

  employeeSelect.addEventListener('change', filterTables);

  loadEmployees();
  loadTables();
})();
