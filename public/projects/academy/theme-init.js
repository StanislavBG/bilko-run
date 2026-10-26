(function () {
  var t = localStorage.getItem('bilko_academy_theme_v1');
  if (t !== 'light' && t !== 'dark' && t !== 'sepia') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = t;
})();
