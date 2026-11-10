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
    var label = type === 'sangria' ? 'sangria' : 'suprimento';
    var actionLabel = type === 'sangria' ? 'Registrar sangria' : 'Registrar suprimento';

    openModal({
      title: actionLabel,
      description: type === 'sangria'
        ? 'Informe o valor retirado da gaveta e o motivo da sangria.'
        : 'Informe o valor depositado na gaveta e o motivo do suprimento.',
      fields: [
        {
          name: 'amount',
          label: 'Valor (em centavos)',
          type: 'number',
          required: true,
          min: 0,
          step: 1,
          placeholder: 'Ex.: 3000'
        },
        {
          name: 'description',
          label: 'Motivo',
          type: 'text',
          required: true,
          placeholder: type === 'sangria' ? 'Ex.: Retirada para troco' : 'Ex.: Reforço de caixa'
        }
      ],
      submitLabel: actionLabel
    }).then(function (values) {
      if (!values) {
        return;
      }

      var amount = Number(values.amount);
      if (!Number.isInteger(amount) || amount < 0) {
        showToast('Informe um valor inteiro maior ou igual a zero.', 'error');
        return;
      }

      fetch(CASH_URL + '/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type, amount: amount, description: String(values.description).trim() })
      })
      .then(function (response) {
        if (response.status === 200 || response.status === 201) {
          showToast((type === 'sangria' ? 'Sangria' : 'Suprimento') + ' registrado', 'success');
          loadCash();
          return null;
        }
        return response.json().catch(function () { return null; }).then(function (data) {
          showToast((data && data.error) || ('Erro ao registrar movimentação (HTTP ' + response.status + ').'), 'error');
          return null;
        });
      })
      .catch(function () {
        showToast('Erro ao registrar movimentação. Verifique se o backend está online.', 'error');
      });
    });
  }

  if (openForm) {
    openForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var initialAmount = Number(document.getElementById('initial-amount').value);
      if (!Number.isInteger(initialAmount) || initialAmount < 0) {
        showToast('Quantidade inválida', 'error');
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
            showToast('Caixa aberto', 'success');
            loadCash();
            return null;
          }
          return response.json().catch(function () { return null; }).then(function (data) {
            showToast((data && data.error) || ('Erro ao abrir caixa (HTTP ' + response.status + ').'), 'error');
            return null;
          });
        })
        .catch(function () {
          showToast('Erro ao abrir caixa. Verifique se o backend está online.', 'error');
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
      openModal({
        title: 'Fechar caixa',
        description: 'Informe o valor contado na gaveta para fechar o turno.',
        fields: [
          {
            name: 'countedAmount',
            label: 'Valor contado na gaveta (em centavos)',
            type: 'number',
            required: true,
            min: 0,
            step: 1,
            placeholder: 'Ex.: 15000'
          }
        ],
        submitLabel: 'Fechar caixa'
      }).then(function (values) {
        if (!values) {
          return;
        }

        var countedAmount = Number(values.countedAmount);
        if (!Number.isInteger(countedAmount) || countedAmount < 0) {
          showToast('Informe um valor inteiro maior ou igual a zero.', 'error');
          return;
        }

        fetch(CASH_URL + '/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ countedAmount: countedAmount })
        })
          .then(function (response) {
            if (response.status === 200 || response.status === 201) {
              showToast('Caixa fechado', 'success');
              loadCash();
              return null;
            }
            return response.json().catch(function () { return null; }).then(function (data) {
              showToast((data && data.error) || ('Erro ao fechar caixa (HTTP ' + response.status + ').'), 'error');
              return null;
            });
          })
          .catch(function () {
            showToast('Erro ao fechar caixa. Verifique se o backend está online.', 'error');
          });
      });
    });
  }

  loadCash();
})();
