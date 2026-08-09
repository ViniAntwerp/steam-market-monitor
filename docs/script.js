let allItems = [];
let currentFiltered = [];

document.addEventListener('DOMContentLoaded', function() {
    loadData();
    setupFilters();
});

function loadData() {
    fetch('data/items.json')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            allItems = data.items;
            document.getElementById('data-info').textContent =
                'Dane z: ' + new Date(data.timestamp).toLocaleString('pl-PL') +
                ' | Przedmiotów: ' + allItems.length;
            applyFilters();
        })
        .catch(function(err) {
            document.getElementById('data-info').textContent =
                'Błąd ładowania danych. Sprawdź czy plik istnieje.';
            console.error(err);
        });
}

function setupFilters() {
    var minSlider = document.getElementById('price-min-slider');
    var maxSlider = document.getElementById('price-max-slider');
    var minInput = document.getElementById('price-min-input');
    var maxInput = document.getElementById('price-max-input');
    var checkboxes = document.querySelectorAll('.cat-check');
    var volumeFilter = document.getElementById('volume-filter');

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

    minSlider.addEventListener('input', function(e) { syncMin(e.target.value); });
    maxSlider.addEventListener('input', function(e) { syncMax(e.target.value); });
    minInput.addEventListener('change', function(e) {
        var val = parseFloat(e.target.value) || 0;
        val = Math.min(5000, Math.max(0, val));
        syncMin(val);
    });
    maxInput.addEventListener('change', function(e) {
        var val = parseFloat(e.target.value) || 5000;
        val = Math.min(5000, Math.max(0, val));
        syncMax(val);
    });

    checkboxes.forEach(function(cb) {
        cb.addEventListener('change', applyFilters);
    });
    volumeFilter.addEventListener('change', applyFilters);

    document.getElementById('reset-filters').addEventListener('click', function() {
        checkboxes.forEach(function(cb) { cb.checked = false; });
        minSlider.value = 0;
        minInput.value = '0.00';
        maxSlider.value = 5000;
        maxInput.value = '5000.00';
        volumeFilter.checked = false;
        applyFilters();
    });
}

function applyFilters() {
    var minPrice = parseFloat(document.getElementById('price-min-slider').value);
    var maxPrice = parseFloat(document.getElementById('price-max-slider').value);
    var selectedCategories = [];
    var catChecks = document.querySelectorAll('.cat-check:checked');
    for (var i = 0; i < catChecks.length; i++) {
        selectedCategories.push(catChecks[i].value);
    }
    var useVolumeFilter = document.getElementById('volume-filter').checked;

    currentFiltered = allItems.filter(function(item) {
        var pricePLN = item.sell_price_grosz / 100;
        if (pricePLN < minPrice || pricePLN > maxPrice) return false;

        // Filtrowanie kategorii – częściowe dopasowanie
        if (selectedCategories.length > 0) {
            var matches = false;
            for (var j = 0; j < selectedCategories.length; j++) {
                var cat = selectedCategories[j];
                if (cat === 'Container' && item.type.indexOf('Container') !== -1) {
                    matches = true;
                    break;
                }
                if (cat === 'Weapon' && item.type.indexOf('Weapon') !== -1) {
                    matches = true;
                    break;
                }
                // Naklejki: typ zawiera "Sticker", ale NIE "Sticker Capsule"
                if (cat === 'Sticker' && item.type.indexOf('Sticker') !== -1 && item.type.indexOf('Sticker Capsule') === -1) {
                    matches = true;
                    break;
                }
                // Kapsułki: dokładnie "Sticker Capsule" (lub zawiera, jeśli są warianty)
                if (cat === 'Sticker Capsule' && item.type.indexOf('Sticker Capsule') !== -1) {
                    matches = true;
                    break;
                }
                // Agenci i Music Kit – dokładne dopasowanie (Steam raczej nie zmienia)
                if ((cat === 'Agent' || cat === 'Music Kit') && item.type === cat) {
                    matches = true;
                    break;
                }
            }
            if (!matches) return false;
        }

        if (useVolumeFilter && item.sell_volume <= item.sell_listings) return false;

        return true;
    });

    renderItems();
}

function renderItems() {
    var summary = document.getElementById('results-summary');
    var list = document.getElementById('items-list');
    summary.textContent = 'Wyświetlono ' + currentFiltered.length + ' przedmiotów';
    list.innerHTML = '';

    if (currentFiltered.length === 0) {
        list.innerHTML = '<p>Brak przedmiotów spełniających kryteria.</p>';
        return;
    }

    for (var i = 0; i < currentFiltered.length; i++) {
        var item = currentFiltered[i];
        var div = document.createElement('div');
        div.className = 'item-row';

        var imgUrl = item.icon_url ?
            'https://steamcommunity-a.akamaihd.net/economy/image/' + item.icon_url :
            'placeholder.png';

        div.innerHTML =
            '<img src="' + imgUrl + '" alt="' + item.name + '" onerror="this.style.display=\'none\'">' +
            '<div class="item-details">' +
                '<div class="item-name">' + item.name + '</div>' +
                '<div class="item-stats">' +
                    '<span>Oferty: ' + item.sell_listings + '</span>' +
                    '<span>Wolumen: ' + item.sell_volume + '</span>' +
                    '<span>Cena: ' + (item.sell_price_grosz / 100).toFixed(2) + ' PLN</span>' +
                '</div>' +
            '</div>' +
            '<div class="item-link">' +
                '<a href="https://steamcommunity.com/market/listings/730/' + encodeURIComponent(item.market_hash_name) + '" target="_blank" rel="noopener">🔗 Rynek</a>' +
            '</div>';

        list.appendChild(div);
    }
}
