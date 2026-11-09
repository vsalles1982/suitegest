// funcionarios.js — Gestão de garçons (Bloco 3)

(function () {
  'use strict';

  var EMPLOYEES_URL = 'http://localhost:3000/employees';

  var message = document.getElementById('employees-message');
  var tableWrapper = document.getElementById('employees-table-wrapper');
  var tableBody = document.getElementById('employees-body');
  var form = document.getElementById('employee-form');

  function getField(employee, fields) {
    for (var i = 0; i < fields.length; i++) {
      if (employee && employee[fields[i]] !== null && employee[fields[i]] !== undefined && employee[fields[i]] !== '') {
        return employee[fields[i]];
      }
    }
    return '—';
  }

  function toNumber(value) {
    var number = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(number) ? 0 : number;
  }

  function formatCommission(employee) {
    var bps = getField(employee, ['commissionBps', 'commission_bps']);
    if (bps !== '—') {
      return (toNumber(bps) / 100).toLocaleString('pt-BR') + '%';
    }
    var commission = getField(employee, ['commission', 'comissao']);
    if (commission !== '—') {
      return toNumber(commission).toLocaleString('pt-BR') + '%';
    }
    return '—';
  }

  function formatTables(employee) {
    var tables = getField(employee, ['tables', 'assignedTables', 'mesas', 'tableNumbers']);
    if (Array.isArray(tables)) {
      if (tables.length === 0) {
        return '—';
      }
      return tables.map(function (table) {
        return (table && typeof table === 'object') ? getField(table, ['number', 'numero', 'id']) : table;
      }).join(', ');
    }
    var count = getField(employee, ['tablesCount', 'mesasCount']);
    return count === '—' ? '—' : String(count);
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
    if (data && Array.isArray(data.employees)) {
      return data.employees;
    }
    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    if (data && Array.isArray(data.items)) {
      return data.items;
    }
    return [];
  }

  function deleteEmployee(employee) {
    if (!confirm('Desativar o funcionário ' + getField(employee, ['name', 'nome']) + '?')) {
      return;
    }

    fetch(EMPLOYEES_URL + '/' + getField(employee, ['id']), {
      method: 'DELETE'
    })
      .then(function (response) {
        if (response.status === 200 || response.status === 204) {
          loadEmployees();
          return null;
        }
        return response.json().catch(function () { return null; }).then(function (data) {
          alert((data && data.error) || ('Erro ao excluir funcionário (HTTP ' + response.status + ').'));
          return null;
        });
      })
      .catch(function () {
        alert('Erro ao excluir funcionário. Verifique se o backend está online.');
      });
  }

  function editEmployee(employee) {
    var name = prompt('Informe o nome do funcionário:', getField(employee, ['name', 'nome']) === '—' ? '' : getField(employee, ['name', 'nome']));
    if (name === null) {
      return;
    }
    var commissionInput = prompt('Informe a comissão (%) do funcionário:');
    if (commissionInput === null) {
      return;
    }

    var commission = Number(commissionInput);

    fetch(EMPLOYEES_URL + '/' + getField(employee, ['id']), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        commission: commission,
        commissionBps: Math.round(commission * 100)
      })
    })
      .then(function (response) {
        if (response.status === 200) {
          loadEmployees();
          return null;
        }
        return response.json().catch(function () { return null; }).then(function (data) {
          alert((data && data.error) || ('Erro ao editar funcionário (HTTP ' + response.status + ').'));
          return null;
        });
      })
      .catch(function () {
        alert('Erro ao editar funcionário. Verifique se o backend está online.');
      });
  }

  function renderEmployees(employees) {
    while (tableBody.firstChild) {
      tableBody.removeChild(tableBody.firstChild);
    }

    if (!employees || employees.length === 0) {
      tableWrapper.hidden = true;
      showMessage('Nenhum funcionário cadastrado');
      return;
    }

    hideMessage();

    employees.forEach(function (employee) {
      var row = document.createElement('tr');

      var nameCell = document.createElement('td');
      nameCell.textContent = getField(employee, ['name', 'nome']);
      row.appendChild(nameCell);

      var commissionCell = document.createElement('td');
      commissionCell.textContent = formatCommission(employee);
      row.appendChild(commissionCell);

      var tablesCell = document.createElement('td');
      tablesCell.textContent = formatTables(employee);
      row.appendChild(tablesCell);

      var actionsCell = document.createElement('td');

      var editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'release-button';
      editButton.textContent = 'Editar';
      editButton.addEventListener('click', function () {
        editEmployee(employee);
      });
      actionsCell.appendChild(editButton);

      var deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'release-button';
      deleteButton.textContent = 'Excluir';
      deleteButton.addEventListener('click', function () {
        deleteEmployee(employee);
      });
      actionsCell.appendChild(deleteButton);

      row.appendChild(actionsCell);

      tableBody.appendChild(row);
    });

    tableWrapper.hidden = false;
  }

  function loadEmployees() {
    showMessage('Carregando funcionários…');
    tableWrapper.hidden = true;

    fetch(EMPLOYEES_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        renderEmployees(normalizeList(data));
      })
      .catch(function () {
        tableWrapper.hidden = true;
        showMessage('Erro ao carregar funcionários. Verifique se o backend está online.');
      });
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var name = document.getElementById('name').value.trim();
      var commission = Number(document.getElementById('commission').value);

      fetch(EMPLOYEES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          commission: commission,
          commissionBps: Math.round(commission * 100)
        })
      })
        .then(function (response) {
          if (response.status === 201 || response.status === 200) {
            form.reset();
            loadEmployees();
            return null;
          }
          return response.json().catch(function () { return null; }).then(function (data) {
            alert((data && data.error) || ('Erro ao cadastrar funcionário (HTTP ' + response.status + ').'));
            return null;
          });
        })
        .catch(function () {
          alert('Erro ao cadastrar funcionário. Verifique se o backend está online.');
        });
    });
  }

  loadEmployees();
})();
