// app.js — Verificação do status do backend SuiteSimulaFuncoes

(function () {
  'use strict';

  var HEALTH_URL = 'http://localhost:3000/health';

  var container = document.getElementById('status-container');
  var text = document.getElementById('status-text');

  function setStatus(online, message) {
    var classes = ['status-container', online ? 'status-online' : 'status-offline'];
    container.className = classes.join(' ');
    text.textContent = message;
  }

  function setChecking() {
    container.className = 'status-container status-checking';
    text.textContent = 'Verificando backend…';
  }

  function checkHealth() {
    setChecking();

    fetch(HEALTH_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Resposta HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (data && data.status === 'ok') {
          setStatus(true, 'Backend Online');
        } else {
          setStatus(false, 'Backend Offline');
        }
      })
      .catch(function () {
        setStatus(false, 'Backend Offline');
      });
  }

  checkHealth();

  // Re-verifica a cada 30 segundos para manter o status atualizado.
  setInterval(checkHealth, 30000);
})();
