document.getElementById('themeToggleBtn').addEventListener('click', function() {
    const link = document.querySelector('link[rel="stylesheet"]');
    const currentHref = link.getAttribute('href');
    
    if (currentHref.includes('_light')) {
        link.setAttribute('href', currentHref.replace('_light', ''));
        localStorage.setItem('theme', 'dark');
    } else {
        const newHref = currentHref.replace('.css', '_light.css');
        link.setAttribute('href', newHref);
        localStorage.setItem('theme', 'light');
    }
});

window.addEventListener('load', function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        const link = document.querySelector('link[rel="stylesheet"]');
        const currentHref = link.getAttribute('href');
        const newHref = currentHref.replace('.css', '_light.css');
        link.setAttribute('href', newHref);
    }
});
