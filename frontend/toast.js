// toast.js — Notificações toast do SUITEGEST (Bloco 7)
//
// Uso (em qualquer página que carregue este arquivo):
//   showToast('Produto cadastrado', 'success');
//   showToast('Erro ao salvar', 'error');
//
// Tipos: success | error | warning | info (padrão: info)

(function () {
  'use strict';

  var CONTAINER_ID = 'toast-container';
  var DEFAULT_DURATION = 4000;
  var ICONS = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'i'
  };

  function getContainer() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      container.className = 'toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    return container;
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) {
      return;
    }
    toast.classList.add('is-leaving');
    setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 180);
  }

  /**
   * Exibe uma notificação toast.
   * @param {string} message Texto exibido.
   * @param {string} [type] success | error | warning | info
   * @param {number} [duration] Tempo em ms antes de remover (0 = não remove).
   */
  function showToast(message, type, duration) {
    var kind = ICONS[type] ? type : 'info';
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + kind;

    var icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = ICONS[kind];
    toast.appendChild(icon);

    var text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;
    toast.appendChild(text);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Fechar notificação');
    close.textContent = '×';
    close.addEventListener('click', function () {
      removeToast(toast);
    });
    toast.appendChild(close);

    getContainer().appendChild(toast);

    var time = typeof duration === 'number' ? duration : DEFAULT_DURATION;
    if (time > 0) {
      setTimeout(function () {
        removeToast(toast);
      }, time);
    }

    return toast;
  }

  /**
   * Confirmação no próprio toast (substitui window.confirm).
   * @param {string} message Texto da pergunta.
   * @returns {Promise<boolean>} true quando o usuário confirma.
   */
  function confirmToast(message) {
    return new Promise(function (resolve) {
      var toast = document.createElement('div');
      toast.className = 'toast toast-warning toast-confirm';

      var icon = document.createElement('span');
      icon.className = 'toast-icon';
      icon.textContent = '!';
      toast.appendChild(icon);

      var text = document.createElement('span');
      text.className = 'toast-message';
      text.textContent = message;
      toast.appendChild(text);

      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'toast-action';
      cancel.textContent = 'Cancelar';
      toast.appendChild(cancel);

      var confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.className = 'toast-action toast-action-primary';
      confirm.textContent = 'Confirmar';
      toast.appendChild(confirm);

      function finish(result) {
        removeToast(toast);
        resolve(result);
      }

      cancel.addEventListener('click', function () { finish(false); });
      confirm.addEventListener('click', function () { finish(true); });

      getContainer().appendChild(toast);
    });
  }

  // API global, usada por todos os scripts da página.
  window.showToast = showToast;
  window.confirmToast = confirmToast;
  window.showSuccessToast = function (message) {
    return showToast(message, 'success');
  };
  window.showErrorToast = function (message) {
    return showToast(message, 'error');
  };
})();
