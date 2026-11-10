// caixa.js — Abertura, movimentações e fechamento de caixa (Bloco 6)

(function () {
  'use strict';

  var CASH_URL = 'http://localhost:3000/cash';

  var message = document.getElementById('cash-message');
  var openSection = document.getElementById('open-cash-section');
  var cashSection = document.getElementById('cash-open-section');
  var openForm = document.getElementById('open-cash-form');
  var balanceEl = document.getElementById('cash-balance');
  var initialEl = document.getElementById('cash-initial');
  var movementsBody = document.getElementById('movements-body');
  var sangriaButton = document.getElementById('sangria-button');
  var suprimentoButton = document.getElementById('suprimento-button');
  var closeCashButton = document.getElementById('close-cash-button');

  function getField(data, fields) {
    for (var i = 0; i < fields.length; i++) {
      if (data && data[fields[i]] !== null && data[fields[i]] !== undefined && data[fields[i]] !== '') {
        return data[fields[i]];
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

  function formatMoney(data, valueFields, formattedFields) {
    var formatted = getField(data, formattedFields);
    if (formatted !== '—') {
      return formatted;
    }
    var value = getField(data, valueFields);
    return value === '—' ? '—' : formatPrice(value);
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
    openSection.hidden = true;
    cashSection.hidden = true;
  }

  function showOpenForm() {
    message.hidden = true;
    openSection.hidden = false;
    cashSection.hidden = true;
  }

  function renderMovements(movements) {
    while (movementsBody.firstChild) {
      movementsBody.removeChild(movementsBody.firstChild);
    }

    (movements || []).forEach(function (movement) {
      var row = document.createElement('tr');

      var typeCell = document.createElement('td');
      typeCell.textContent = getField(movement, ['type', 'tipo']);
      row.appendChild(typeCell);

      var descriptionCell = document.createElement('td');
      descriptionCell.textContent = getField(movement, ['description', 'descricao', 'reason']);
      row.appendChild(descriptionCell);

      var amountCell = document.createElement('td');
      amountCell.textContent = formatMoney(
        movement,
        ['amount', 'valor'],
        ['amountFormatted']
      );
      amountCell.className = 'price-cell';
      row.appendChild(amountCell);

      movementsBody.appendChild(row);
    });
  }

  function showCash(data) {
    var shift = (data && data.shift) ? data.shift : data;

    balanceEl.textContent = formatMoney(
      shift,
      ['balance', 'currentBalance', 'expectedBalance', 'saldoAtual', 'total'],
      ['balanceFormatted', 'currentBalanceFormatted']
    );
    initialEl.textContent = formatMoney(
      shift,
      ['initialAmount', 'openingBalance', 'initialBalance', 'valorInicial'],
      ['initialAmountFormatted']
    );

    var movements = (shift && Array.isArray(shift.movements)) ? shift.movements : [];
    renderMovements(movements);

    message.hidden = true;
    openSection.hidden = true;
    cashSection.hidden = false;
  }

  function isShiftOpen(data) {
    if (!data) {
      return false;
    }
    var shift = (data && data.shift) ? data.shift : data;
    if (shift.open === true) {
      return true;
    }
    if (shift.status === 'open' || shift.status === 'aberto') {
      return true;
    }
    return shift.balance !== undefined || shift.currentBalance !== undefined;
  }

  function loadCash() {
    showMessage('Carregando caixa…');

    fetch(CASH_URL)
      .then(function (response) {
        if (response.status === 404) {
          showOpenForm();
          return null;
        }
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (data === null) {
          return;
        }
        if (isShiftOpen(data)) {
          showCash(data);
        } else {
          showOpenForm();
        }
      })
      .catch(function () {
        showMessage('Erro ao carregar caixa. Verifique se o backend está online.');
      });
  }

  function addMovement(type) {
    var amountInput = prompt('Informe o valor da ' + (type === 'sangria' ? 'sangria' : 'suprimento') + ' (em centavos):');
    if (amountInput === null) {
      return;
    }
    var description = prompt('Informe a descrição da ' + (type === 'sangria' ? 'sangria' : 'suprimento') + ':');
    if (description === null) {
      return;
    }

    var amount = Number(amountInput);
    if (!Number.isInteger(amount) || amount < 0) {
      alert('Quantidade inválida');
      return;
    }

    fetch(CASH_URL + '/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, amount: amount, description: description.trim() })
    })
      .then(function (response) {
        if (response.status === 200 || response.status === 201) {
          loadCash();
          return null;
        }
        return response.json().catch(function () { return null; }).then(function (data) {
          alert((data && data.error) || ('Erro ao registrar movimentação (HTTP ' + response.status + ').'));
          return null;
        });
      })
      .catch(function () {
        alert('Erro ao registrar movimentação. Verifique se o backend está online.');
      });
  }

  if (openForm) {
    openForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var initialAmount = Number(document.getElementById('initial-amount').value);
      if (!Number.isInteger(initialAmount) || initialAmount < 0) {
        alert('Quantidade inválida');
        return;
      }

      fetch(CASH_URL + '/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialAmount: initialAmount })
      })
        .then(function (response) {
          if (response.status === 200 || response.status === 201) {
            openForm.reset();
            loadCash();
            return null;
          }
          return response.json().catch(function () { return null; }).then(function (data) {
            alert((data && data.error) || ('Erro ao abrir caixa (HTTP ' + response.status + ').'));
            return null;
          });
        })
        .catch(function () {
          alert('Erro ao abrir caixa. Verifique se o backend está online.');
        });
    });
  }

  if (sangriaButton) {
    sangriaButton.addEventListener('click', function () {
      addMovement('sangria');
    });
  }

  if (suprimentoButton) {
    suprimentoButton.addEventListener('click', function () {
      addMovement('suprimento');
    });
  }

  if (closeCashButton) {
    closeCashButton.addEventListener('click', function () {
      var input = prompt('Informe o valor contado na gaveta (em centavos):');
      if (input === null) {
        return;
      }

      var countedAmount = Number(input);
      if (!Number.isInteger(countedAmount) || countedAmount < 0) {
        alert('Quantidade inválida');
        return;
      }

      fetch(CASH_URL + '/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedAmount: countedAmount })
      })
        .then(function (response) {
          if (response.status === 200 || response.status === 201) {
            loadCash();
            return null;
          }
          return response.json().catch(function () { return null; }).then(function (data) {
            alert((data && data.error) || ('Erro ao fechar caixa (HTTP ' + response.status + ').'));
            return null;
          });
        })
        .catch(function () {
          alert('Erro ao fechar caixa. Verifique se o backend está online.');
        });
    });
  }

  loadCash();
})();
