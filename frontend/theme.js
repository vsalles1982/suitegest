// theme.js — Comportamento da sidebar e do tema escuro (Bloco 7)

(function () {
  'use strict';

  // Grupos e ordem fixos conforme docs/backlog-ui.md (seção 7.2).
  var NAV_GROUPS = [
    {
      title: null,
      items: [{ page: 'home', label: 'Início', href: 'index.html', icon: '⌂' }]
    },
    {
      title: 'Operação',
      items: [
        { page: 'mesas', label: 'Mesas', href: 'mesas.html', icon: '▦' },
        { page: 'cardapio', label: 'Cardápio', href: 'cardapio.html', icon: '☰' },
        { page: 'caixa', label: 'Caixa', href: 'caixa.html', icon: '₿' }
      ]
    },
    {
      title: 'Gestão',
      items: [
        { page: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: '◱' },
        { page: 'relatorios', label: 'Relatórios', href: 'relatorios.html', icon: '▤' },
        { page: 'estoque', label: 'Estoque', href: 'estoque.html', icon: '◫' },
        { page: 'funcionarios', label: 'Funcionários', href: 'funcionarios.html', icon: '☺' }
      ]
    },
    {
      title: null,
      items: [{ page: 'meu-painel', label: 'Meu painel', href: 'meu-painel.html', icon: '◉' }]
    }
  ];

  function buildSidebar() {
    var currentPage = document.body.getAttribute('data-page') || '';

    var aside = document.createElement('aside');
    aside.className = 'sidebar';
    aside.setAttribute('aria-label', 'Navegação principal');

    var brand = document.createElement('div');
    brand.className = 'sidebar-brand';

    var logo = document.createElement('span');
    logo.className = 'sidebar-logo';
    logo.textContent = 'SG';
    brand.appendChild(logo);

    var brandText = document.createElement('span');
    brandText.className = 'sidebar-brand-text';
    var strong = document.createElement('strong');
    strong.textContent = 'SUITEGEST';
    var span = document.createElement('span');
    span.textContent = 'PDV para restaurantes';
    brandText.appendChild(strong);
    brandText.appendChild(span);
    brand.appendChild(brandText);

    aside.appendChild(brand);

    var nav = document.createElement('nav');
    nav.className = 'sidebar-nav';
    nav.setAttribute('aria-label', 'Navegação principal');

    NAV_GROUPS.forEach(function (group) {
      if (group.title) {
        var sectionTitle = document.createElement('p');
        sectionTitle.className = 'sidebar-section-title';
        sectionTitle.textContent = group.title;
        nav.appendChild(sectionTitle);
      }

      group.items.forEach(function (item) {
        var link = document.createElement('a');
        link.className = 'sidebar-link';
        link.href = item.href;
        if (item.page === currentPage) {
          link.classList.add('is-active');
          link.setAttribute('aria-current', 'page');
        }

        var icon = document.createElement('span');
        icon.className = 'sidebar-link-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = item.icon;
        link.appendChild(icon);

        var label = document.createElement('span');
        label.textContent = item.label;
        link.appendChild(label);

        nav.appendChild(link);
      });
    });

    aside.appendChild(nav);

    var footer = document.createElement('p');
    footer.className = 'sidebar-footer';
    footer.textContent = 'Gestão não fiscal de estabelecimentos.';
    aside.appendChild(footer);

    return aside;
  }

  function buildToggle() {
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sidebar-toggle';
    toggle.setAttribute('aria-label', 'Abrir menu');
    toggle.textContent = '☰';
    return toggle;
  }

  var boundToggles = [];

  function bindToggle(toggle) {
    if (!toggle || boundToggles.indexOf(toggle) !== -1) {
      return;
    }
    boundToggles.push(toggle);
    toggle.addEventListener('click', function () {
      document.body.classList.toggle('sidebar-open');
    });
  }

  function init() {
    document.body.classList.add('has-sidebar');

    if (!document.querySelector('.sidebar')) {
      document.body.insertBefore(buildSidebar(), document.body.firstChild);
    }
    if (!document.querySelector('.sidebar-toggle')) {
      document.body.insertBefore(buildToggle(), document.body.firstChild);
    }
    bindToggle(document.querySelector('.sidebar-toggle'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
