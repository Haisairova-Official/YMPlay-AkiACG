const menu = document.querySelector('.product-menu');
const trigger = menu.querySelector('summary');
let hoverOpened = false;
menu.addEventListener('pointerenter', event => {
  if (event.pointerType !== 'mouse' || menu.open) return;
  menu.open = true;
  hoverOpened = true;
});
menu.addEventListener('pointerleave', event => {
  if (event.pointerType === 'mouse' && !menu.querySelector('.product-links :focus')) menu.open = false;
});
trigger.addEventListener('click', event => {
  if (event.detail && hoverOpened && menu.open) event.preventDefault();
  hoverOpened = false;
});
menu.addEventListener('focusout', event => {
  if (!menu.contains(event.relatedTarget)) menu.open = false;
});
menu.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.open) {
    menu.open = false;
    trigger.focus();
  }
});
document.addEventListener('click', event => {
  if (!menu.contains(event.target) || event.target.closest('.product-links a')) menu.open = false;
});
