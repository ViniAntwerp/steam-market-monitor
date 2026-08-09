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

        var imgHtml = '';
        if (item.icon_url) {
            var imgUrl = 'https://steamcommunity-a.akamaihd.net/economy/image/' + item.icon_url;
            imgHtml = '<img src="' + imgUrl + '" alt="' + item.name + '" style="width:50px;height:40px;object-fit:contain;">';
        } else {
            // Przezroczysty piksel, aby zachować układ
            imgHtml = '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" style="width:50px;height:40px;">';
        }

        div.innerHTML =
            imgHtml +
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
