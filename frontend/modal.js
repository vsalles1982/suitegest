// modal.js — Modal reutilizável do SUITEGEST (Bloco 7 — correções do QA)
//
// Substitui prompt(), alert() e confirm() nativos do navegador, conforme
// docs/backlog-ui.md (seções 8.4 e 8.6: "Não usar prompt, alert ou confirm
// do navegador").
//
// Uso:
//   openModal({
//     title: 'Ajustar estoque',
//     description: 'Informe a nova quantidade em estoque.',
//     fields: [{ name: 'stock', label: 'Nova quantidade', type: 'number', required: true, min: 0 }],
//     submitLabel: 'Ajustar estoque'
//   }).then(function (values) {
//     if (!values) return; // cancelado
//     console.log(values.stock);
//   });
//
// Campos suportados: name, label, type (text | number | textarea), value,
// required, min, max, step, placeholder, hint.

(function () {
  'use strict';

  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  var modalStack = [];
  var lastFocused = null;

  function createElement(tag, className) {
    var element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    return element;
  }

  function getFocusable(container) {
    return Array.prototype.filter.call(
      container.querySelectorAll(FOCUSABLE),
      function (element) {
        return element.offsetParent !== null || element === document.activeElement;
      }
    );
  }

  function buildField(field, formId) {
    var inputId = formId + '-' + field.name;
    var wrapper = createElement('div', 'form-field');

    var label = createElement('label', null);
    label.setAttribute('for', inputId);
    label.textContent = field.label;
    wrapper.appendChild(label);

    var input;
    if (field.type === 'textarea') {
      input = createElement('textarea', 'form-control');
      input.rows = 3;
    } else if (field.type === 'select') {
      input = createElement('select', 'form-control');
      (field.options || []).forEach(function (option) {
        var element = createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        input.appendChild(element);
      });
    } else {
      input = createElement('input', 'form-control');
      input.type = field.type === 'number' ? 'number' : 'text';
      if (field.type === 'number') {
        if (field.min !== undefined) input.min = field.min;
        if (field.max !== undefined) input.max = field.max;
        if (field.step !== undefined) input.step = field.step;
      }
    }

    input.id = inputId;
    input.name = field.name;
    if (field.value !== undefined && field.value !== null) {
      input.value = field.value;
    }
    if (field.placeholder) {
      input.placeholder = field.placeholder;
    }
    if (field.required) {
      input.required = true;
      input.setAttribute('aria-required', 'true');
    }
    wrapper.appendChild(input);

    var error = createElement('p', 'form-hint form-error');
    error.id = inputId + '-error';
    error.hidden = true;
    input.setAttribute('aria-describedby', error.id);
    wrapper.appendChild(error);

    if (field.hint) {
      var hint = createElement('p', 'form-hint');
      hint.textContent = field.hint;
      wrapper.appendChild(hint);
    }

    return { wrapper: wrapper, input: input, error: error, definition: field };
  }

  function showFieldError(field, message) {
    field.error.textContent = message;
    field.error.hidden = false;
    field.input.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(field) {
    field.error.textContent = '';
    field.error.hidden = true;
    field.input.removeAttribute('aria-invalid');
  }

  function validate(fields) {
    var firstInvalid = null;

    fields.forEach(function (field) {
      clearFieldError(field);

      var value = field.input.value.trim();

      if (field.definition.required && value === '') {
        showFieldError(field, 'Preencha este campo.');
        if (!firstInvalid) firstInvalid = field;
        return;
      }

      if (field.definition.type === 'number' && value !== '') {
        var number = Number(value);
        if (Number.isNaN(number)) {
          showFieldError(field, 'Informe um número válido.');
          if (!firstInvalid) firstInvalid = field;
          return;
        }
        if (field.definition.min !== undefined && number < field.definition.min) {
          showFieldError(field, 'Informe um valor maior ou igual a ' + field.definition.min + '.');
          if (!firstInvalid) firstInvalid = field;
          return;
        }
        if (field.definition.max !== undefined && number > field.definition.max) {
          showFieldError(field, 'Informe um valor menor ou igual a ' + field.definition.max + '.');
          if (!firstInvalid) firstInvalid = field;
        }
      }
    });

    return firstInvalid;
  }

  function collectValues(fields) {
    var values = {};
    fields.forEach(function (field) {
      var value = field.input.value.trim();
      if (field.definition.type === 'number' && value !== '') {
        values[field.definition.name] = Number(value);
      } else {
        values[field.definition.name] = value;
      }
    });
    return values;
  }

  /**
   * Abre um modal de formulário.
   * @param {object} options title, description, fields[], submitLabel, cancelLabel, dismissible
   * @returns {Promise<object|null>} valores digitados ou null quando cancelado.
   */
  function openModal(options) {
    var config = options || {};

    return new Promise(function (resolve) {
      lastFocused = document.activeElement;

      var modalId = 'modal-' + Date.now();
      var overlay = createElement('div', 'modal');
      overlay.id = modalId;

      var content = createElement('div', 'modal-content');
      content.setAttribute('role', 'dialog');
      content.setAttribute('aria-modal', 'true');
      content.setAttribute('aria-labelledby', modalId + '-title');
      if (config.description) {
        content.setAttribute('aria-describedby', modalId + '-description');
      }
      overlay.appendChild(content);

      var header = createElement('div', 'modal-header');
      var title = createElement('h2', 'modal-title');
      title.id = modalId + '-title';
      title.textContent = config.title || '';
      header.appendChild(title);

      var close = createElement('button', 'modal-close');
      close.type = 'button';
      close.setAttribute('aria-label', 'Fechar');
      close.textContent = '×';
      header.appendChild(close);
      content.appendChild(header);

      if (config.description) {
        var description = createElement('p', 'modal-description');
        description.id = modalId + '-description';
        description.textContent = config.description;
        content.appendChild(description);
      }

      var form = createElement('form', 'modal-form');
      form.setAttribute('aria-label', config.title || 'Formulário');
      content.appendChild(form);

      var fields = (config.fields || []).map(function (field) {
        return buildField(field, modalId);
      });

      fields.forEach(function (field) {
        form.appendChild(field.wrapper);
      });

      var actions = createElement('div', 'modal-actions');
      var cancel = createElement('button', 'module-link');
      cancel.type = 'button';
      cancel.textContent = config.cancelLabel || 'Cancelar';
      actions.appendChild(cancel);

      var submit = createElement('button', 'submit-button');
      submit.type = 'submit';
      submit.textContent = config.submitLabel || 'Confirmar';
      actions.appendChild(submit);
      form.appendChild(actions);

      var resolved = false;

      function closeModal(result) {
        if (resolved) {
          return;
        }
        resolved = true;

        overlay.parentNode && overlay.parentNode.removeChild(overlay);
        modalStack = modalStack.filter(function (item) { return item !== overlay; });
        if (modalStack.length === 0) {
          document.body.classList.remove('modal-open');
        }

        document.removeEventListener('keydown', onKeyDown, true);

        if (lastFocused && typeof lastFocused.focus === 'function') {
          lastFocused.focus();
        }
        resolve(result);
      }

      function onKeyDown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeModal(null);
          return;
        }
        if (event.key !== 'Tab') {
          return;
        }
        // Foco preso dentro do modal enquanto ele estiver aberto.
        var focusable = getFocusable(content);
        if (focusable.length === 0) {
          return;
        }
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }

      cancel.addEventListener('click', function () {
        closeModal(null);
      });
      close.addEventListener('click', function () {
        closeModal(null);
      });

      overlay.addEventListener('click', function (event) {
        if (event.target === overlay && config.dismissible !== false) {
          closeModal(null);
        }
      });

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var invalid = validate(fields);
        if (invalid) {
          invalid.input.focus();
          return;
        }
        closeModal(collectValues(fields));
      });

      document.body.appendChild(overlay);
      document.body.classList.add('modal-open');
      modalStack.push(overlay);
      document.addEventListener('keydown', onKeyDown, true);

      var firstInput = fields.length > 0 ? fields[0].input : submit;
      firstInput.focus();
    });
  }

  window.openModal = openModal;
})();
