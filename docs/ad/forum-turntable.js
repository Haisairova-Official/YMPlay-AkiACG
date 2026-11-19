// A manually rotatable view of the same cabinet for devices without WebGL.
export async function mountTurntable(stage, spriteURL, { onInteraction } = {}) {
  const columns = 6;
  const rows = 4;
  const frames = columns * rows;
  const sprite = new Image();
  sprite.src = spriteURL.href;
  await sprite.decode();
  if (!sprite.naturalWidth || sprite.naturalWidth / columns !== sprite.naturalHeight / rows) {
    throw new Error('Unexpected YiMaiPlay turntable dimensions');
  }

  const control = document.createElement('div');
  control.className = 'forum-turntable';
  control.tabIndex = 0;
  control.setAttribute('role', 'slider');
  control.setAttribute('aria-label', '旋转机台，向左右拖动或使用方向键');
  control.setAttribute('aria-valuemin', '0');
  control.setAttribute('aria-valuemax', '345');
  control.style.cssText = 'position:absolute;inset:0 0 var(--forum-hint-space,34px);display:grid;place-items:center;container-type:size;pointer-events:auto;touch-action:pan-y;user-select:none;cursor:grab';
  const picture = document.createElement('span');
  picture.setAttribute('aria-hidden', 'true');
  picture.style.cssText = 'display:block;width:min(100cqw,100cqh);aspect-ratio:1;pointer-events:none;background-repeat:no-repeat';
  picture.style.backgroundImage = 'url("' + sprite.src + '")';
  picture.style.backgroundSize = (columns * 100) + '% ' + (rows * 100) + '%';
  control.append(picture);

  let frame = 0;
  let activePointer = null;
  let initialX = 0;
  let initialFrame = 0;

  function draw(index) {
    frame = ((index % frames) + frames) % frames;
    const degrees = (30 + frame * 360 / frames) % 360;
    picture.style.backgroundPosition = (frame % columns) * 100 / (columns - 1) + '% ' +
      Math.floor(frame / columns) * 100 / (rows - 1) + '%';
    control.setAttribute('aria-valuenow', String(degrees));
    control.setAttribute('aria-valuetext', degrees + ' 度');
  }
  function release(event) {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    control.style.cursor = 'grab';
    onInteraction?.(false);
  }
  control.addEventListener('pointerdown', event => {
    if (activePointer !== null || event.button !== 0) return;
    activePointer = event.pointerId;
    initialX = event.clientX;
    initialFrame = frame;
    control.setPointerCapture(activePointer);
    control.style.cursor = 'grabbing';
    onInteraction?.(true);
  });
  control.addEventListener('pointermove', event => {
    if (event.pointerId !== activePointer) return;
    const turnWidth = Math.max(220, control.clientHeight * 1.35);
    draw(initialFrame + Math.round((initialX - event.clientX) * frames / turnWidth));
  });
  control.addEventListener('pointerup', release);
  control.addEventListener('pointercancel', release);
  control.addEventListener('lostpointercapture', release);
  control.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    draw(frame + (event.key === 'ArrowLeft' ? -1 : 1));
  });

  draw(0);
  stage.append(control);
  return {
    destroy() {
      control.remove();
      if (activePointer !== null) {
        activePointer = null;
        onInteraction?.(false);
      }
    }
  };
}
