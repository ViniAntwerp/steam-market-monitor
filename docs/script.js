let allItems = [];
let currentFiltered = [];

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupFilters();
});

async function loadData() {
    try {
        const response = await fetch('data/items.json');
        const data = await response.json();
        allItems = data.items;
        document.getElementById('data-info').textContent =
            `Dane z: ${new Date(data.timestamp).toLocaleString('pl-PL')} | Przedmiotów: ${allItems.length}`;
        applyFilters();
    } catch (err) {
        document.getElementById('data-info').textContent = 'Błąd ładowania danych. Sprawdź czy plik istnieje.';
    }
}

function setupFilters() {
    const minSlider = document.getElementById('price-min-slider');
    const maxSlider = document.getElementById('price-max-slider');
    const minInput = document.getElementById('price-min-input');
    const maxInput = document.getElementById('price-max-input');
    const checkboxes = document.querySelectorAll('.cat-check');

    function syncMin(val) {
        minSlider.value = val;
        minInput.value = parseFloat(val).toFixed(2);
        if (parseFloat(minSlider.value) > parseFloat(maxSlider.value)) {
            maxSlider.value = val;
            maxInput.value = parseFloat(val).toFixed(2);
        }
        applyFilters();
    }

    function syncMax(val) {
        maxSlider.value = val;
        maxInput.value = parseFloat(val).toFixed(2);
        if (parseFloat(maxSlider.value) < parseFloat(minSlider.value)) {
            minSlider.value = val;
            minInput.value = parseFloat(val).toFixed(2);
        }
        applyFilters();
    }

    minSlider.addEventListener('input', (e) => syncMin(e.target.value));
    maxSlider.addEventListener('input', (e) => syncMax(e.target.value));
    minInput.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value) || 0;
        val = Math.min(5000, Math.max(0, val));
        syncMin(val);
    });
    maxInput.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value) || 5000;
        val = Math.min(5000, Math.max(0, val));
        syncMax(val);
    });

    checkboxes.forEach(cb => cb.addEventListener('change', applyFilters));
    document.getElementById('reset-filters').addEventListener('click', () => {
        checkboxes.forEach(cb => cb.checked = false);
        minSlider.value = 0;
        minInput.value = '0.00';
        maxSlider.value = 5000;
        maxInput.value = '5000.00';
        applyFilters();
    });
}

function applyFilters() {
    const minPrice = parseFloat(document.getElementById('price-min-slider').value);
    const maxPrice = parseFloat(document.getElementById('price-max-slider').value);
    const selectedCategories = Array.from(document.querySelectorAll('.cat-check:checked')).map(cb => cb.value);

    currentFiltered = allItems.filter(item => {
        const pricePLN = item.sell_price_grosz / 100;
        if (pricePLN < minPrice || pricePLN > maxPrice) return false;

        if (selectedCategories.length > 0 && !selectedCategories.includes(item.type)) return false;

        if (item.sell_volume <= item.sell_listings) return false;

        return true;
    });

    renderItems();
}

function renderItems() {
    const summary = document.getElementById('results-summary');
    const list = document.getElementById('items-list');
    summary.textContent = `Wyświetlono ${currentFiltered.length} przedmiotów`;
    list.innerHTML = '';

    if (currentFiltered.length === 0) {
        list.innerHTML = '<p>Brak przedmiotów spełniających kryteria.</p>';
        return;
    }

    currentFiltered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-row';
        const imgUrl = item.icon_url
            ? `https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url}`
            : 'placeholder.png';
        div.innerHTML = `
            <img src="${imgUrl}" alt="${item.name}" onerror="this.style.display='none'">
            <div class="item-details">
                <div class="item-name">${item.name}</div>
                <div class="item-stats">
                    <span>Oferty: ${item.sell_listings}</span>
                    <span>Wolumen: ${item.sell_volume}</span>
                    <span>Cena: ${(item.sell_price_grosz / 100).toFixed(2)} PLN</span>
                </div>
            </div>
            <div class="item-link">
                <a href="https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.market_hash_name)}"
                   target="_blank" rel="noopener">🔗 Rynek</a>
            </div>
        `;
        list.appendChild(div);
    });
}
