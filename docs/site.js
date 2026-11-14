const photo = document.querySelector('#light-image');
const caption = document.querySelector('#light-caption');
const lighting = document.querySelector('.lighting');
const controls = document.querySelectorAll('[data-light]');

for (const control of controls) {
  control.addEventListener('click', () => {
    const mode = control.dataset.light;
    const label = control.textContent.trim();
    for (const button of controls) button.setAttribute('aria-pressed', String(button === control));
    photo.src = 'assets/lights-' + mode + '.webp';
    photo.alt = label + '下的控制器正面灯效实拍';
    caption.textContent = label + '实拍';
    lighting.classList.toggle('bright', mode === 'bright');
  });
}

const film = document.querySelector('#film');
const video = film.querySelector('video');
for (const link of document.querySelectorAll('.film-link')) {
  link.addEventListener('click', event => {
    if (!film.showModal || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    film.showModal();
    document.body.classList.add('watching');
    video.play().catch(() => {});
  });
}
document.querySelector('#close-film').addEventListener('click', () => film.close());
film.addEventListener('click', event => {
  if (event.target !== film) return;
  const rect = film.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) film.close();
});
film.addEventListener('close', () => {
  video.pause();
  video.currentTime = 0;
  document.body.classList.remove('watching');
});
