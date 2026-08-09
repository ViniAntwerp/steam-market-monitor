console.log('Testowy skrypt załadowany!');
document.getElementById('data-info').textContent = 'Test: skrypt działa';

fetch('data/items.json')
  .then(r => r.json())
  .then(data => {
    const ile = data.items.length;
    document.getElementById('data-info').textContent =
      `Test OK – załadowano ${ile} przedmiotów. Oto pierwsze 5:`;
    const list = document.getElementById('items-list');
    list.innerHTML = '';
    data.items.slice(0, 5).forEach(item => {
      const div = document.createElement('div');
      div.className = 'item-row';
      div.innerHTML = `<strong>${item.name}</strong> – ${(item.sell_price_grosz/100).toFixed(2)} PLN (oferty: ${item.sell_listings})`;
      list.appendChild(div);
    });
  })
  .catch(e => {
    document.getElementById('data-info').textContent = 'Błąd testu: ' + e.message;
    console.error(e);
  });
