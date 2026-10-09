// Read-only Marionette script for control.mjs read. Open the slash menu first.
const menu = document.querySelector('.zcs-command-menu:not([hidden])');
if (!menu) throw new Error('Command menu is not visible');
const rows = [...menu.querySelectorAll('.zcs-command-row')];
if (!rows.length) throw new Error('Command menu has no entries');
const errors = [];
const menuBounds = menu.getBoundingClientRect();
const headerBounds = document.querySelector('.zcs-topbar').getBoundingClientRect();
if (menuBounds.top < headerBounds.bottom - 0.5) errors.push('Menu is clipped or covers the chat header');
const measurements = rows.map((row, index) => {
  const name = row.querySelector('.zcs-command-name');
  const description = row.querySelector('.zcs-command-description');
  const bounds = row.getBoundingClientRect();
  const nameBounds = name.getBoundingClientRect();
  const descriptionBounds = description.getBoundingClientRect();
  const fail = message => errors.push(`${name.textContent}: ${message}`);
  if (nameBounds.top < bounds.top - 0.5 || nameBounds.bottom > bounds.bottom + 0.5) {
    fail('name extends outside its row');
  }
  if (description.textContent) {
    if (!description.clientHeight) fail('description is collapsed');
    if (descriptionBounds.top < nameBounds.bottom - 0.5 || descriptionBounds.bottom > bounds.bottom + 0.5) {
      fail('description overlaps or extends outside its row');
    }
  }
  if (rows[index + 1] && bounds.bottom > rows[index + 1].getBoundingClientRect().top + 0.5) {
    fail('row overlaps the next entry');
  }
  for (const text of [name, description]) {
    if (text.scrollWidth > text.clientWidth) fail('text overflows horizontally');
  }
  return {name:name.textContent, height:bounds.height,
    nameHeight:nameBounds.height, descriptionHeight:descriptionBounds.height};
});
if (menu.scrollWidth > menu.clientWidth) errors.push('Menu overflows horizontally');
if (errors.length) throw new Error(errors.join('\n'));
return {passed:true, count:rows.length, width:menu.clientWidth,
  scrollable:menu.scrollHeight > menu.clientHeight, rows:measurements};
